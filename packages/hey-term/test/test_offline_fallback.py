# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import unittest
from unittest import mock

from lib import offline_fallback


class TestOfflineFallback(unittest.TestCase):
    def test_no_match_returns_none(self):
        self.assertIsNone(offline_fallback.try_offline_plan("write me a poem about clouds"))

    def test_empty_request_returns_none(self):
        self.assertIsNone(offline_fallback.try_offline_plan(""))

    def test_list_files_matches_on_posix(self):
        with mock.patch("lib.offline_fallback.is_windows", return_value=False):
            result = offline_fallback.try_offline_plan("list the files here")
        self.assertIsNotNone(result)
        self.assertEqual(result["commands"], ["ls -la"])

    def test_list_files_matches_on_windows(self):
        with mock.patch("lib.offline_fallback.is_windows", return_value=True):
            result = offline_fallback.try_offline_plan("list the files here")
        self.assertIsNotNone(result)
        self.assertEqual(result["commands"], ["Get-ChildItem"])

    def test_git_status_matches(self):
        with mock.patch("lib.offline_fallback.is_windows", return_value=False):
            result = offline_fallback.try_offline_plan("what's the git status")
        self.assertEqual(result["commands"], ["git status"])

    def test_result_never_contains_destructive_keywords(self):
        # Cheap guardrail: every command this module can ever return should
        # be obviously read-only, never touching rm/del/drop/format.
        destructive = ("rm ", "del ", "drop ", "format", "mkfs", "dd if=")
        for _, posix_cmd, windows_cmd, _ in offline_fallback._RULES:
            for cmd in (posix_cmd, windows_cmd):
                lowered = cmd.lower()
                self.assertFalse(
                    any(d in lowered for d in destructive),
                    f"offline fallback command looked destructive: {cmd}",
                )

    def test_summary_is_a_nonempty_string(self):
        with mock.patch("lib.offline_fallback.is_windows", return_value=False):
            result = offline_fallback.try_offline_plan("what is the current date")
        self.assertTrue(isinstance(result["summary"], str) and result["summary"])


if __name__ == "__main__":
    unittest.main()
