---
id: doc-003
title: Running Backlog Browser as a Service
type: guide
created_date: '2026-04-25'
---

# Running Backlog.md as a Service

`backlog browser --no-open` keeps the Web UI running without opening a browser tab. This is useful when you want a long-lived local dashboard that starts on boot and restarts on failure.

Pick the recipe that matches your OS.

> [!NOTE]
> Running more than one Backlog project on the same machine? Each project needs its own service name and its own port. The examples below use `<project>` as a placeholder. Replace it with a short slug per project, such as `work` or `personal`, and assign distinct ports, such as `6420` and `6421`.

## Linux / WSL2 (systemd user unit)

Create `~/.config/systemd/user/backlog-browser-<project>.service`, for example `backlog-browser-work.service`:

```ini
[Unit]
Description=Backlog.md Browser (<project>)
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/your/project
ExecStart=/usr/local/bin/backlog browser --no-open --port 6420
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

Enable linger so the unit can start at boot without an active terminal session, then enable the service:

```bash
sudo loginctl enable-linger "$USER"
systemctl --user daemon-reload
systemctl --user enable --now backlog-browser-<project>.service

# Check status or follow logs
systemctl --user status backlog-browser-<project>
journalctl --user -u backlog-browser-<project> -f
```

Adjust the `ExecStart` path to match `which backlog` on your system. For users with many projects, a systemd [template unit](https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html#Description) such as `backlog-browser@.service` with `%i` can reduce repetition.

## macOS (launchd LaunchAgent)

Create `~/Library/LaunchAgents/md.backlog.browser.<project>.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>md.backlog.browser.&lt;project&gt;</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/backlog</string>
    <string>browser</string>
    <string>--no-open</string>
    <string>--port</string>
    <string>6420</string>
  </array>
  <key>WorkingDirectory</key><string>/path/to/your/project</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/backlog-browser-&lt;project&gt;.out.log</string>
  <key>StandardErrorPath</key><string>/tmp/backlog-browser-&lt;project&gt;.err.log</string>
</dict>
</plist>
```

Load it:

```bash
launchctl load -w ~/Library/LaunchAgents/md.backlog.browser.<project>.plist
```

Use `/usr/local/bin/backlog` on Intel Macs, or the path returned by `which backlog`. The `Label` must be unique per project because launchd refuses to load two agents with the same label.

## Windows (Task Scheduler or NSSM)

For a setup that runs when you log in, register a Scheduled Task from PowerShell:

```powershell
$action  = New-ScheduledTaskAction -Execute "backlog.exe" `
            -Argument "browser --no-open --port 6420" `
            -WorkingDirectory "C:\path\to\your\project"
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "Backlog Browser (<project>)" -Action $action -Trigger $trigger
```

For a true background service that starts before login and auto-restarts on failure, wrap the command with [NSSM](https://nssm.cc/):

```powershell
nssm install BacklogBrowser_<project> "C:\path\to\backlog.exe" "browser --no-open --port 6420"
nssm set BacklogBrowser_<project> AppDirectory "C:\path\to\your\project"
nssm start BacklogBrowser_<project>
```

Both `TaskName` and the NSSM service name must be unique per project.
