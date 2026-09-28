# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""A small, deliberately narrow rule-based matcher for common read-only
requests, used only when Claude's API can't be reached (no key set, or a
network failure) -- see lib/agent.py's AgentError and main.py's
handle_request().

This is NOT a local LLM and doesn't try to be one. Full request planning
still needs Claude -- that's the actual product. What this covers is the
handful of requests common enough, and safe enough, that answering "sorry,
I need the internet for that" every single time would be a worse experience
than just answering them: listing files, checking git status, disk space,
the current date, and so on. Every pattern here maps to exactly one
non-destructive, read-only command -- nothing in this table writes, deletes,
or installs anything, on purpose, since there's no Claude call to reason
about whether a request is actually safe once it's this far outside the
normal planning path.

Matching is intentionally simple (substring/keyword, not NLU) and
conservative: an ambiguous or unrecognized request returns None so the
caller falls through to its normal "couldn't reach Claude" error instead of
guessing.
"""
from .config import is_windows

# Each entry: (keywords that must ALL appear in the lowercased request,
# posix command, windows command, one-line spoken description).
_RULES = [
    (("list", "file"), "ls -la", "Get-ChildItem", "Lists the files in the current folder."),
    (("what", "director"), "pwd", "Get-Location", "Shows the current folder."),
    (("current", "director"), "pwd", "Get-Location", "Shows the current folder."),
    (("disk", "space"), "df -h .", "Get-PSDrive -PSProvider FileSystem", "Shows disk space."),
    (("git", "status"), "git status", "git status", "Shows the git status of this folder."),
    (("git", "log"), "git log --oneline -10", "git log --oneline -10", "Shows the last 10 git commits."),
    (("what", "date"), "date", "Get-Date", "Shows the current date and time."),
    (("what", "time"), "date", "Get-Date", "Shows the current date and time."),
    (("who", "am", "i"), "whoami", "whoami", "Shows the current user."),
    (("what", "ip"), "curl -s ifconfig.me || hostname -I", "ipconfig", "Shows this machine's IP information."),
    (("environment", "variable"), "env", "Get-ChildItem Env:", "Lists environment variables."),
    (("python", "version"), "python3 --version || python --version", "python --version", "Shows the installed Python version."),
    (("node", "version"), "node --version", "node --version", "Shows the installed Node version."),
]


def try_offline_plan(request_text: str) -> dict:
    """Returns {"summary": str, "commands": [str]} if the request matches a
    known safe read-only pattern, else None. Callers should treat None
    exactly like "couldn't plan this," not as an error on its own.
    """
    lowered = (request_text or "").lower()
    if not lowered.strip():
        return None

    for keywords, posix_cmd, windows_cmd, description in _RULES:
        if all(kw in lowered for kw in keywords):
            command = windows_cmd if is_windows() else posix_cmd
            return {"summary": description, "commands": [command]}

    return None
