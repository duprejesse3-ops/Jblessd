# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import unittest

from lib.safety import dangerous_commands, is_dangerous


class TestSafety(unittest.TestCase):
    def test_catches_rm_rf_root(self):
        self.assertTrue(is_dangerous("sudo rm -rf /"))

    def test_catches_case_insensitively(self):
        self.assertTrue(is_dangerous("Format C:"))

    def test_catches_fork_bomb(self):
        self.assertTrue(is_dangerous(":(){ :|:& };:"))

    def test_catches_force_push(self):
        self.assertTrue(is_dangerous("git push --force origin main"))

    def test_allows_benign_command(self):
        self.assertFalse(is_dangerous("ls -la"))

    def test_allows_benign_rm_of_specific_file(self):
        self.assertFalse(is_dangerous("rm notes.txt"))

    def test_dangerous_commands_filters_a_list(self):
        cmds = ["ls -la", "rm -rf /", "echo hi"]
        self.assertEqual(dangerous_commands(cmds), ["rm -rf /"])

    def test_dangerous_commands_empty_when_none_match(self):
        self.assertEqual(dangerous_commands(["ls", "pwd"]), [])


if __name__ == "__main__":
    unittest.main()
