# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import sys
import tempfile
import unittest
from unittest import mock

from lib.executor import _build_argv, run_commands


class TestRunCommands(unittest.TestCase):
    def test_single_successful_command_captures_stdout(self):
        report = run_commands(["echo hello-voice-terminal"])
        self.assertTrue(report.ok)
        self.assertEqual(len(report.results), 1)
        self.assertEqual(report.results[0].returncode, 0)
        self.assertIn("hello-voice-terminal", report.results[0].stdout)

    def test_stops_after_first_failure_and_skips_rest(self):
        report = run_commands(["exit 1", "echo should-not-run"])
        self.assertFalse(report.ok)
        self.assertEqual(report.results[0].returncode, 1)
        self.assertFalse(report.results[1].ran)

    def test_multiple_successful_commands_all_run(self):
        report = run_commands(["echo one", "echo two"])
        self.assertTrue(report.ok)
        self.assertEqual(len(report.results), 2)
        self.assertTrue(all(r.ran for r in report.results))

    def test_runs_in_specified_work_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            cmd = "cd ." if sys.platform != "win32" else "cd ."
            report = run_commands(["pwd" if sys.platform != "win32" else "cd"], work_dir=tmp)
            self.assertTrue(report.ok)

    def test_spoken_summary_all_ok(self):
        report = run_commands(["echo a", "echo b"])
        self.assertIn("2 commands ran successfully", report.spoken_summary())

    def test_spoken_summary_on_failure_mentions_skip(self):
        report = run_commands(["exit 1", "echo x"])
        summary = report.spoken_summary()
        self.assertIn("failed", summary)
        self.assertIn("skipped", summary)

    def test_spoken_summary_in_spanish(self):
        report = run_commands(["echo a"])
        summary = report.spoken_summary(language="es")
        self.assertIn("Listo.", summary)
        self.assertIn("comando", summary)

    @unittest.skipIf(sys.platform == "win32", "bash-only syntax test")
    def test_actually_runs_real_bash_not_posix_sh(self):
        # [[ ]] is a bash-only conditional -- it's a syntax error under dash,
        # which is /bin/sh on Debian/Kali. This is the regression test for
        # the fix: the agent is told the shell is bash and may emit bash-only
        # syntax, so the executor must actually invoke bash, not shell=True's
        # default interpreter.
        report = run_commands(['[[ "a" == "a" ]] && echo matched'])
        self.assertTrue(report.ok)
        self.assertIn("matched", report.results[0].stdout)

    @unittest.skipIf(sys.platform == "win32", "POSIX argv shape")
    def test_build_argv_uses_bash_on_posix(self):
        with mock.patch("lib.executor.is_windows", return_value=False):
            argv = _build_argv("echo hi")
        self.assertTrue(argv[0].endswith("bash") or argv[0].endswith("sh"))
        self.assertEqual(argv[-2:], ["-c", "echo hi"])

    def test_build_argv_uses_powershell_on_windows(self):
        with mock.patch("lib.executor.is_windows", return_value=True), \
             mock.patch("lib.executor.shutil.which", return_value="powershell.exe"):
            argv = _build_argv("Get-ChildItem")
        self.assertIn("powershell.exe", argv[0])
        self.assertIn("-Command", argv)
        self.assertEqual(argv[-1], "Get-ChildItem")


if __name__ == "__main__":
    unittest.main()
