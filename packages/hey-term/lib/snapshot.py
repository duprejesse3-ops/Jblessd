# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Best-effort before/after safety net for file-changing commands, inside a
git repository only.

Voice confirmation lowers the bar to running a command; this exists to lower
the cost of having confirmed the wrong one. It is NOT a general undo system --
it can only ever see what git can see, and it never touches a file that was
already dirty before Hey Term ran anything (touching that would risk
destroying changes that had nothing to do with what Hey Term just did, which
is worse than doing nothing).

What it actually does: record `git status --porcelain -uall` before running
a plan's commands, record it again after, and diff the two. Any path whose
status changed -- newly modified, newly created, newly deleted -- is a
candidate for "revert". A path that was *already* dirty before the snapshot
was taken is always left alone, reported but not reverted, since there's no
reliable way to separate "changes already there" from "changes Hey Term just
made" to the same file.
"""
import os
import subprocess

GIT_TIMEOUT_SECONDS = 10


def _run_git(args: list, cwd: str):
    try:
        proc = subprocess.run(
            ["git", *args], cwd=cwd, capture_output=True, text=True, timeout=GIT_TIMEOUT_SECONDS,
        )
        return proc.returncode, proc.stdout, proc.stderr
    except (OSError, subprocess.TimeoutExpired):
        return 1, "", "git unavailable"


def is_git_repo(work_dir: str) -> bool:
    code, out, _ = _run_git(["rev-parse", "--is-inside-work-tree"], work_dir)
    return code == 0 and out.strip() == "true"


def _status_map(work_dir: str) -> dict:
    """Returns {path: two-char status code} from `git status --porcelain`,
    e.g. {"foo.py": " M", "new.txt": "??"}. -uall so a new file inside a new
    untracked directory is still listed individually, not collapsed to the
    directory name.
    """
    code, out, _ = _run_git(["status", "--porcelain", "-uall"], work_dir)
    result = {}
    if code != 0:
        return result
    for line in out.splitlines():
        if len(line) < 4:
            continue
        status = line[:2]
        path = line[3:]
        if " -> " in path:  # rename: "old -> new" -- track the new path
            path = path.split(" -> ", 1)[1]
        result[path] = status
    return result


class Snapshot:
    """Opaque handle returned by take(); pass it straight to changed_since()
    and revert(). is_git is False whenever work_dir isn't (or isn't inside) a
    git repository -- every other function on this module treats that as
    "nothing to do" rather than raising, since most commands never touch a
    git repo at all and that's a completely normal, unremarkable case.
    """

    def __init__(self, work_dir: str, is_git: bool, before: dict):
        self.work_dir = work_dir
        self.is_git = is_git
        self.before = before


def take(work_dir: str) -> Snapshot:
    is_git = is_git_repo(work_dir)
    before = _status_map(work_dir) if is_git else {}
    return Snapshot(work_dir=work_dir, is_git=is_git, before=before)


def changed_since(snap: Snapshot) -> list:
    """Paths whose git status is different now than when the snapshot was
    taken -- newly modified, newly created, newly deleted, or newly staged.
    Returns [] outside a git repo, or if nothing changed.
    """
    if not snap.is_git:
        return []
    after = _status_map(snap.work_dir)
    all_paths = set(snap.before) | set(after)
    return sorted(p for p in all_paths if snap.before.get(p) != after.get(p))


def revert(snap: Snapshot, paths: list) -> tuple:
    """Best-effort revert of `paths` back to how they were when the snapshot
    was taken. Returns (reverted, skipped) -- two lists of paths. A path is
    skipped, never forced, when it was already dirty before the snapshot (see
    module docstring), when it's outside a git repo, or when the underlying
    git/filesystem operation fails.
    """
    if not snap.is_git:
        return [], list(paths)

    after = _status_map(snap.work_dir)
    reverted, skipped = [], []

    for path in paths:
        if snap.before.get(path) is not None:
            # Already dirty before Hey Term touched anything -- don't guess
            # which part of the diff is "ours" to undo.
            skipped.append(path)
            continue

        after_status = after.get(path, "")
        full_path = os.path.join(snap.work_dir, path)

        try:
            if after_status.startswith("??"):
                # Brand-new untracked file -- reverting means deleting it.
                if os.path.isfile(full_path):
                    os.remove(full_path)
                    reverted.append(path)
                else:
                    skipped.append(path)
            else:
                # Tracked file that went from clean to modified/deleted --
                # restore it from HEAD.
                code, _, _ = _run_git(["checkout", "--", path], snap.work_dir)
                if code == 0:
                    reverted.append(path)
                else:
                    skipped.append(path)
        except OSError:
            skipped.append(path)

    return reverted, skipped
