# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import subprocess
import tempfile
import unittest
import os

from lib import snapshot


def _git(args, cwd):
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True)


def _git_available() -> bool:
    try:
        subprocess.run(["git", "--version"], capture_output=True, check=True)
        return True
    except (OSError, subprocess.CalledProcessError):
        return False


@unittest.skipUnless(_git_available(), "git not installed in this environment")
class TestSnapshot(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = self._tmp.name
        _git(["init", "-q"], self.repo)
        _git(["config", "user.email", "test@example.com"], self.repo)
        _git(["config", "user.name", "Test"], self.repo)
        with open(os.path.join(self.repo, "tracked.txt"), "w") as f:
            f.write("original\n")
        _git(["add", "."], self.repo)
        _git(["commit", "-q", "-m", "init"], self.repo)

    def tearDown(self):
        self._tmp.cleanup()

    def test_is_git_repo_true_inside_repo(self):
        self.assertTrue(snapshot.is_git_repo(self.repo))

    def test_is_git_repo_false_outside_repo(self):
        with tempfile.TemporaryDirectory() as other:
            self.assertFalse(snapshot.is_git_repo(other))

    def test_no_changes_reports_empty(self):
        snap = snapshot.take(self.repo)
        self.assertEqual(snapshot.changed_since(snap), [])

    def test_detects_new_untracked_file(self):
        snap = snapshot.take(self.repo)
        with open(os.path.join(self.repo, "new.txt"), "w") as f:
            f.write("hello\n")
        self.assertIn("new.txt", snapshot.changed_since(snap))

    def test_detects_modified_tracked_file(self):
        snap = snapshot.take(self.repo)
        with open(os.path.join(self.repo, "tracked.txt"), "w") as f:
            f.write("changed\n")
        self.assertIn("tracked.txt", snapshot.changed_since(snap))

    def test_revert_deletes_newly_created_file(self):
        snap = snapshot.take(self.repo)
        new_path = os.path.join(self.repo, "new.txt")
        with open(new_path, "w") as f:
            f.write("hello\n")
        reverted, skipped = snapshot.revert(snap, ["new.txt"])
        self.assertEqual(reverted, ["new.txt"])
        self.assertEqual(skipped, [])
        self.assertFalse(os.path.exists(new_path))

    def test_revert_restores_modified_tracked_file(self):
        snap = snapshot.take(self.repo)
        tracked_path = os.path.join(self.repo, "tracked.txt")
        with open(tracked_path, "w") as f:
            f.write("changed\n")
        reverted, skipped = snapshot.revert(snap, ["tracked.txt"])
        self.assertEqual(reverted, ["tracked.txt"])
        with open(tracked_path) as f:
            self.assertEqual(f.read(), "original\n")

    def test_revert_skips_file_that_was_already_dirty(self):
        with open(os.path.join(self.repo, "tracked.txt"), "w") as f:
            f.write("already dirty before snapshot\n")
        snap = snapshot.take(self.repo)  # snapshot taken AFTER dirtying it
        with open(os.path.join(self.repo, "tracked.txt"), "w") as f:
            f.write("even more changed\n")
        reverted, skipped = snapshot.revert(snap, ["tracked.txt"])
        self.assertEqual(reverted, [])
        self.assertEqual(skipped, ["tracked.txt"])

    def test_changed_since_empty_outside_git_repo(self):
        with tempfile.TemporaryDirectory() as other:
            snap = snapshot.take(other)
            with open(os.path.join(other, "whatever.txt"), "w") as f:
                f.write("x\n")
            self.assertEqual(snapshot.changed_since(snap), [])

    def test_revert_outside_git_repo_skips_everything(self):
        with tempfile.TemporaryDirectory() as other:
            snap = snapshot.take(other)
            reverted, skipped = snapshot.revert(snap, ["whatever.txt"])
            self.assertEqual(reverted, [])
            self.assertEqual(skipped, ["whatever.txt"])


if __name__ == "__main__":
    unittest.main()
