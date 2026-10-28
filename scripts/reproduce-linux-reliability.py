#!/usr/bin/env python3
"""Bounded Linux probes for #1038 and #1048; run against a published binary.

The memory probe needs sudo/systemd to put only the server in its own cgroup.
The load generator discards bodies and stays outside that cgroup. Fixtures are
synthetic and disposable. Results are measurements, not automatic leak verdicts.
"""

import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import platform
import pwd
import signal
import subprocess
import tempfile
import time
import urllib.request


def command(args, cwd=None, timeout=30):
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True, text=True, timeout=timeout).stdout.strip()


def emit(output, kind, **values):
    row = {"kind": kind, "time": time.time(), **values}
    text = json.dumps(row, sort_keys=True)
    print(text, flush=True)
    with (output / "results.jsonl").open("a") as stream:
        stream.write(text + "\n")


def git(root, *args):
    return command(["git", "-c", "commit.gpgsign=false", *args], cwd=root)


def initialize(root, branches):
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.email", "repro@example.invalid")
    git(root, "config", "user.name", "Backlog reproduction")
    (root / "backlog/tasks").mkdir(parents=True)
    (root / "backlog/config.yml").write_text(
        'project_name: "Linux reliability reproduction"\n'
        'default_status: "To Do"\nstatuses: ["To Do", "In Progress", "Done"]\n'
        f'check_active_branches: {str(branches).lower()}\n'
        'active_branch_days: 30\nremote_operations: false\nauto_commit: false\n'
    )
    git(root, "add", ".")
    git(root, "commit", "-q", "-m", "Initialize reproduction")


def process_sample(pid):
    status = Path(f"/proc/{pid}/status").read_text()
    values = {}
    for line in status.splitlines():
        key, _, value = line.partition(":")
        if key in ("VmRSS", "VmHWM", "RssAnon", "RssFile"):
            values[key + "_KiB"] = int(value.split()[0])
        elif key == "State":
            values["state"] = value.strip()
    fields = Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()
    values["cpu_seconds"] = (int(fields[11]) + int(fields[12])) / os.sysconf("SC_CLK_TCK")
    return values


def pipe_probe(binary, output):
    for title_length in (10, 5000):
        with tempfile.TemporaryDirectory(prefix="backlog-pipe-") as directory:
            root = Path(directory)
            initialize(root, True)
            git(root, "checkout", "-q", "-b", "broken")
            (root / "backlog/tasks/task-1 - Conflicted.md").write_text(
                f'---\nid: TASK-1\ntitle: {"x" * title_length}\n'
                '<<<<<<< Updated upstream\nstatus: Done\n=======\nstatus: To Do\n'
                '>>>>>>> Stashed changes\n---\n'
            )
            git(root, "add", ".")
            git(root, "commit", "-q", "-m", "Conflicted task on another branch")
            git(root, "checkout", "-q", "main")
            args = [str(binary), "search", "task", "--plain"]
            opened = subprocess.run(args, cwd=root, capture_output=True, timeout=15)
            (output / f"stderr-{title_length}.txt").write_bytes(opened.stderr)
            emit(output, "pipe_open", title_length=title_length, exit_code=opened.returncode,
                 stderr_bytes=len(opened.stderr), stdout_bytes=len(opened.stdout))
            for mode in ("stderr_closed", "merged_closed", "merged_head_1", "stdout_closed_control"):
                reader, writer = os.pipe()
                is_stdout = mode == "stdout_closed_control"
                current_args = [str(binary), "task", "list", "--plain"] if is_stdout else args
                if mode != "merged_head_1":
                    os.close(reader)
                process = subprocess.Popen(
                    current_args, cwd=root,
                    stdout=writer if mode.startswith("merged") or is_stdout else subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL if is_stdout else writer,
                    start_new_session=True,
                )
                os.close(writer)
                start = time.monotonic()
                samples = []
                needed_term = needed_kill = False
                try:
                    if mode == "merged_head_1":
                        # Reading one diagnostic line reproduces `2>&1 | head -1`.
                        import select
                        deadline = time.monotonic() + 5
                        with os.fdopen(reader, "rb", buffering=0) as stream:
                            while time.monotonic() < deadline:
                                if not select.select([stream], [], [], 0.1)[0]:
                                    continue
                                byte = stream.read(1)
                                if byte in (b"", b"\n"):
                                    break
                    for _ in range(5):
                        try:
                            process.wait(timeout=1)
                            break
                        except subprocess.TimeoutExpired:
                            samples.append(process_sample(process.pid))
                    if process.poll() is None:
                        needed_term = True
                        os.killpg(process.pid, signal.SIGTERM)
                        try:
                            process.wait(timeout=2)
                        except subprocess.TimeoutExpired:
                            needed_kill = True
                    emit(output, "pipe_closed", title_length=title_length, mode=mode,
                         pid=process.pid, elapsed_seconds=round(time.monotonic() - start, 3),
                         exit_code=process.poll(), needed_term=needed_term, needed_kill=needed_kill,
                         samples=samples)
                finally:
                    if process.poll() is None:
                        os.killpg(process.pid, signal.SIGKILL)
                    process.wait(timeout=5)


def write_corpus(root, body_bytes):
    initialize(root, False)
    (root / "backlog/completed").mkdir()
    total_bytes = 0
    for index in range(1, 298):
        active = index <= 109
        folder = "tasks" if active else "completed"
        status = "To Do" if active else "Done"
        paragraph = (f"Task {index}: preserve readable task state and verify the requested result.\n" * 1000)[:body_bytes]
        content = (
            f'---\nid: TASK-{index}\ntitle: Linux fixture {index}\nstatus: {status}\n'
            'assignee: []\ncreated_date: "2026-10-01"\nlabels: [reproduction]\ndependencies: []\n---\n\n'
            f'## Description\n\n<!-- SECTION:DESCRIPTION:BEGIN -->\n{paragraph}\n<!-- SECTION:DESCRIPTION:END -->\n\n'
            '## Acceptance Criteria\n<!-- AC:BEGIN -->\n- [ ] #1 Preserve the expected result\n<!-- AC:END -->\n'
        )
        (root / f"backlog/{folder}/task-{index} - Linux-fixture-{index}.md").write_text(content)
        total_bytes += len(content.encode())
    git(root, "add", ".")
    git(root, "commit", "-q", "-m", "Synthetic 109 active and 188 completed tasks")
    return total_bytes


def memory_sample(pid, cgroup):
    result = process_sample(pid)
    for filename in ("memory.events", "memory.stat"):
        entries = dict(line.split() for line in (cgroup / filename).read_text().splitlines())
        result[filename] = {key: int(value) for key, value in entries.items()
                            if filename == "memory.events" or key in ("anon", "file", "kernel")}
    result["memory.current"] = int((cgroup / "memory.current").read_text())
    return result


def get(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        count = 0
        while chunk := response.read(65536):
            count += len(chunk)
        return response.status, count


def memory_probe(binary, output, waves, requests, idle, body_bytes):
    with tempfile.TemporaryDirectory(prefix="backlog-memory-") as directory:
        root = Path(directory)
        corpus_bytes = write_corpus(root, body_bytes)
        # A separate service cgroup prevents response buffers in this load generator
        # from being counted as server memory. No swap or manual GC is used.
        unit = f"backlog-memory-repro-{os.getpid()}"
        command(["sudo", "systemd-run", "--quiet", f"--unit={unit}", "--service-type=exec",
                 "--property=MemoryMax=3G", "--property=MemorySwapMax=0",
                 "--property=TimeoutStopSec=2", f"--property=User={pwd.getpwuid(os.getuid()).pw_name}",
                 f"--property=WorkingDirectory={root}",
                 f"--property=StandardOutput=append:{output / 'server.log'}",
                 f"--property=StandardError=append:{output / 'server.log'}",
                 str(binary), "browser", "--port", "6431", "--no-open"])
        try:
            pid = int(command(["systemctl", "show", unit, "--property=MainPID", "--value"]))
            cgroup_name = command(["systemctl", "show", unit, "--property=ControlGroup", "--value"])
            cgroup = Path("/sys/fs/cgroup") / cgroup_name.lstrip("/")
            base = "http://127.0.0.1:6431"
            for attempt in range(150):
                try:
                    if get(base + "/api/config")[0] == 200:
                        break
                except OSError:
                    pass
                time.sleep(0.2)
            else:
                raise RuntimeError("Browser did not start within 30 seconds")
            emit(output, "memory_setup", pid=pid, cgroup=str(cgroup), active_tasks=109,
                 completed_tasks=188, corpus_bytes=corpus_bytes, description_bytes=body_bytes,
                 requests_per_wave=requests, concurrency=2, idle_seconds=idle,
                 generator_cgroup=Path("/proc/self/cgroup").read_text().strip())
            time.sleep(idle)
            emit(output, "memory_idle", wave=0, pid=pid, **memory_sample(pid, cgroup))
            for wave in range(1, waves + 1):
                def worker(worker_index):
                    errors = []
                    successes = response_bytes = 0
                    for index in range(worker_index, requests, 2):
                        try:
                            status, size = get(f"{base}/api/tasks/task-{index % 109 + 1}")
                            if status != 200:
                                raise RuntimeError(f"HTTP {status}")
                            successes += 1
                            response_bytes += size
                        except Exception as error:
                            errors.append(str(error))
                            if len(errors) >= 5:
                                break
                    return {"successes": successes, "response_bytes": response_bytes, "errors": errors}

                start = time.monotonic()
                peak_rss = 0
                with concurrent.futures.ThreadPoolExecutor(2) as executor:
                    jobs = [executor.submit(worker, index) for index in range(2)]
                    while not all(job.done() for job in jobs):
                        peak_rss = max(peak_rss, memory_sample(pid, cgroup).get("VmRSS_KiB", 0))
                        time.sleep(1)
                    results = [job.result() for job in jobs]
                emit(output, "memory_load", wave=wave, pid=pid, seconds=round(time.monotonic() - start, 3),
                     peak_rss_KiB=peak_rss, workers=results)
                time.sleep(idle)
                emit(output, "memory_idle", wave=wave, pid=pid, **memory_sample(pid, cgroup))
                if any(result["errors"] for result in results):
                    raise RuntimeError("Request errors invalidate the repeated-wave comparison")
        finally:
            state = command(["systemctl", "show", unit, "--property=Result", "--property=ExecMainStatus",
                             "--property=MemoryPeak", "--property=OOMPolicy"])
            emit(output, "memory_service", state=state)
            command(["sudo", "systemctl", "stop", unit], timeout=10)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--mode", required=True, choices=("pipe", "memory"))
    parser.add_argument("--waves", type=int, default=6)
    parser.add_argument("--requests", type=int, default=2000)
    parser.add_argument("--idle", type=int, default=60)
    parser.add_argument("--body-bytes", type=int, default=4096)
    args = parser.parse_args()
    if platform.system() != "Linux":
        parser.error("Run on Linux; a macOS run cannot establish these reports")
    binary, output = args.binary.resolve(), args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    with binary.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    emit(output, "environment", uname=list(platform.uname()),
         os_release=Path("/etc/os-release").read_text(), binary=str(binary), sha256=digest,
         version=command([str(binary), "--version"]), python=platform.python_version(),
         cpuinfo=Path("/proc/cpuinfo").read_text().split("\n\n", 1)[0])
    if args.mode == "pipe":
        pipe_probe(binary, output)
    else:
        memory_probe(binary, output, args.waves, args.requests, args.idle, args.body_bytes)


if __name__ == "__main__":
    main()
