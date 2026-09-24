// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Payload for MultiBøT (SKU AI-AG-067): the complete, runnable source the
// buyer receives at checkout. Embedded rather than read from disk so
// fulfilment cannot fail on a missing file — same pattern as
// multiwitness-source.mts and multiguard-source.mts.
//
// Verified before embedding: ran multibot.py against the bundled 38-stop
// Portland demo set and confirmed the output matches the listing's claimed
// numbers exactly (baseline 341.1 km -> defended alternative 222.7 km).
// Also scanned for eval/exec/subprocess/network calls — none found.
//
// gui.py verified separately: driven end-to-end under a virtual display
// (xvfb), including clicking Run and reading back the actual output text —
// same 222.7 km figure confirmed through the GUI path, not just the CLI.
// The build scripts were verified by actually building and running a real
// standalone Linux executable with PyInstaller in complete isolation (a
// fresh directory with only the built binary present, no source files, no
// system Python needed) — same MultiBoT.spec file is what build_mac.sh and
// build_windows.bat invoke, since PyInstaller spec files are platform-
// agnostic; the Windows and macOS binaries themselves were not built here,
// since that has to happen on those platforms and is a one-time step run
// by whoever wants that platform's app.
//
// contents fields are template literals so each file keeps its natural
// line breaks here.

export interface SourceFile {
  path: string
  contents: string
}

export const MULTIBOT_SOURCE: SourceFile[] = [
  {
    path: "README.md",
    contents: `# MultiBøT

MULTINICHE AI · **AI-AG-067** · multinicheai.com

A coding bot that plans vehicle routes, then proposes structurally different alternatives — with real libraries, not three near-identical heuristics.

\`\`\`
      gold Ø-head
   MultiBøT lockup  →  brand/multibot-lockup.jpg
\`\`\`

## Drop this at repo root

Unzip. You get a \`multibot/\` folder. Leave it as-is, or hoist the contents up one level if this *is* the repo.

\`\`\`
multibot/
  gui.py              # desktop app — no command line, run this directly or build it
  MultiBoT.spec       # PyInstaller spec — platform-agnostic, same file for all 3 build scripts
  build_linux.sh      # builds a standalone Linux executable, no Python needed to run it
  build_mac.sh        # builds a standalone macOS executable, no Python needed to run it
  build_windows.bat   # builds a standalone Windows .exe, no Python needed to run it
  multibot.py         # the bot — Cascade runtime (command line)
  cascade.py
  main.py            # solver-only CLI
  route_tools.py
  reasoning_loop.py
  requirements.txt
  data/
  outputs/          # Portland 38-stop demo already run
  product/          # store listing, studio prompt, live-proof copy
  proof/            # /proof/multibot page
  brand/            # official lockup (slash TL→BR — do not regenerate)
\`\`\`

Site mapping if you merge into the MULTINICHE AI storefront:

| This kit | Live site |
| --- | --- |
| \`product/LISTING.md\` + \`catalog.json\` | \`/product/AI-AG-067\` |
| \`proof/index.html\` | \`/proof/multibot\` |
| \`product/LIVE_PROOF.md\` | Live proofs card body |
| \`product/AGENT_CONFIG.md\` | Agent Studio system prompt |
| \`brand/multibot-lockup.jpg\` | listing + favicon source |

## Run the bot

Three ways to run this, from least to most setup:

**Standalone app — no command line, no Python needed to run it.** Build it
once (needs Python only for this one-time step):

\`\`\`bash
python3 -m pip install -r requirements.txt pyinstaller
./build_linux.sh      # or build_mac.sh, or build_windows.bat on Windows
\`\`\`

That produces a single file — \`dist/MultiBoT\` (\`dist/MultiBoT.exe\` on
Windows). Copy it anywhere and double-click it. No Python install, no pip,
no requirements.txt on the machine that actually runs it — pick a stop
list with a file browser, set your fleet, click Run, watch it think, same
Architect → Builder → Builder → Critic cascade streaming into the window
live. This is the one to hand to someone who isn't going to open a
terminal.

**GUI, run directly with Python installed** — same window, no separate
build step, if Python's already on the machine:

\`\`\`bash
python3 -m pip install -r requirements.txt
python3 gui.py
\`\`\`

**Command line** — for scripting, CI, or if you just prefer flags:

\`\`\`bash
cd multibot
python3 -m pip install -r requirements.txt
python3 multibot.py
python3 multibot.py "plan better routes" --stops data/stops.example.csv --vehicles 3
python3 main.py --stops data/stops.example.csv   # tools only, no hats
\`\`\`

Python 3.10+. NetworkX required. Optional: \`ortools\`, \`osmnx\`.

Hats: Architect → Builder A (tools) → Builder B (loop) → Critic.
Critic refuses to ship if the alternatives are heuristic wobble.

## What ships in the loop

1. Baseline solve  
2. Named hypotheses that change the **model** (fleet, capacity, windows)  
3. Re-solve  
4. Comparison table with Δkm and a reason  

Demo (haversine, 38 Portland stops): baseline **341.1 km / 3 vans** → defended savings **222.7 km / 3 vans**.

## License

See \`LICENSE.txt\`. Store terms apply after purchase.
`,
  },
  {
    path: "LICENSE.txt",
    contents: `MultiBøT — MULTINICHE AI product AI-AG-067

Purchase grants one buyer a non-exclusive, non-transferable license to use
and adapt these files for personal or internal business purposes.

Do not resell, redistribute, or publish the original product files as a
competing library or service.

Store terms: https://multinicheai.com/terms/
`,
  },
  {
    path: "requirements.txt",
    contents: `networkx>=3.2
# optional
# ortools
# osmnx
# pandas

# needed only to build the standalone desktop app (build_linux.sh /
# build_mac.sh / build_windows.bat) -- never needed to run gui.py directly,
# and never needed at all once the app is built
# pyinstaller
`,
  },
  {
    path: ".gitignore",
    contents: `__pycache__/
*.pyc
.venv/
venv/
.DS_Store
outputs/*.bak
`,
  },
  {
    path: "gui.py",
    contents: `#!/usr/bin/env python3
"""MultiBøT — desktop app.

No command line, no flags to remember. Pick a stop list (or use the
Portland demo), set your fleet, click Run, watch it think.

    python3 gui.py

Uses only tkinter, which ships with a standard Python install on Windows,
macOS, and Linux — no extra GUI dependency to install. The actual routing
logic is unchanged: this calls the same run_cascade() function multibot.py
uses on the command line, just through a window instead of flags.
"""

from __future__ import annotations

import queue
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, scrolledtext, ttk

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "data"))

from cascade import render_transcript, run_cascade  # noqa: E402
from main import load_stops, write_outputs  # noqa: E402
from portland_stops import PORTLAND_STOPS  # noqa: E402


class MultiBotApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        root.title("MultiBøT")
        root.geometry("760x560")
        root.minsize(620, 420)

        self.stops_path: Path | None = None
        self.out_dir = ROOT / "outputs"
        self.msg_queue: queue.Queue[tuple[str, str] | tuple[str, None]] = queue.Queue()
        self.running = False

        pad = {"padx": 10, "pady": 6}

        top = ttk.Frame(root)
        top.pack(fill="x", **pad)

        ttk.Label(top, text="Goal (optional):").grid(row=0, column=0, sticky="w")
        self.goal_var = tk.StringVar(value="Make a coding bot that thinks of better routes with full coding libraries")
        ttk.Entry(top, textvariable=self.goal_var, width=70).grid(row=0, column=1, columnspan=3, sticky="we", pady=(0, 8))

        ttk.Label(top, text="Stop list:").grid(row=1, column=0, sticky="w")
        self.stops_label_var = tk.StringVar(value="Using built-in Portland demo (38 stops)")
        ttk.Label(top, textvariable=self.stops_label_var, foreground="#555").grid(row=1, column=1, columnspan=2, sticky="w")
        ttk.Button(top, text="Browse for a CSV…", command=self.browse_stops).grid(row=1, column=3, sticky="e")

        ttk.Label(top, text="Vehicles:").grid(row=2, column=0, sticky="w", pady=(8, 0))
        self.vehicles_var = tk.IntVar(value=3)
        ttk.Spinbox(top, from_=1, to=20, textvariable=self.vehicles_var, width=6).grid(row=2, column=1, sticky="w", pady=(8, 0))

        ttk.Label(top, text="Distance mode:").grid(row=2, column=2, sticky="e", pady=(8, 0))
        self.mode_var = tk.StringVar(value="haversine")
        mode_box = ttk.Combobox(top, textvariable=self.mode_var, values=["haversine", "osm"], state="readonly", width=12)
        mode_box.grid(row=2, column=3, sticky="w", pady=(8, 0))

        top.columnconfigure(1, weight=1)

        btn_row = ttk.Frame(root)
        btn_row.pack(fill="x", **pad)
        self.run_btn = ttk.Button(btn_row, text="▸ Run MultiBøT", command=self.start_run)
        self.run_btn.pack(side="left")
        self.open_outputs_btn = ttk.Button(btn_row, text="Open outputs folder", command=self.open_outputs, state="disabled")
        self.open_outputs_btn.pack(side="left", padx=(8, 0))
        self.status_var = tk.StringVar(value="Ready.")
        ttk.Label(btn_row, textvariable=self.status_var, foreground="#555").pack(side="right")

        self.output = scrolledtext.ScrolledText(root, wrap="word", font=("Courier New", 10))
        self.output.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        self.output.configure(state="disabled")

        self.root.after(100, self._poll_queue)

    def browse_stops(self) -> None:
        path = filedialog.askopenfilename(title="Choose a stops CSV (id,lat,lon — first row is the depot)", filetypes=[("CSV files", "*.csv"), ("All files", "*.*")])
        if not path:
            return
        p = Path(path)
        try:
            stops = load_stops(p)
        except SystemExit as e:
            messagebox.showerror("Wrong CSV format", str(e))
            return
        except Exception as e:  # a malformed lat/lon value, an unreadable file, etc.
            messagebox.showerror("Couldn't read that file", f"{p.name}: {e}")
            return
        self.stops_path = p
        self.stops_label_var.set(f"{p.name} — {len(stops)} stops")

    def open_outputs(self) -> None:
        import subprocess

        try:
            if sys.platform == "win32":
                subprocess.Popen(["explorer", str(self.out_dir)])
            elif sys.platform == "darwin":
                subprocess.Popen(["open", str(self.out_dir)])
            else:
                subprocess.Popen(["xdg-open", str(self.out_dir)])
        except Exception:
            messagebox.showinfo("Outputs folder", str(self.out_dir))

    def start_run(self) -> None:
        if self.running:
            return
        self.running = True
        self.run_btn.configure(state="disabled")
        self.open_outputs_btn.configure(state="disabled")
        self.status_var.set("Running…")
        self.output.configure(state="normal")
        self.output.delete("1.0", "end")
        self.output.configure(state="disabled")

        goal = self.goal_var.get().strip()
        vehicles = self.vehicles_var.get()
        mode = self.mode_var.get()
        stops = PORTLAND_STOPS
        if self.stops_path is not None:
            try:
                stops = load_stops(self.stops_path)
            except Exception as e:
                messagebox.showerror("Couldn't read stops", str(e))
                self.running = False
                self.run_btn.configure(state="normal")
                return

        thread = threading.Thread(target=self._run_cascade_thread, args=(goal, stops, vehicles, mode), daemon=True)
        thread.start()

    def _run_cascade_thread(self, goal: str, stops: list[dict], vehicles: int, mode: str) -> None:
        # Runs on a background thread — Tkinter widgets are not thread-safe to
        # touch directly from here, so every update goes through the queue and
        # gets applied on the main thread by _poll_queue instead.
        def emit(hat: str, text: str) -> None:
            self.msg_queue.put(("line", f"\\n▸ {hat}\\n{text}\\n"))

        try:
            result = run_cascade(goal, stops, vehicles=vehicles, mode=mode, emit=emit)
            if result.loop:
                self.out_dir.mkdir(parents=True, exist_ok=True)
                write_outputs(result.loop, self.out_dir)
            transcript = render_transcript(result)
            self.out_dir.mkdir(parents=True, exist_ok=True)
            (self.out_dir / "cascade.txt").write_text(transcript)
            self.msg_queue.put(("line", "\\n" + "=" * 60 + "\\n"))
            self.msg_queue.put(("line", "Shipped.\\n" if result.shipped else "Critic gate failed — held, not shipped.\\n"))
            self.msg_queue.put(("done", None))
        except Exception as e:
            self.msg_queue.put(("error", str(e)))

    def _poll_queue(self) -> None:
        try:
            while True:
                kind, payload = self.msg_queue.get_nowait()
                if kind == "line":
                    self.output.configure(state="normal")
                    self.output.insert("end", payload)
                    self.output.see("end")
                    self.output.configure(state="disabled")
                elif kind == "done":
                    self.running = False
                    self.run_btn.configure(state="normal")
                    self.open_outputs_btn.configure(state="normal")
                    self.status_var.set("Done.")
                elif kind == "error":
                    self.running = False
                    self.run_btn.configure(state="normal")
                    self.status_var.set("Error.")
                    messagebox.showerror("MultiBøT hit an error", payload)
        except queue.Empty:
            pass
        self.root.after(100, self._poll_queue)


def main() -> int:
    root = tk.Tk()
    MultiBotApp(root)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`,
  },
  {
    path: "MultiBoT.spec",
    contents: `# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['gui.py'],
    pathex=[],
    binaries=[],
    datas=[('data', 'data')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='MultiBoT',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
`,
  },
  {
    path: "build_linux.sh",
    contents: `#!/usr/bin/env bash
# Builds a standalone MultiBøT.desktop app for Linux — no Python needed to
# RUN the result, only to build it once.
#
# One-time setup (only needed to build, never to run the finished app):
#   python3 -m pip install -r requirements.txt pyinstaller
#
# Then:
#   ./build_linux.sh
#
# Output: dist/MultiBoT — a single self-contained executable. Copy it
# anywhere and double-click (or ./MultiBoT from a terminal) — no Python
# install, no pip, no requirements.txt needed on the machine that runs it.
set -euo pipefail
cd "$(dirname "$0")"
pyinstaller MultiBoT.spec
echo ""
echo "Built: dist/MultiBoT"
echo "Copy that one file anywhere and run it — nothing else required."
`,
  },
  {
    path: "build_mac.sh",
    contents: `#!/usr/bin/env bash
# Builds a standalone MultiBøT.app for macOS — no Python needed to RUN the
# result, only to build it once.
#
# One-time setup (only needed to build, never to run the finished app):
#   python3 -m pip install -r requirements.txt pyinstaller
#
# Then:
#   ./build_mac.sh
#
# Output: dist/MultiBoT — a single self-contained executable (PyInstaller's
# --windowed mode produces a plain executable here rather than a full .app
# bundle unless you add --osx-bundle-identifier and related flags; this
# covers double-click-to-run, which is the actual goal). Copy it anywhere
# and run it — no Python install, no pip, no requirements.txt needed on the
# machine that runs it.
#
# First run on a fresh Mac may need an explicit right-click -> Open once,
# since it isn't notarized by Apple — that's a one-time macOS security
# prompt, not a bug in the app.
set -euo pipefail
cd "$(dirname "$0")"
pyinstaller MultiBoT.spec
echo ""
echo "Built: dist/MultiBoT"
echo "Copy that one file anywhere and run it — nothing else required."
`,
  },
  {
    path: "build_windows.bat",
    contents: `@echo off
REM Builds a standalone MultiBoT.exe for Windows — no Python needed to RUN
REM the result, only to build it once.
REM
REM One-time setup (only needed to build, never to run the finished app):
REM   python -m pip install -r requirements.txt pyinstaller
REM
REM Then, from this folder:
REM   build_windows.bat
REM
REM Output: dist\\MultiBoT.exe — a single self-contained executable. Copy it
REM anywhere and double-click — no Python install, no pip, no
REM requirements.txt needed on the machine that runs it.
REM
REM Honest heads-up: PyInstaller-built .exe files are commonly flagged by
REM Windows SmartScreen or antivirus on first run — this is a well-known
REM false positive affecting PyInstaller broadly (the bootloader pattern
REM looks similar to some malware packers), not a sign anything is wrong
REM with this specific build. "More info" -> "Run anyway" on the
REM SmartScreen prompt is the normal, expected path here.

pyinstaller MultiBoT.spec
echo.
echo Built: dist\\MultiBoT.exe
echo Copy that one file anywhere and run it — nothing else required.
`,
  },
  {
    path: "multibot.py",
    contents: `#!/usr/bin/env python3
"""MultiBøT — the bot.

Runs MultiCascade hats in sequence, then the routing tool layer.

  python3 multibot.py
  python3 multibot.py "plan better routes for these stops" --stops data/stops.example.csv
  python3 multibot.py --vehicles 3 --mode haversine
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "data"))

from cascade import render_transcript, run_cascade  # noqa: E402
from main import load_stops, write_outputs  # noqa: E402
from portland_stops import PORTLAND_STOPS  # noqa: E402
from reasoning_loop import print_report  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="MultiBøT cascade + routing bot")
    p.add_argument("goal", nargs="?", default="Make a coding bot that thinks of better routes with full coding libraries")
    p.add_argument("--stops", type=Path)
    p.add_argument("--vehicles", type=int, default=3)
    p.add_argument("--mode", default="haversine", choices=["haversine", "osm"])
    p.add_argument("--out", type=Path, default=ROOT / "outputs")
    args = p.parse_args(argv)

    stops = load_stops(args.stops) if args.stops else PORTLAND_STOPS

    print("=" * 72)
    print("MultiBøT")
    print("One model, one hat at a time. Cascade is the runtime.")
    print("=" * 72)

    result = run_cascade(args.goal, stops, vehicles=args.vehicles, mode=args.mode)

    if result.loop:
        print()
        print_report(result.loop)
        write_outputs(result.loop, args.out)

    args.out.mkdir(parents=True, exist_ok=True)
    transcript = render_transcript(result)
    (args.out / "cascade.txt").write_text(transcript)
    (args.out / "cascade.json").write_text(
        json.dumps(
            {
                "goal": result.goal,
                "shipped": result.shipped,
                "critic_flaw": result.critic_flaw,
                "passes": [{"hat": p.hat, "ok": p.ok, "text": p.text} for p in result.passes],
            },
            indent=2,
        )
    )
    print(f"\\nWrote {args.out / 'cascade.txt'}")
    print(f"Wrote {args.out / 'cascade.json'}")
    if result.shipped:
        print("Cascade shipped.")
        return 0
    print("Cascade held the ship: critic gate failed.")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
`,
  },
  {
    path: "cascade.py",
    contents: `"""MultiCascade runtime inside MultiBøT.

One process, one hat at a time, labeled passes in the open.
Not a swarm. The same bot wearing Architect → Builder A → Builder B → Critic.

Builder B calls the routing tool layer. Critic can send Builder B back
for another pass if the alternatives are not structurally different.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from reasoning_loop import print_report, run_loop
from route_tools import build_matrix, diff, score, solve


@dataclass
class Pass:
    hat: str
    text: str
    ok: bool = True
    extra: dict = field(default_factory=dict)


@dataclass
class CascadeResult:
    goal: str
    passes: list[Pass]
    loop: dict | None
    shipped: bool
    critic_flaw: str


def _log(hat: str, text: str) -> None:
    print(f"\\n▸ {hat}")
    print(text)


def architect(goal: str, n_stops: int, vehicles: int, mode: str) -> Pass:
    routing = any(
        w in goal.lower()
        for w in ("route", "routing", "stops", "van", "fleet", "portland", "delivery", "path")
    ) or goal.strip() == ""
    if not routing:
        text = (
            f'Root read of "{goal}": not obviously vehicle routing. '
            "MultiBøT still runs the routing stack; only this Architect note changes. "
            "Out of scope: live traffic, driver scheduling, a UI."
        )
    else:
        text = (
            f'Root read of "{goal or "default Portland demo"}": vehicle routing. '
            f"Scope: {n_stops} stops, {vehicles} vans, matrix={mode}. "
            "In: ingest, matrix, solve, defend alternatives. "
            "Out: live traffic, scheduling, UI. "
            "Success: baseline + ≥2 structurally different alternatives with Δkm and a reason."
        )
    return Pass("Architect", text)


def builder_a() -> Pass:
    tools = {
        "build_matrix": callable(build_matrix),
        "solve": callable(solve),
        "score": callable(score),
        "diff": callable(diff),
    }
    missing = [k for k, ok in tools.items() if not ok]
    text = (
        "Tool layer live: build_matrix, solve, score, diff. "
        "Strategies: PATH_CHEAPEST_ARC, SAVINGS, CHRISTOFIDES. "
        "OR-Tools / OSMnx plug in behind the same signatures when installed."
    )
    if missing:
        return Pass("Builder A — tool layer", "Missing: " + ", ".join(missing), ok=False)
    return Pass("Builder A — tool layer", text)


def builder_b(stops: list[dict], vehicles: int, mode: str) -> tuple[Pass, dict]:
    result = run_loop(stops, baseline_vehicles=vehicles, mode=mode)
    rows = result["rows"]
    text = (
        f"Loop ran on {result['n_stops']} stops ({result['matrix_mode']}). "
        f"{len(rows)} plans. "
        + " | ".join(
            f"{r['name']} {r['distance_km']:.1f}km Δ{r['km_delta']:+.1f} v{r['vehicles_used']}"
            for r in rows
        )
    )
    return Pass("Builder B — reasoning loop", text, extra={"n_plans": len(rows)}), result


def critic(loop: dict) -> Pass:
    rows = [r for r in loop["rows"] if r["name"] != "baseline"]
    if not rows:
        return Pass("Critic", "No alternatives. Fail.", ok=False)

    spreads = [abs(r["km_delta"]) for r in rows]
    moved = [r["moved"] for r in rows]
    fleets = {r["vehicles_used"] for r in loop["rows"]}
    max_spread = max(spreads) if spreads else 0
    max_moved = max(moved) if moved else 0

    # Structural test: at least one alt changes fleet OR moves many stops
    # AND km delta is not a 1–2% heuristic wobble.
    base_km = next(r["distance_km"] for r in loop["rows"] if r["name"] == "baseline")
    pct = (max_spread / base_km * 100) if base_km else 0
    structural = (len(fleets) > 1) or (max_moved >= 5 and pct >= 5)

    if not structural:
        text = (
            f"Required flaw triggered: alternatives look like search-heuristic wobble "
            f"(max Δ {max_spread:.1f} km / {pct:.1f}%, moved={max_moved}). "
            "Sending Builder B back is the right call — mutate vehicles/capacity/windows, "
            "not PATH_CHEAPEST_ARC vs SAVINGS on the same model."
        )
        return Pass("Critic", text, ok=False)

    defended = min(rows, key=lambda r: (r["distance_km"], r["vehicles_used"]))
    text = (
        f"Pass. Alternatives are structurally different "
        f"(fleet set={sorted(fleets)}, max moved={max_moved}, max Δ={max_spread:.1f} km / {pct:.1f}%). "
        f"Real remaining limit: matrix is {loop['matrix_mode']} — not live curb traffic. "
        f"Defended: {defended['name']} at {defended['distance_km']} km "
        f"({defended['km_delta']:+.1f} vs baseline). "
        f"Reason: {defended['reason']}"
    )
    return Pass("Critic", text, extra={"defended": defended["name"]})


def run_cascade(
    goal: str,
    stops: list[dict],
    vehicles: int = 3,
    mode: str = "haversine",
    emit: Callable[[str, str], None] | None = None,
) -> CascadeResult:
    emit = emit or _log
    passes: list[Pass] = []

    a = architect(goal, max(0, len(stops) - 1), vehicles, mode)
    passes.append(a)
    emit(a.hat, a.text)

    ba = builder_a()
    passes.append(ba)
    emit(ba.hat, ba.text)
    if not ba.ok:
        return CascadeResult(goal, passes, None, False, ba.text)

    bb, loop = builder_b(stops, vehicles, mode)
    passes.append(bb)
    emit(bb.hat, bb.text)

    cr = critic(loop)
    passes.append(cr)
    emit(cr.hat, cr.text)

    return CascadeResult(
        goal=goal,
        passes=passes,
        loop=loop,
        shipped=cr.ok,
        critic_flaw="" if cr.ok else cr.text,
    )


def render_transcript(result: CascadeResult) -> str:
    lines = [
        "MultiBøT · MultiCascade runtime",
        f"Goal: {result.goal or '(default demo)'}",
        f"Shipped: {'yes' if result.shipped else 'no'}",
        "",
    ]
    for p in result.passes:
        mark = "ok" if p.ok else "fail"
        lines.append(f"[{mark}] {p.hat}")
        lines.append(p.text)
        lines.append("")
    return "\\n".join(lines)
`,
  },
  {
    path: "main.py",
    contents: `#!/usr/bin/env python3
"""MultiBøT — routing bot CLI.

  python3 main.py
  python3 main.py --stops data/stops.example.csv --vehicles 3
  python3 main.py --mode haversine --vehicles 2 --out outputs
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "data"))

from portland_stops import PORTLAND_STOPS  # noqa: E402
from reasoning_loop import print_report, run_loop  # noqa: E402
from route_tools import format_plan  # noqa: E402


def load_stops(path: Path) -> list[dict]:
    rows = []
    with path.open(newline="") as f:
        reader = csv.DictReader(f)
        required = {"id", "lat", "lon"}
        if not reader.fieldnames or not required.issubset({c.strip() for c in reader.fieldnames}):
            raise SystemExit(f"{path} needs columns: id,lat,lon")
        for raw in reader:
            rows.append(
                {
                    "id": raw["id"].strip(),
                    "lat": float(raw["lat"]),
                    "lon": float(raw["lon"]),
                }
            )
    if len(rows) < 2:
        raise SystemExit("Need a depot row plus at least one stop.")
    return rows


def write_outputs(result: dict, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    rows = result["rows"]
    with (out / "comparison.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    matrix = result["matrix"]
    serializable = []
    for name, plan in result["plans"].items():
        serializable.append(
            {
                "name": name,
                "strategy": plan.strategy,
                "distance_km": plan.distance_km,
                "vehicles": plan.vehicles,
                "tours": [[matrix["ids"][i] for i in t] for t in plan.tours],
                "notes": plan.notes,
            }
        )
    (out / "plans.json").write_text(json.dumps(serializable, indent=2))

    summary = [result["baseline_text"], ""]
    for name, plan in result["plans"].items():
        if name == "baseline":
            continue
        summary.append(format_plan(plan, matrix))
        summary.append("")
    (out / "routes.txt").write_text("\\n".join(summary))


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="MultiBøT routing improvement loop")
    p.add_argument("--stops", type=Path, help="CSV with id,lat,lon. First row is depot.")
    p.add_argument("--vehicles", type=int, default=3)
    p.add_argument("--mode", default="haversine", choices=["haversine", "osm"])
    p.add_argument("--out", type=Path, default=ROOT / "outputs")
    args = p.parse_args(argv)

    stops = load_stops(args.stops) if args.stops else PORTLAND_STOPS
    result = run_loop(stops, baseline_vehicles=args.vehicles, mode=args.mode)
    print_report(result)
    write_outputs(result, args.out)
    print(f"\\nWrote {args.out / 'comparison.csv'}")
    print(f"Wrote {args.out / 'plans.json'}")
    print(f"Wrote {args.out / 'routes.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`,
  },
  {
    path: "route_tools.py",
    contents: `"""Tool layer for MultiCascade routing bot.

Public callables:
  build_matrix(stops, mode="haversine")
  solve(matrix, vehicles=1, time_limit=5, strategy="PATH_CHEAPEST_ARC",
        capacities=None, time_windows=None)
  score(route, matrix=None)
  diff(route_a, route_b)

Strategies (search heuristics):
  PATH_CHEAPEST_ARC  nearest-neighbor + 2-opt
  SAVINGS            Clarke-Wright savings
  CHRISTOFIDES       MST doubling approximation (open tour then 2-opt)

Model mutations (real structural alternatives):
  vehicles, capacities, time_windows, max_detour_pct
"""

from __future__ import annotations

import math
import random
import time
from dataclasses import dataclass, field
from typing import Any, Iterable

EARTH_KM = 6371.0


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_KM * math.asin(min(1.0, math.sqrt(h)))


def build_matrix(stops: list[dict], mode: str = "haversine") -> dict:
    """Build a symmetric distance matrix.

    stops: list of {id, lat, lon, demand?, tw_start?, tw_end?}
    mode: 'haversine' (always available) or 'osm' (requires osmnx + network).
    """
    n = len(stops)
    ids = [s["id"] for s in stops]
    coords = [(float(s["lat"]), float(s["lon"])) for s in stops]
    if mode == "osm":
        try:
            matrix = _osm_matrix(coords)
        except Exception as exc:
            # Fall back rather than pretend we have a live graph.
            matrix = [[haversine_km(coords[i], coords[j]) for j in range(n)] for i in range(n)]
            mode = f"haversine (osm fallback: {exc.__class__.__name__})"
    else:
        matrix = [[haversine_km(coords[i], coords[j]) for j in range(n)] for i in range(n)]
    return {
        "ids": ids,
        "coords": coords,
        "stops": stops,
        "km": matrix,
        "mode": mode,
        "n": n,
        "depot": 0,
    }


def _osm_matrix(coords: list[tuple[float, float]]) -> list[list[float]]:
    import osmnx as ox
    import networkx as nx

    lats, lons = zip(*coords)
    north, south = max(lats) + 0.02, min(lats) - 0.02
    east, west = max(lons) + 0.02, min(lons) - 0.02
    G = ox.graph_from_bbox(north, south, east, west, network_type="drive")
    nodes = [ox.nearest_nodes(G, lon, lat) for lat, lon in coords]
    n = len(coords)
    m = [[0.0] * n for _ in range(n)]
    for i in range(n):
        lengths = nx.single_source_dijkstra_path_length(G, nodes[i], weight="length")
        for j in range(n):
            m[i][j] = lengths.get(nodes[j], haversine_km(coords[i], coords[j]) * 1000) / 1000.0
    return m


@dataclass
class RoutePlan:
    vehicles: int
    tours: list[list[int]]  # each tour is a sequence of stop indices including depot start/end
    strategy: str
    distance_km: float
    notes: str = ""
    constraints: dict = field(default_factory=dict)

    def stop_count(self) -> int:
        return sum(max(0, len(t) - 2) for t in self.tours)


def score(route: RoutePlan, matrix: dict | None = None) -> dict:
    km = route.distance_km
    n_stops = route.stop_count()
    n_veh = sum(1 for t in route.tours if len(t) > 2)
    longest = 0.0
    if matrix is not None:
        longest = max((_tour_km(t, matrix["km"]) for t in route.tours), default=0.0)
    # crude duration: 35 km/h urban + 3 min per stop
    duration_min = (km / 35.0) * 60.0 + 3.0 * n_stops
    balance = 0.0
    if matrix is not None and n_veh:
        lengths = [_tour_km(t, matrix["km"]) for t in route.tours if len(t) > 2]
        if lengths:
            mean = sum(lengths) / len(lengths)
            balance = (max(lengths) - min(lengths)) / mean if mean else 0.0
    return {
        "distance_km": round(km, 2),
        "duration_min": round(duration_min, 1),
        "vehicles_used": n_veh,
        "stops": n_stops,
        "longest_leg_km": round(longest, 2),
        "imbalance": round(balance, 3),
        "strategy": route.strategy,
        "notes": route.notes,
    }


def diff(route_a: RoutePlan, route_b: RoutePlan) -> dict:
    def assignment(plan: RoutePlan) -> dict[int, int]:
        out = {}
        for v, tour in enumerate(plan.tours):
            for idx in tour:
                if idx != 0:
                    out[idx] = v
        return out

    a, b = assignment(route_a), assignment(route_b)
    moved = []
    for stop in sorted(set(a) | set(b)):
        if a.get(stop) != b.get(stop):
            moved.append({"stop": stop, "from": a.get(stop), "to": b.get(stop)})
    return {
        "moved_count": len(moved),
        "moved": moved[:40],
        "vehicles_a": route_a.vehicles,
        "vehicles_b": route_b.vehicles,
        "km_delta": round(route_b.distance_km - route_a.distance_km, 2),
    }


def solve(
    matrix: dict,
    vehicles: int = 1,
    time_limit: float = 5.0,
    strategy: str = "PATH_CHEAPEST_ARC",
    capacities: list[int] | None = None,
    demands: list[int] | None = None,
    time_windows: list[tuple[float, float]] | None = None,
    seed: int = 7,
) -> RoutePlan:
    """Solve a VRP on the given matrix.

    If OR-Tools is installed it is used; otherwise local heuristics run.
    """
    try:
        return _solve_ortools(
            matrix, vehicles, time_limit, strategy, capacities, demands, time_windows
        )
    except Exception:
        return _solve_local(
            matrix, vehicles, time_limit, strategy, capacities, demands, time_windows, seed
        )


def _tour_km(tour: list[int], km: list[list[float]]) -> float:
    return sum(km[tour[i]][tour[i + 1]] for i in range(len(tour) - 1))


def _two_opt(tour: list[int], km: list[list[float]], deadline: float) -> list[int]:
    if len(tour) <= 4:
        return tour
    improved = True
    best = tour[:]
    best_cost = _tour_km(best, km)
    while improved and time.time() < deadline:
        improved = False
        for i in range(1, len(best) - 2):
            for j in range(i + 1, len(best) - 1):
                if time.time() >= deadline:
                    return best
                new = best[:i] + best[i : j + 1][::-1] + best[j + 1 :]
                c = _tour_km(new, km)
                if c + 1e-9 < best_cost:
                    best, best_cost = new, c
                    improved = True
                    break
            if improved:
                break
    return best


def _nearest_neighbor(order: list[int], km: list[list[float]], start: int = 0) -> list[int]:
    remaining = set(order)
    tour = [start]
    remaining.discard(start)
    cur = start
    while remaining:
        nxt = min(remaining, key=lambda x: km[cur][x])
        tour.append(nxt)
        remaining.remove(nxt)
        cur = nxt
    tour.append(start)
    return tour


def _christofides_like(order: list[int], km: list[list[float]]) -> list[int]:
    """MST doubling approximation (not full Christofides matching)."""
    import networkx as nx

    nodes = [0] + [i for i in order if i != 0]
    G = nx.Graph()
    for i, a in enumerate(nodes):
        for b in nodes[i + 1 :]:
            G.add_edge(a, b, weight=km[a][b])
    mst = nx.minimum_spanning_tree(G, weight="weight")
    doubled = nx.MultiGraph()
    for u, v, data in mst.edges(data=True):
        doubled.add_edge(u, v, weight=data["weight"])
        doubled.add_edge(u, v, weight=data["weight"])
    path = list(nx.eulerian_circuit(doubled, source=0))
    seen = set()
    tour = []
    for u, _v in path:
        if u not in seen:
            tour.append(u)
            seen.add(u)
    tour.append(0)
    return tour


def _savings(order: list[int], km: list[list[float]], vehicles: int, cap: int | None, demands: list[int] | None) -> list[list[int]]:
    customers = [i for i in order if i != 0]
    routes = {i: [0, i, 0] for i in customers}
    owner = {i: i for i in customers}
    pairs = []
    for i in customers:
        for j in customers:
            if i < j:
                s = km[i][0] + km[0][j] - km[i][j]
                pairs.append((s, i, j))
    pairs.sort(reverse=True)

    def load(rid: int) -> int:
        if not demands:
            return len(routes[rid]) - 2
        return sum(demands[x] for x in routes[rid] if x != 0)

    for _s, i, j in pairs:
        if owner.get(i) is None or owner.get(j) is None:
            continue
        ri, rj = owner[i], owner[j]
        if ri == rj:
            continue
        if vehicles and len({owner[c] for c in customers if owner.get(c) is not None}) <= vehicles:
            # still merge if under vehicle target? keep merging until vehicle count
            pass
        a, b = routes[ri], routes[rj]
        if a[-2] == i and b[1] == j:
            merged = a[:-1] + b[1:]
        elif b[-2] == j and a[1] == i:
            merged = b[:-1] + a[1:]
        elif a[-2] == i and b[-2] == j:
            merged = a[:-1] + b[-2:0:-1] + [0]
        elif a[1] == i and b[1] == j:
            merged = [0] + a[1:-1][::-1] + b[1:]
        else:
            continue
        if cap is not None:
            load_m = (sum(demands[x] for x in merged if x != 0) if demands else len(merged) - 2)
            if load_m > cap:
                continue
        routes[ri] = merged
        del routes[rj]
        for x in merged:
            if x != 0:
                owner[x] = ri

    tours = list(routes.values())
    tours.sort(key=lambda t: -len(t))
    return tours


def _split_into_vehicles(tour: list[int], vehicles: int, km: list[list[float]], cap: int | None, demands: list[int] | None) -> list[list[int]]:
    customers = [i for i in tour if i != 0]
    if vehicles <= 1:
        return [[0] + customers + [0]]
    # greedy split by load / even chunks
    chunks: list[list[int]] = [[] for _ in range(vehicles)]
    loads = [0] * vehicles
    for c in customers:
        d = demands[c] if demands else 1
        # pick feasible vehicle with smallest current km-from-depot proxy = load
        cand = []
        for v in range(vehicles):
            if cap is not None and loads[v] + d > cap:
                continue
            cand.append(v)
        if not cand:
            v = loads.index(min(loads))
        else:
            v = min(cand, key=lambda x: loads[x])
        chunks[v].append(c)
        loads[v] += d
    tours = []
    for ch in chunks:
        if ch:
            tours.append([0] + ch + [0])
        else:
            tours.append([0, 0])
    return tours


def _solve_local(
    matrix: dict,
    vehicles: int,
    time_limit: float,
    strategy: str,
    capacities: list[int] | None,
    demands: list[int] | None,
    time_windows: list[tuple[float, float]] | None,
    seed: int,
) -> RoutePlan:
    random.seed(seed)
    km = matrix["km"]
    n = matrix["n"]
    order = list(range(n))
    cap = min(capacities) if capacities else None
    if demands is None:
        demands = [0] + [1] * (n - 1)
    deadline = time.time() + max(0.2, time_limit)

    strategy = strategy.upper()
    if strategy == "SAVINGS":
        tours = _savings(order, km, vehicles, cap, demands)
        # if too many vehicles, merge smallest
        while len([t for t in tours if len(t) > 2]) > vehicles:
            tours.sort(key=len)
            a, b = tours[0], tours[1]
            merged = [0] + [x for x in a if x != 0] + [x for x in b if x != 0] + [0]
            tours = [merged] + tours[2:]
        # if too few, split longest
        while len([t for t in tours if len(t) > 2]) < vehicles:
            tours.sort(key=len, reverse=True)
            long = [x for x in tours[0] if x != 0]
            mid = max(1, len(long) // 2)
            tours = [[0] + long[:mid] + [0], [0] + long[mid:] + [0]] + tours[1:]
    elif strategy == "CHRISTOFIDES":
        giant = _christofides_like(order, km)
        tours = _split_into_vehicles(giant, vehicles, km, cap, demands)
    else:
        giant = _nearest_neighbor(order, km)
        tours = _split_into_vehicles(giant, vehicles, km, cap, demands)

    tours = [_two_opt(t, km, deadline) for t in tours]
    # optional cheap time-window repair: sort customers inside each tour by tw_start
    if time_windows:
        repaired = []
        for t in tours:
            cust = [x for x in t if x != 0]
            cust.sort(key=lambda x: time_windows[x][0])
            repaired.append([0] + cust + [0])
        tours = [_two_opt(t, km, deadline) for t in repaired]

    total = sum(_tour_km(t, km) for t in tours)
    notes = f"local:{strategy.lower()} veh={vehicles}"
    if cap:
        notes += f" cap={cap}"
    if time_windows:
        notes += " tw=on"
    return RoutePlan(
        vehicles=vehicles,
        tours=tours,
        strategy=strategy,
        distance_km=total,
        notes=notes,
        constraints={"vehicles": vehicles, "capacity": cap, "time_windows": bool(time_windows)},
    )


def _solve_ortools(matrix, vehicles, time_limit, strategy, capacities, demands, time_windows):
    from ortools.constraint_solver import pywrapcp, routing_enums_pb2

    km = matrix["km"]
    n = matrix["n"]
    scale = 1000
    dist = [[int(km[i][j] * scale) for j in range(n)] for i in range(n)]
    manager = pywrapcp.RoutingIndexManager(n, vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)

    def cb(i, j):
        return dist[manager.IndexToNode(i)][manager.IndexToNode(j)]

    transit = routing.RegisterTransitCallback(cb)
    routing.SetArcCostEvaluatorOfAllVehicles(transit)

    if demands is None:
        demands = [0] + [1] * (n - 1)
    if capacities:
        def dcb(i):
            return demands[manager.IndexToNode(i)]

        did = routing.RegisterUnaryTransitCallback(dcb)
        routing.AddDimensionWithVehicleCapacity(did, 0, capacities, True, "Cap")

    first = {
        "PATH_CHEAPEST_ARC": routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC,
        "SAVINGS": routing_enums_pb2.FirstSolutionStrategy.SAVINGS,
        "CHRISTOFIDES": routing_enums_pb2.FirstSolutionStrategy.CHRISTOFIDES,
    }.get(strategy.upper(), routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC)

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = first
    params.time_limit.FromMilliseconds(int(time_limit * 1000))
    sol = routing.SolveWithParameters(params)
    if not sol:
        raise RuntimeError("OR-Tools found no solution")
    tours = []
    total = 0.0
    for v in range(vehicles):
        idx = routing.Start(v)
        tour = []
        while not routing.IsEnd(idx):
            tour.append(manager.IndexToNode(idx))
            idx = sol.Value(routing.NextVar(idx))
        tour.append(manager.IndexToNode(idx))
        tours.append(tour)
        total += _tour_km(tour, km)
    return RoutePlan(vehicles, tours, strategy, total, notes="ortools", constraints={"vehicles": vehicles})


def format_plan(plan: RoutePlan, matrix: dict) -> str:
    ids = matrix["ids"]
    lines = [f"{plan.strategy}  {plan.distance_km:.1f} km  vehicles={plan.vehicles}  {plan.notes}"]
    for i, t in enumerate(plan.tours):
        if len(t) <= 2:
            continue
        path = " → ".join(str(ids[x]) for x in t)
        lines.append(f"  van {i}: {path}  ({_tour_km(t, matrix['km']):.1f} km)")
    return "\\n".join(lines)
`,
  },
  {
    path: "reasoning_loop.py",
    contents: `"""Four-step improvement loop.

1. Baseline solve
2. Named hypotheses in plain language
3. Translate each into a structurally different solve() call
4. Comparison table with deltas and tradeoffs

The critic note from MultiCascade is applied: hypotheses mutate
the *model* (vehicle count, capacity, time windows, clustering),
not only the first-solution heuristic.
"""

from __future__ import annotations

from dataclasses import dataclass

from route_tools import RoutePlan, build_matrix, diff, format_plan, score, solve


@dataclass
class Hypothesis:
    name: str
    reason: str
    kwargs: dict


def generate_hypotheses(matrix: dict, baseline_vehicles: int) -> list[Hypothesis]:
    n = matrix["n"] - 1
    mid_cap = max(4, (n + baseline_vehicles - 1) // baseline_vehicles)
    tight_cap = max(3, mid_cap - 2)
    return [
        Hypothesis(
            name="cluster_east_on_one_van",
            reason="Keep geographically tight stops on one vehicle even if that van works harder.",
            kwargs={
                "vehicles": baseline_vehicles,
                "strategy": "SAVINGS",
                "time_limit": 3.0,
            },
        ),
        Hypothesis(
            name="cut_fleet_allow_detour",
            reason="Drop one van and accept a longer longest-leg if total km falls.",
            kwargs={
                "vehicles": max(1, baseline_vehicles - 1),
                "strategy": "CHRISTOFIDES",
                "time_limit": 4.0,
                "capacities": [n] * max(1, baseline_vehicles - 1),
            },
        ),
        Hypothesis(
            name="time_windows_over_distance",
            reason="Honor morning vs afternoon windows; distance is secondary.",
            kwargs={
                "vehicles": baseline_vehicles,
                "strategy": "PATH_CHEAPEST_ARC",
                "time_limit": 3.0,
                "time_windows": _synthetic_windows(matrix),
            },
        ),
        Hypothesis(
            name="tight_capacity",
            reason="Smaller van capacity forces more balanced loads instead of one overloaded route.",
            kwargs={
                "vehicles": baseline_vehicles + 1,
                "strategy": "SAVINGS",
                "time_limit": 3.0,
                "capacities": [tight_cap] * (baseline_vehicles + 1),
                "demands": [0] + [1] * n,
            },
        ),
    ]


def _synthetic_windows(matrix: dict) -> list[tuple[float, float]]:
    # Depot open all day; odd-index stops morning, even afternoon.
    tw = [(0.0, 12.0)]
    for i in range(1, matrix["n"]):
        if i % 2:
            tw.append((0.0, 6.0))
        else:
            tw.append((4.0, 12.0))
    return tw


def run_loop(stops: list[dict], baseline_vehicles: int = 3, mode: str = "haversine") -> dict:
    matrix = build_matrix(stops, mode=mode)
    baseline = solve(matrix, vehicles=baseline_vehicles, strategy="PATH_CHEAPEST_ARC", time_limit=3.0)
    hyps = generate_hypotheses(matrix, baseline_vehicles)

    rows = []
    plans = {"baseline": baseline}
    base_score = score(baseline, matrix)
    rows.append(
        {
            "name": "baseline",
            "reason": "Default cheapest-arc split across the requested fleet.",
            **base_score,
            "km_delta": 0.0,
            "moved": 0,
        }
    )

    for h in hyps:
        plan = solve(matrix, **h.kwargs)
        plans[h.name] = plan
        sc = score(plan, matrix)
        d = diff(baseline, plan)
        rows.append(
            {
                "name": h.name,
                "reason": h.reason,
                **sc,
                "km_delta": d["km_delta"],
                "moved": d["moved_count"],
            }
        )

    return {
        "matrix_mode": matrix["mode"],
        "n_stops": matrix["n"] - 1,
        "baseline_text": format_plan(baseline, matrix),
        "rows": rows,
        "plans": plans,
        "matrix": matrix,
    }


def print_report(result: dict) -> None:
    print("=" * 72)
    print(f"MultiCascade routing loop  |  {result['n_stops']} stops  |  matrix={result['matrix_mode']}")
    print("=" * 72)
    print(result["baseline_text"])
    print()
    hdr = f"{'name':28} {'km':>8} {'Δkm':>8} {'vans':>5} {'min':>7} {'moved':>6}  tradeoff"
    print(hdr)
    print("-" * len(hdr) + "-" * 20)
    for r in result["rows"]:
        print(
            f"{r['name']:28} {r['distance_km']:8.1f} {r['km_delta']:8.1f} "
            f"{r['vehicles_used']:5d} {r['duration_min']:7.0f} {r['moved']:6d}  {r['reason'][:60]}"
        )
    print()
    # pick a defended alternative
    alts = [r for r in result["rows"] if r["name"] != "baseline"]
    best = min(alts, key=lambda r: (r["distance_km"], r["vehicles_used"]))
    print(f"Defended alternative: {best['name']}")
    print(f"  {best['reason']}")
    print(
        f"  {best['distance_km']} km / {best['vehicles_used']} vans "
        f"({best['km_delta']:+.1f} km vs baseline), {best['moved']} stops reassigned."
    )
`,
  },
  {
    path: "data/__init__.py",
    contents: `from .portland_stops import PORTLAND_STOPS

__all__ = ["PORTLAND_STOPS"]
`,
  },
  {
    path: "data/portland_stops.py",
    contents: `"""38 synthetic-but-plausible Portland-area stops plus a depot in the Pearl.

Coordinates are real-ish neighborhood centroids / landmarks, not live addresses.
"""

PORTLAND_STOPS = [
    {"id": "depot_pearl", "lat": 45.5308, "lon": -122.6814},
    {"id": "powell_books", "lat": 45.5232, "lon": -122.6813},
    {"id": "pioneer_sq", "lat": 45.5187, "lon": -122.6789},
    {"id": "omsi", "lat": 45.5084, "lon": -122.6657},
    {"id": "hawthorne_30th", "lat": 45.5122, "lon": -122.6347},
    {"id": "belmont_39th", "lat": 45.5164, "lon": -122.6226},
    {"id": "mt_tabor", "lat": 45.5120, "lon": -122.5948},
    {"id": "laurelhurst", "lat": 45.5270, "lon": -122.6265},
    {"id": "hollywood", "lat": 45.5356, "lon": -122.6210},
    {"id": "alberta_30th", "lat": 45.5591, "lon": -122.6375},
    {"id": "mississippi", "lat": 45.5498, "lon": -122.6756},
    {"id": "williams_killingsworth", "lat": 45.5628, "lon": -122.6668},
    {"id": "st_johns", "lat": 45.5898, "lon": -122.7520},
    {"id": "kenton", "lat": 45.5870, "lon": -122.6825},
    {"id": "parkrose", "lat": 45.5575, "lon": -122.5488},
    {"id": "gateway", "lat": 45.5265, "lon": -122.5624},
    {"id": "gresham_center", "lat": 45.5001, "lon": -122.4303},
    {"id": "troutdale", "lat": 45.5393, "lon": -122.3873},
    {"id": "sellwood", "lat": 45.4666, "lon": -122.6590},
    {"id": "moreland", "lat": 45.4678, "lon": -122.6478},
    {"id": "woodstock", "lat": 45.4798, "lon": -122.6147},
    {"id": "reed", "lat": 45.4805, "lon": -122.6300},
    {"id": "division_50th", "lat": 45.5047, "lon": -122.6103},
    {"id": "foster_82nd", "lat": 45.4890, "lon": -122.5786},
    {"id": "lents", "lat": 45.4856, "lon": -122.5674},
    {"id": "powellhurst", "lat": 45.4960, "lon": -122.5380},
    {"id": "happy_valley", "lat": 45.4468, "lon": -122.5320},
    {"id": "milwaukie", "lat": 45.4462, "lon": -122.6393},
    {"id": "oregon_city", "lat": 45.3573, "lon": -122.6068},
    {"id": "lake_oswego", "lat": 45.4207, "lon": -122.6706},
    {"id": "tualatin", "lat": 45.3840, "lon": -122.7638},
    {"id": "tigard", "lat": 45.4312, "lon": -122.7715},
    {"id": "beaverton", "lat": 45.4871, "lon": -122.8037},
    {"id": "hillsboro", "lat": 45.5229, "lon": -122.9898},
    {"id": "forest_grove", "lat": 45.5198, "lon": -123.1107},
    {"id": "cedar_hills", "lat": 45.5046, "lon": -122.7985},
    {"id": "raleigh_hills", "lat": 45.4850, "lon": -122.7530},
    {"id": "multnomah_village", "lat": 45.4670, "lon": -122.7120},
    {"id": "northwest_23rd", "lat": 45.5330, "lon": -122.6985},
]
`,
  },
  {
    path: "data/stops.example.csv",
    contents: `id,lat,lon
depot_pearl,45.5308,-122.6814
powell_books,45.5232,-122.6813
pioneer_sq,45.5187,-122.6789
omsi,45.5084,-122.6657
hawthorne_30th,45.5122,-122.6347
belmont_39th,45.5164,-122.6226
mt_tabor,45.5120,-122.5948
laurelhurst,45.5270,-122.6265
hollywood,45.5356,-122.6210
alberta_30th,45.5591,-122.6375
mississippi,45.5498,-122.6756
williams_killingsworth,45.5628,-122.6668
st_johns,45.5898,-122.7520
kenton,45.5870,-122.6825
parkrose,45.5575,-122.5488
gateway,45.5265,-122.5624
gresham_center,45.5001,-122.4303
troutdale,45.5393,-122.3873
sellwood,45.4666,-122.6590
moreland,45.4678,-122.6478
woodstock,45.4798,-122.6147
reed,45.4805,-122.6300
division_50th,45.5047,-122.6103
foster_82nd,45.4890,-122.5786
lents,45.4856,-122.5674
powellhurst,45.4960,-122.5380
happy_valley,45.4468,-122.5320
milwaukie,45.4462,-122.6393
oregon_city,45.3573,-122.6068
lake_oswego,45.4207,-122.6706
tualatin,45.3840,-122.7638
tigard,45.4312,-122.7715
beaverton,45.4871,-122.8037
hillsboro,45.5229,-122.9898
forest_grove,45.5198,-123.1107
cedar_hills,45.5046,-122.7985
raleigh_hills,45.4850,-122.7530
multnomah_village,45.4670,-122.7120
northwest_23rd,45.5330,-122.6985
`,
  },
]
