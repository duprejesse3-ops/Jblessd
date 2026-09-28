# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Append-only audit trail: one JSON object per line, one line per event.

A tool that runs shell commands on your spoken say-so needs to be able to
answer, after the fact, exactly what it ran, when, and why it believed you'd
confirmed it -- not just show that in a terminal scrollback that gets closed.
Every wake, request, plan (or clarifying question), confirmation outcome, and
command result is appended here. Nothing is ever removed or rewritten by this
module -- it only appends, so a corrupted or partial write to one line can
never take an earlier entry down with it.
"""
import json
import time

from . import config

# config.AUDIT_LOG_PATH is read fresh on every call (via the `config` module
# reference, not imported by value) so that main.py's --audit-log override --
# which reassigns config.AUDIT_LOG_PATH after this module is already
# imported -- actually takes effect instead of silently writing to the
# default path the module happened to see at import time.


def log_event(kind: str, **fields) -> None:
    entry = {"ts": time.time(), "iso": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "kind": kind}
    entry.update(fields)
    target = config.AUDIT_LOG_PATH
    try:
        with open(target, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError as err:  # pragma: no cover - depends on local filesystem permissions
        # Logging failure must never take down the actual task -- print a
        # warning once to the terminal (which is itself a record) and move on.
        print(f"[audit] could not write to {target}: {err}")


def read_events(path: str = None) -> list:
    """Reads the audit log back as a list of dicts. Used by tests and by
    anyone auditing what Hey Term has done; skips (rather than crashes on) a
    line that somehow didn't get written as valid JSON.
    """
    events = []
    target = path or config.AUDIT_LOG_PATH
    try:
        with open(target, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    except FileNotFoundError:
        return []
    return events
