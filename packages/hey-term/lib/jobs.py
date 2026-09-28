# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Detached background jobs, for a request the person doesn't want to block
the voice loop on ("kick off the build" and keep talking, instead of staring
at the terminal until it finishes or hits the timeout).

A job is still confirmed exactly like any other command -- the only thing
"background" changes is that Hey Term doesn't wait for it, so nothing here
weakens the spoken/typed confirmation model in lib/confirm.py and
lib/safety.py. Each job is a real detached subprocess (still run through the
same explicit bash/PowerShell invocation as lib/executor.py, not
shell=True), with its own log file and a status file main.py's "jobs" command
reads back.

State lives in JOBS_DIR (".hey-term-jobs" under the work dir by default), one
subfolder per job -- no daemon, no database, just files, so a job someone
started, closed the terminal, and reopened Hey Term for is still checkable.
"""
import json
import os
import subprocess
import threading
import time
import uuid

from .config import WORK_DIR, is_windows

JOBS_DIRNAME = ".hey-term-jobs"


def _jobs_dir(work_dir: str) -> str:
    path = os.path.join(work_dir, JOBS_DIRNAME)
    os.makedirs(path, exist_ok=True)
    return path


def _build_argv(command: str) -> list:
    # Deliberately duplicated from lib/executor.py rather than imported: a
    # background job's argv-building must never change behavior just because
    # someone edits the foreground executor, and the two are small enough
    # that keeping them independently readable beats a shared abstraction.
    if is_windows():
        import shutil
        exe = shutil.which("pwsh") or shutil.which("powershell") or "powershell"
        return [exe, "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command]
    import shutil
    exe = shutil.which("bash") or ("/bin/bash" if os.path.exists("/bin/bash") else None) or shutil.which("sh") or "/bin/sh"
    return [exe, "-c", command]


def start(command: str, work_dir: str = None, label: str = "") -> dict:
    """Launches `command` detached and returns its job record immediately --
    does not wait for it to finish. The job's own stdout+stderr go to
    <job_dir>/output.log; its exit code (once known) goes to status.json.
    """
    cwd = work_dir or WORK_DIR
    jobs_dir = _jobs_dir(cwd)
    job_id = uuid.uuid4().hex[:8]
    job_dir = os.path.join(jobs_dir, job_id)
    os.makedirs(job_dir, exist_ok=True)

    log_path = os.path.join(job_dir, "output.log")
    status_path = os.path.join(job_dir, "status.json")

    record = {
        "id": job_id,
        "command": command,
        "label": label,
        "work_dir": cwd,
        "started_at": time.time(),
        "finished_at": None,
        "returncode": None,
        "status": "running",
        "log_path": log_path,
    }
    with open(status_path, "w", encoding="utf-8") as f:
        json.dump(record, f)

    log_file = open(log_path, "w", encoding="utf-8")
    # start_new_session detaches the child from Hey Term's own process group
    # on POSIX so Ctrl+C in the foreground loop doesn't also kill the job;
    # CREATE_NEW_PROCESS_GROUP is the Windows equivalent.
    kwargs = {}
    if is_windows():
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True

    proc = subprocess.Popen(
        _build_argv(command), cwd=cwd, stdout=log_file, stderr=subprocess.STDOUT, **kwargs,
    )

    record["pid"] = proc.pid
    _write_status(status_path, record)

    # A background job's Popen handle would otherwise never be wait()ed on --
    # main.py doesn't block on it, that's the whole point -- which leaves a
    # zombie/defunct process behind on POSIX once it exits. A zombie's PID
    # stays valid, so checking "is this PID still alive" (os.kill(pid, 0))
    # would report it as running forever. A daemon thread that actually
    # wait()s reaps the process AND gets the real exit code, instead of
    # polling PID liveness and guessing.
    def _reap():
        returncode = proc.wait()
        try:
            log_file.close()
        except OSError:
            pass
        record["status"] = "finished"
        record["returncode"] = returncode
        record["finished_at"] = time.time()
        _write_status(status_path, record)

    threading.Thread(target=_reap, daemon=True).start()

    return record


def _write_status(status_path: str, record: dict) -> None:
    try:
        with open(status_path, "w", encoding="utf-8") as f:
            json.dump(record, f)
    except OSError:
        pass


def _refresh(job_dir: str) -> dict:
    """Reads a job's current status.json. The reaper thread started in
    start() keeps this file up to date as the job finishes -- but only for
    the lifetime of the Hey Term process that started it. If Hey Term itself
    was restarted while a job was still running, there's no reaper thread
    left to update the file, so this falls back to a one-off liveness check
    (a process can only be wait()ed on by its own parent, and a restarted
    Hey Term isn't that parent -- os.kill(pid, 0) is the best a *different*
    process can do). A job found dead this way is marked finished with an
    unknown exit code rather than guessing success.
    """
    status_path = os.path.join(job_dir, "status.json")
    try:
        with open(status_path, "r", encoding="utf-8") as f:
            record = json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}

    if record.get("status") == "running" and record.get("pid") is not None:
        try:
            os.kill(record["pid"], 0)
        except OSError:
            record["status"] = "finished"
            record["finished_at"] = time.time()
            record.setdefault("returncode", None)
            _write_status(status_path, record)

    return record


def list_jobs(work_dir: str = None) -> list:
    cwd = work_dir or WORK_DIR
    jobs_dir = os.path.join(cwd, JOBS_DIRNAME)
    if not os.path.isdir(jobs_dir):
        return []
    records = []
    for job_id in sorted(os.listdir(jobs_dir)):
        job_dir = os.path.join(jobs_dir, job_id)
        if os.path.isdir(job_dir):
            record = _refresh(job_dir)
            if record:
                records.append(record)
    return records


def tail_log(job_id: str, work_dir: str = None, max_chars: int = 2000) -> str:
    cwd = work_dir or WORK_DIR
    log_path = os.path.join(cwd, JOBS_DIRNAME, job_id, "output.log")
    try:
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            f.seek(max(0, size - max_chars))
            return f.read()
    except OSError:
        return ""
