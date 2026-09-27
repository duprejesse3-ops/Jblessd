# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Runs confirmed shell commands and captures their output. No hidden retries,
no silent continuation past a failure -- if one command in a plan fails, the
rest are skipped and reported as not run, so a partially-applied change never
gets narrated as if it fully succeeded.

Shell selection is explicit, not left to Python's `shell=True` default:
`subprocess.run(cmd, shell=True)` on Linux runs `/bin/sh` (often `dash` on
Debian/Kali, not bash), while the agent (lib/agent.py) is told the shell is
"bash" and may emit bash-only syntax (`[[ ]]`, arrays, `source`, brace
expansion). That mismatch would make some correct plans fail with a syntax
error. Likewise `shell=True` on Windows runs `cmd.exe`, not PowerShell, even
though the agent is told PowerShell and writes PowerShell syntax. This module
builds the actual interpreter invocation explicitly on both platforms so what
runs always matches what the agent was told it could write.
"""
import os
import shutil
import subprocess
from dataclasses import dataclass, field

from .config import WORK_DIR, is_windows
from .i18n import DEFAULT_LANGUAGE, get as get_strings

COMMAND_TIMEOUT_SECONDS = 120
OUTPUT_TRUNCATE_CHARS = 4000


@dataclass
class CommandResult:
    command: str
    returncode: int
    stdout: str
    stderr: str
    ran: bool = True
    error: str = ""


@dataclass
class RunReport:
    results: list = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return all(r.ran and r.returncode == 0 for r in self.results)

    def spoken_summary(self, language: str = DEFAULT_LANGUAGE) -> str:
        strings = get_strings(language)
        ran = [r for r in self.results if r.ran]
        failed = [r for r in ran if r.returncode != 0]
        skipped = [r for r in self.results if not r.ran]
        if not failed and not skipped:
            noun = strings["command_singular"] if len(ran) == 1 else strings["command_plural"]
            return f"{strings['done_prefix']} {len(ran)} {noun} {strings['ran_successfully']}"
        parts = []
        if failed:
            parts.append(f"{len(failed)} {strings['failed_word']}")
        if skipped:
            parts.append(f"{len(skipped)} {strings['skipped_word']}")
        return strings["stopped_prefix"] + " " + ", ".join(parts) + "."


def _truncate(s: str) -> str:
    if len(s) <= OUTPUT_TRUNCATE_CHARS:
        return s
    return s[:OUTPUT_TRUNCATE_CHARS] + f"\n...[truncated, {len(s) - OUTPUT_TRUNCATE_CHARS} more chars]"


def _build_argv(command: str) -> list:
    """Returns the actual argv to exec for one command string, matching
    whichever shell the agent was told about in lib/agent.py's system prompt.
    """
    if is_windows():
        exe = shutil.which("pwsh") or shutil.which("powershell") or "powershell"
        return [exe, "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command]
    # Prefer a real bash over whatever /bin/sh happens to symlink to (dash on
    # Debian/Kali, which doesn't support the bash-only syntax the agent may
    # emit). Falls back to sh only if bash genuinely isn't installed anywhere
    # on this machine -- rare, but better to run something than nothing.
    exe = shutil.which("bash") or ("/bin/bash" if os.path.exists("/bin/bash") else None) or shutil.which("sh") or "/bin/sh"
    return [exe, "-c", command]


def run_commands(commands: list, work_dir: str = None) -> RunReport:
    """Runs each command in order, stopping at the first non-zero exit so a
    later command never runs against a state the earlier one failed to reach.
    """
    cwd = work_dir or WORK_DIR
    report = RunReport()
    stop = False
    for cmd in commands:
        if stop:
            report.results.append(CommandResult(command=cmd, returncode=-1, stdout="", stderr="", ran=False))
            continue
        try:
            proc = subprocess.run(
                _build_argv(cmd),
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=COMMAND_TIMEOUT_SECONDS,
            )
            result = CommandResult(
                command=cmd,
                returncode=proc.returncode,
                stdout=_truncate(proc.stdout),
                stderr=_truncate(proc.stderr),
                ran=True,
            )
        except subprocess.TimeoutExpired:
            result = CommandResult(
                command=cmd, returncode=-1, stdout="", stderr="", ran=True,
                error=f"Timed out after {COMMAND_TIMEOUT_SECONDS}s",
            )
        except OSError as err:
            result = CommandResult(command=cmd, returncode=-1, stdout="", stderr="", ran=True, error=str(err))

        report.results.append(result)
        if result.returncode != 0:
            stop = True
    return report
