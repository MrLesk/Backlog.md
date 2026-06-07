#!/usr/bin/env bash
set -euo pipefail

# TUI Screenshot Comparison Tool (Ghostty theme/font matrix)
#
# Captures the TUI across several Ghostty theme + font pairings, then stitches
# a left/right (before|after) comparison per screen for PR review.
#
# Typical flow:
#   git checkout main           && bun run build && ./tools/tui-screenshot-compare.sh capture main
#   git checkout <pr-branch>    && bun run build && ./tools/tui-screenshot-compare.sh capture pr
#   ./tools/tui-screenshot-compare.sh compare main pr
#
# Usage:
#   ./tools/tui-screenshot-compare.sh capture <label> [pairing-key...]
#   ./tools/tui-screenshot-compare.sh capture --manual <label>
#   ./tools/tui-screenshot-compare.sh compare <before-label> <after-label>

PROJECT_DIR="$(pwd)"
SCREENSHOT_DIR=".tui-screenshots"
FRAME_DURATION="1.5"

# Launch + render tuning (env-overridable)
BACKLOG_BIN="${BACKLOG_BIN:-${PROJECT_DIR}/dist/backlog}"
GHOSTTY_BIN="${GHOSTTY_BIN:-/Applications/Ghostty.app/Contents/MacOS/ghostty}"
FONT_SIZE="${FONT_SIZE:-14}"
COLS="${COLS:-100}"
ROWS="${ROWS:-32}"
DECORATION="${DECORATION:-false}"
RENDER_DELAY="${RENDER_DELAY:-6}"
NAV_DELAY="${NAV_DELAY:-1}"

VIEWS=("board" "tasklist" "detail" "filters" "filterpopup")

# First available label font (ImageMagick needs an explicit font path on macOS).
for LABEL_FONT in \
	/System/Library/Fonts/Supplemental/Arial.ttf \
	/System/Library/Fonts/Helvetica.ttc \
	/Library/Fonts/Arial.ttf; do
	[[ -f "$LABEL_FONT" ]] && break
done

# Theme/font pairings: "key|theme|font-family". Override via PAIRINGS env
# (newline-separated, same format). Keys must be filesystem-safe slugs.
DEFAULT_PAIRINGS="\
mocha-sfmono|Catppuccin Mocha|SF Mono
gruvbox-plex|Gruvbox Dark|IBM Plex Mono
solarized-menlo|iTerm2 Solarized Light|Menlo
retro-berkeley|Retro|Berkeley Mono"

# --- Helpers ---

die() { echo "Error: $1" >&2; exit 1; }

# Emit each configured pairing as a "key|theme|font" line.
all_pairings() { printf '%s\n' "${PAIRINGS:-$DEFAULT_PAIRINGS}"; }

pairing_field() { echo "$1" | cut -d'|' -f"$2"; }

check_auto_capture_deps() {
	local missing=()
	command -v screencapture &>/dev/null || missing+=("screencapture")
	command -v swift &>/dev/null || missing+=("swift")
	command -v tmux &>/dev/null || missing+=("tmux")
	if (( ${#missing[@]} > 0 )); then
		die "Missing required auto-capture tools (macOS only): ${missing[*]}"
	fi
	[[ -x "$GHOSTTY_BIN" ]] || die "Ghostty not found at ${GHOSTTY_BIN} (set GHOSTTY_BIN)."
}

check_manual_capture_deps() {
	command -v screencapture &>/dev/null || die "Missing required manual capture tool (macOS only): screencapture"
}

check_compare_deps() {
	local missing=()
	command -v ffmpeg &>/dev/null || missing+=("ffmpeg")
	command -v ffprobe &>/dev/null || missing+=("ffprobe")
	command -v bc &>/dev/null || missing+=("bc")
	if (( ${#missing[@]} > 0 )); then
		die "Missing required compare tools: ${missing[*]}"
	fi
}

# Print the CGWindowID of the Ghostty window with an exact title match.
# We launch each capture window with a unique locked --title, so this targets
# the right window even when many Ghostty windows are open. Reading window
# titles requires Screen Recording permission.
ghostty_window_id_by_title() {
	local title="$1"
	swift -e "
import CoreGraphics
guard let list = CGWindowListCopyWindowInfo(.optionOnScreenOnly, kCGNullWindowID) as? [[String: Any]] else { exit(0) }
for w in list {
	guard let owner = w[\"kCGWindowOwnerName\"] as? String, owner == \"Ghostty\",
	      let layer = w[\"kCGWindowLayer\"] as? Int, layer == 0,
	      let wid = w[\"kCGWindowNumber\"] as? Int,
	      let name = w[\"kCGWindowName\"] as? String, name == \"${title}\" else { continue }
	print(wid); exit(0)
}
" 2>/dev/null
}

# Launch a new Ghostty window with the given theme/font/title running a command.
# --title locks the window title (Ghostty ignores the program's title escapes),
# making the window uniquely targetable.
open_ghostty_window() {
	local theme="$1" font="$2" title="$3" cmd="$4"
	# config-default-files=false ignores the user's Ghostty config so our --theme
	# actually applies (an explicit background/palette in their config would
	# otherwise override it). window-save-state=never stops macOS state
	# restoration from also opening a phantom shell window with our locked title.
	open -na "Ghostty" --args \
		"--config-default-files=false" \
		"--window-save-state=never" \
		"--title=${title}" \
		"--theme=${theme}" \
		"--font-family=${font}" \
		"--font-size=${FONT_SIZE}" \
		"--window-width=${COLS}" \
		"--window-height=${ROWS}" \
		"--window-decoration=${DECORATION}" \
		-e bash -lc "$cmd"
}

capture_window() {
	local wid="$1" output="$2" attempt
	# screencapture -l can transiently fail ("could not create image from window")
	# when the window is briefly occluded; retry a few times.
	for attempt in 1 2 3 4; do
		screencapture -l "$wid" -x -o "$output" 2>/dev/null
		[[ -s "$output" ]] && return 0
		sleep 0.5
	done
	echo "    WARN: could not capture $(basename "$output")" >&2
	return 1
}

# --- Auto Capture (single pairing) ---

capture_pairing() {
	local key="$1" theme="$2" font="$3" dir="$4"

	echo ""
	echo "--- ${key}  (theme: ${theme}, font: ${font}) ---"
	local out="${dir}/${key}"
	mkdir -p "$out"

	local title="backlogshot-$$-${key}"
	local sock="backlogshot_$$_${key//-/_}"
	local launcher="${TMPDIR:-/tmp}/${sock}.sh"

	# The TUI runs inside an isolated tmux server (-L <sock>) so navigation is
	# driven with `tmux send-keys` targeted at that session only — it never
	# sends keystrokes to other windows. The launcher hides the tmux status bar
	# so the screenshot is just the TUI.
	{
		echo "tmux set -g status off"
		printf 'cd %q\n' "$PROJECT_DIR"
		printf 'exec %q board view\n' "$BACKLOG_BIN"
	} > "$launcher"
	local tui_cmd="tmux -L ${sock} new-session -s s -x ${COLS} -y ${ROWS} bash ${launcher}"

	# Clean up the tmux server + launcher on any exit from this pairing.
	cleanup_pairing() { tmux -L "$sock" kill-server 2>/dev/null || true; rm -f "$launcher"; }

	# Launch and locate the window by its locked title, retrying if macOS fails
	# to bring up the window (occasional under heavy repeated launches). Each
	# attempt cleans up its partial instance first. screencapture -l later grabs
	# the window by ID without focus, so we never steal focus from your windows.
	local wid="" attempt
	for attempt in 1 2 3; do
		echo "  Launching TUI in Ghostty (attempt ${attempt})..."
		open_ghostty_window "$theme" "$font" "$title" "$tui_cmd"
		sleep "$RENDER_DELAY"
		wid=$(ghostty_window_id_by_title "$title")
		[[ -n "$wid" ]] && break
		echo "  No window appeared; retrying..."
		tmux -L "$sock" kill-server 2>/dev/null || true
		sleep 2
	done
	if [[ -z "$wid" ]]; then
		echo "  ERROR: Could not find window titled '${title}' after ${attempt} attempts. Skipping."
		cleanup_pairing
		return 1
	fi
	echo "  Window ID: ${wid}"

	echo "  [1/5] Board view..."
	capture_window "$wid" "${out}/board.png"

	echo "  [2/5] Task list view..."
	tmux -L "$sock" send-keys -t s Tab 2>/dev/null || true
	sleep "$NAV_DELAY"
	capture_window "$wid" "${out}/tasklist.png"

	echo "  [3/5] Detail view..."
	tmux -L "$sock" send-keys -t s Right 2>/dev/null || true
	sleep "$NAV_DELAY"
	capture_window "$wid" "${out}/detail.png"

	echo "  [4/5] Filters (search) view..."
	tmux -L "$sock" send-keys -t s -l "/" 2>/dev/null || true
	sleep "$NAV_DELAY"
	capture_window "$wid" "${out}/filters.png"

	# Status filter popup — showcases the inverse-video highlight on the
	# selected option. Escape leaves the search field first, then 's' opens it.
	echo "  [5/5] Filter popup..."
	tmux -L "$sock" send-keys -t s Escape 2>/dev/null || true
	sleep 0.4
	tmux -L "$sock" send-keys -t s -l "s" 2>/dev/null || true
	sleep "$NAV_DELAY"
	capture_window "$wid" "${out}/filterpopup.png"

	cleanup_pairing
	echo "  Saved to ${out}/"
}

do_capture() {
	local label="$1"; shift
	local wanted=("$@")

	local dir="${SCREENSHOT_DIR}/${label}"
	mkdir -p "$dir"

	echo "=== Capturing TUI screenshots: ${label} ==="
	echo "Binary: ${BACKLOG_BIN}"
	[[ -x "$BACKLOG_BIN" ]] || die "Backlog binary not found at ${BACKLOG_BIN}. Run 'bun run build' (or set BACKLOG_BIN)."

	while IFS= read -r line; do
		[[ -n "$line" ]] || continue
		local key theme font
		key=$(pairing_field "$line" 1)
		theme=$(pairing_field "$line" 2)
		font=$(pairing_field "$line" 3)

		# If specific pairing keys were requested, skip the rest.
		if (( ${#wanted[@]} > 0 )); then
			local match=0
			for w in "${wanted[@]}"; do [[ "$w" == "$key" ]] && match=1; done
			(( match )) || continue
		fi

		capture_pairing "$key" "$theme" "$font" "$dir" || true
		# Brief cooldown so rapid successive instance launches don't get throttled.
		sleep 2
	done <<< "$(all_pairings)"

	echo ""
	echo "Done. Screenshots saved to ${dir}/"
}

# --- Manual Capture ---

do_capture_manual() {
	local label="$1"
	local dir="${SCREENSHOT_DIR}/${label}/manual"
	mkdir -p "$dir"

	local descs=("Board view" "Task list view" "Task detail (detail pane focused)" "Filters (search focused)" "Status filter popup (press s)")

	echo "=== Manual capture: ${label} ==="
	echo "For each screen, navigate to the view in the TUI, then click its window to capture."
	echo ""

	for i in "${!VIEWS[@]}"; do
		local view="${VIEWS[$i]}"
		echo "[$((i+1))/${#VIEWS[@]}] ${descs[$i]}"
		echo "  Press Enter when ready, then click the TUI window."
		read -r
		screencapture -w "${dir}/${view}.png"
		[[ -f "${dir}/${view}.png" ]] && echo "  Saved: ${dir}/${view}.png" || echo "  Warning: capture may have been cancelled."
		echo ""
	done

	echo "Done. Screenshots saved to ${dir}/"
}

# --- Compare ---

# Pad two images to a shared bounding box (max width x max height), top-left aligned.
pad_to_same_box() {
	local img_a="$1" img_b="$2" out_a="$3" out_b="$4"
	local w_a h_a w_b h_b
	w_a=$(ffprobe -v error -select_streams v:0 -show_entries stream=width  -of csv=p=0 "$img_a")
	h_a=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$img_a")
	w_b=$(ffprobe -v error -select_streams v:0 -show_entries stream=width  -of csv=p=0 "$img_b")
	h_b=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$img_b")
	local max_w=$(( w_a > w_b ? w_a : w_b ))
	local max_h=$(( h_a > h_b ? h_a : h_b ))
	ffmpeg -y -loglevel error -i "$img_a" -vf "pad=${max_w}:${max_h}:0:0:black" -frames:v 1 "$out_a"
	ffmpeg -y -loglevel error -i "$img_b" -vf "pad=${max_w}:${max_h}:0:0:black" -frames:v 1 "$out_b"
}

add_label() {
	local input="$1" output="$2" text="$3"
	# Prefer ImageMagick (ffmpeg's drawtext filter is often unavailable — it
	# needs libfreetype). ImageMagick needs an explicit font path on macOS.
	# Fall back to an unlabelled copy so stitching still works.
	if command -v magick &>/dev/null && [[ -f "$LABEL_FONT" ]]; then
		if magick "$input" -font "$LABEL_FONT" -gravity NorthWest -pointsize 28 -fill white \
			-undercolor '#000000A0' -annotate +18+10 " ${text} " "$output" 2>/dev/null; then
			return 0
		fi
	fi
	cp "$input" "$output"
}

do_compare() {
	local before_label="$1" after_label="$2"
	local before_dir="${SCREENSHOT_DIR}/${before_label}"
	local after_dir="${SCREENSHOT_DIR}/${after_label}"
	local out_dir="${SCREENSHOT_DIR}/compare-${before_label}-${after_label}"

	[[ -d "$before_dir" ]] || die "No screenshots found for '${before_label}'. Run capture first."
	[[ -d "$after_dir" ]]  || die "No screenshots found for '${after_label}'. Run capture first."

	mkdir -p "$out_dir"
	local tmpdir; tmpdir=$(mktemp -d)
	trap 'rm -rf "$tmpdir"' EXIT

	echo "=== Generating comparisons: ${before_label} (left) vs ${after_label} (right) ==="

	# Pairings present in both captures.
	local pairings=()
	for d in "${before_dir}"/*/; do
		[[ -d "$d" ]] || continue
		local p; p=$(basename "$d")
		[[ -d "${after_dir}/${p}" ]] && pairings+=("$p")
	done
	(( ${#pairings[@]} > 0 )) || pairings=(".")

	for p in "${pairings[@]}"; do
		local b_dir="${before_dir}/${p}" a_dir="${after_dir}/${p}" p_out="${out_dir}"
		if [[ "$p" != "." ]]; then
			p_out="${out_dir}/${p}"
			echo ""
			echo "--- ${p} ---"
		fi
		mkdir -p "$p_out"

		for view in "${VIEWS[@]}"; do
			local before_img="${b_dir}/${view}.png" after_img="${a_dir}/${view}.png"
			[[ -f "$before_img" ]] || { echo "  Skipping ${view}: no 'before' image."; continue; }
			[[ -f "$after_img" ]]  || { echo "  Skipping ${view}: no 'after' image."; continue; }

			echo "  Processing: ${view}..."

			local pb="${tmpdir}/${p}-${view}-b.png" pa="${tmpdir}/${p}-${view}-a.png"
			pad_to_same_box "$before_img" "$after_img" "$pb" "$pa"

			local lb="${tmpdir}/${p}-${view}-bl.png" la="${tmpdir}/${p}-${view}-al.png"
			add_label "$pb" "$lb" "Before (${before_label})"
			add_label "$pa" "$la" "After (${after_label})"

			# Side-by-side: left = before, right = after.
			ffmpeg -y -loglevel error -i "$lb" -i "$la" \
				-filter_complex "[0][1]hstack=inputs=2" -frames:v 1 "${p_out}/${view}-compare.png"

			# Animated toggle (same-position flip) for spotting subtle diffs.
			# Non-fatal: the static side-by-side PNG is the primary artifact.
			local fps; fps=$(echo "scale=4; 1 / ${FRAME_DURATION}" | bc)
			ffmpeg -y -loglevel error -framerate "$fps" -i "$lb" -framerate "$fps" -i "$la" \
				-filter_complex "[0][1]concat=n=2:v=1:a=0,format=rgba" -f apng -plays 0 \
				"${p_out}/${view}-toggle.apng" 2>/dev/null || true
			ffmpeg -y -loglevel error -framerate "$fps" -i "$lb" -framerate "$fps" -i "$la" \
				-filter_complex "[0][1]concat=n=2:v=1:a=0,format=rgb24" \
				"${p_out}/${view}-toggle.gif" 2>/dev/null || true

			echo "    ${p_out}/${view}-compare.png"
		done

		# Combined contact sheet: stack this pairing's view comparisons into one
		# tall image, each section titled with the view name. Easy to embed in a PR.
		if command -v magick &>/dev/null; then
			local sheet_parts=()
			for view in "${VIEWS[@]}"; do
				local vc="${p_out}/${view}-compare.png"
				[[ -f "$vc" ]] || continue
				local titled="${tmpdir}/${p}-${view}-titled.png"
				if [[ -f "$LABEL_FONT" ]] && magick "$vc" -font "$LABEL_FONT" -gravity North \
					-background '#111111' -splice 0x44 -fill white -pointsize 26 \
					-annotate +0+8 "${view}" "$titled" 2>/dev/null; then
					sheet_parts+=("$titled")
				else
					sheet_parts+=("$vc")
				fi
			done
			if (( ${#sheet_parts[@]} > 0 )) && \
				magick "${sheet_parts[@]}" -append "${p_out}/contact-sheet.png" 2>/dev/null; then
				echo "  Contact sheet: ${p_out}/contact-sheet.png"
			fi
		fi
	done

	echo ""
	echo "Done. Comparisons saved to ${out_dir}/"
}

# --- Main ---

case "${1:-}" in
	capture)
		if [[ "${2:-}" == "--manual" ]]; then
			[[ -n "${3:-}" ]] || die "Usage: $0 capture --manual <label>"
			check_manual_capture_deps
			do_capture_manual "$3"
		else
			[[ -n "${2:-}" ]] || die "Usage: $0 capture <label> [pairing-key...]"
			check_auto_capture_deps
			label="$2"; shift 2
			do_capture "$label" "$@"
		fi
		;;
	compare)
		[[ -n "${2:-}" && -n "${3:-}" ]] || die "Usage: $0 compare <before-label> <after-label>"
		check_compare_deps
		do_compare "$2" "$3"
		;;
	*)
		cat <<-USAGE
		TUI Screenshot Comparison Tool (Ghostty theme/font matrix)

		Usage:
		  $0 capture <label> [pairing-key...]     Auto-capture across theme/font pairings
		  $0 capture --manual <label>             Manual capture (click-to-select)
		  $0 compare <before-label> <after-label> Stitch left|right comparison images

		Default pairings (key | theme | font):
		$(all_pairings | sed 's/^/  /')

		Auto-capture launches the TUI (via the compiled ${BACKLOG_BIN##*/} binary) inside an
		isolated tmux session in a new Ghostty window per pairing, navigates the
		views (board, task list, detail, filters) via tmux send-keys, and screenshots
		each by window ID. Navigation never sends keystrokes to your other windows.
		Requires Screen Recording permission (for screencapture + reading window titles)
		for the terminal app you run this from.

		Typical PR flow:
		  git checkout main        && bun run build && $0 capture main
		  git checkout <pr-branch> && bun run build && $0 capture pr
		  $0 compare main pr

		Examples:
		  $0 capture pr                       # all pairings
		  $0 capture pr retro-berkeley        # one pairing only
		  $0 capture --manual pr              # manual click-to-capture
		  $0 compare main pr                  # generate left|right comparisons

		Environment:
		  BACKLOG_BIN   TUI binary to launch (default: ./dist/backlog)
		  GHOSTTY_BIN   Ghostty executable path
		  PAIRINGS      Override pairing list ("key|theme|font" lines)
		  FONT_SIZE=14  Font size for all captures
		  COLS=100 ROWS=32   Window size in cells (keeps before/after aligned)
		  DECORATION=false   Ghostty window-decoration
		  RENDER_DELAY=6     Seconds to wait for initial TUI render (raise if the
		                     board's "Loading tasks" screen is captured)
		  NAV_DELAY=1        Seconds to wait after each navigation

		Output structure:
		  ${SCREENSHOT_DIR}/<label>/<pairing-key>/board.png
		  ${SCREENSHOT_DIR}/compare-<before>-<after>/<pairing-key>/board-compare.png
		USAGE
		;;
esac
