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

Output streams live instead of only after the command finishes -- a build or
install that takes a while used to look hung until the whole thing completed
or the fixed timeout killed it. Streaming is done with a reader thread per
pipe (stdout, stderr) so the overall wall-clock timeout is still enforced even
when the child process goes quiet for a while, not just when it's spewing
output.
"""
import os
import queue
import shutil
import subprocess
import threading
import time
from dataclasses import dataclass, field

from . import config
from .config import WORK_DIR, is_windows
from .i18n import DEFAULT_LANGUAGE, get as get_strings

# Kept for backward compatibility with anything importing the old constant
# directly; config.COMMAND_TIMEOUT_SECONDS is the live, overridable value.
COMMAND_TIMEOUT_SECONDS = config.COMMAND_TIMEOUT_SECONDS
OUTPUT_TRUNCATE_CHARS = 4000

# How often the reader loop checks the wall-clock deadline while waiting for
# output. Small enough that a timeout is enforced promptly, large enough not
# to busy-loop.
_POLL_SECONDS = 0.5


@dataclass
class CommandResult:
    command: str
    returncode: int
    stdout: str
    stderr: str
    ran: bool = True
    error: str = ""
    timed_out: bool = False


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


def _stream_process(argv, cwd, timeout_seconds, on_line=None):
    """Runs argv, streaming stdout/stderr line-by-line as they arrive instead
    of blocking until the process exits. Returns (stdout, stderr, returncode,
    timed_out). on_line, if given, is called as on_line(stream, line) for
    every line as it's read, where stream is "stdout" or "stderr" -- this is
    what lets a caller print output live instead of only after the fact.
    """
    proc = subprocess.Popen(
        argv, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1,
    )
    q = queue.Queue()

    def _reader(stream, tag):
        try:
            for line in iter(stream.readline, ""):
                q.put((tag, line))
        finally:
            q.put((tag, None))
            try:
                stream.close()
            except OSError:
                pass

    threads = [
        threading.Thread(target=_reader, args=(proc.stdout, "stdout"), daemon=True),
        threading.Thread(target=_reader, args=(proc.stderr, "stderr"), daemon=True),
    ]
    for t in threads:
        t.start()

    out_parts, err_parts = [], []
    finished_streams = set()
    start = time.monotonic()
    timed_out = False

    while len(finished_streams) < 2:
        remaining = timeout_seconds - (time.monotonic() - start)
        if remaining <= 0:
            timed_out = True
            proc.kill()
            break
        try:
            tag, line = q.get(timeout=min(remaining, _POLL_SECONDS))
        except queue.Empty:
            continue
        if line is None:
            finished_streams.add(tag)
            continue
        (out_parts if tag == "stdout" else err_parts).append(line)
        if on_line:
            on_line(tag, line.rstrip("\n"))

    if timed_out:
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        returncode = -1
    else:
        returncode = proc.wait()

    return "".join(out_parts), "".join(err_parts), returncode, timed_out


def run_commands(commands: list, work_dir: str = None, timeout_seconds: float = None, on_line=None) -> RunReport:
    """Runs each command in order, stopping at the first non-zero exit so a
    later command never runs against a state the earlier one failed to reach.

    timeout_seconds overrides config.COMMAND_TIMEOUT_SECONDS for this call --
    useful for a request that's expected to take a while (a big install, a
    long build) without raising the default for every command. on_line, if
    given, is called live as output arrives: on_line(stream, line).
    """
    cwd = work_dir or WORK_DIR
    limit = timeout_seconds if timeout_seconds is not None else config.COMMAND_TIMEOUT_SECONDS
    report = RunReport()
    stop = False
    for cmd in commands:
        if stop:
            report.results.append(CommandResult(command=cmd, returncode=-1, stdout="", stderr="", ran=False))
            continue
        try:
            stdout, stderr, returncode, timed_out = _stream_process(
                _build_argv(cmd), cwd, limit, on_line=on_line,
            )
            if timed_out:
                result = CommandResult(
                    command=cmd, returncode=-1, stdout=_truncate(stdout), stderr=_truncate(stderr),
                    ran=True, error=f"Timed out after {limit}s", timed_out=True,
                )
            else:
                result = CommandResult(
                    command=cmd, returncode=returncode, stdout=_truncate(stdout), stderr=_truncate(stderr),
                    ran=True,
                )
        except OSError as err:
            result = CommandResult(command=cmd, returncode=-1, stdout="", stderr="", ran=True, error=str(err))

        report.results.append(result)
        if result.returncode != 0:
            stop = True
    return report
