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

    @unittest.skipIf(sys.platform == "win32", "sleep/timeout syntax differs")
    def test_slow_command_is_killed_after_custom_timeout(self):
        report = run_commands(["sleep 5"], timeout_seconds=0.5)
        self.assertEqual(len(report.results), 1)
        result = report.results[0]
        self.assertTrue(result.timed_out)
        self.assertEqual(result.returncode, -1)

    def test_stderr_captured_separately_from_stdout(self):
        cmd = "echo to-stdout; echo to-stderr 1>&2" if sys.platform != "win32" else \
            "Write-Output to-stdout; Write-Error to-stderr"
        report = run_commands([cmd])
        result = report.results[0]
        self.assertIn("to-stdout", result.stdout)
        self.assertIn("to-stderr", result.stderr)

    def test_on_line_callback_receives_streamed_output(self):
        seen = []
        run_commands(["echo one && echo two"], on_line=lambda stream, line: seen.append((stream, line)))
        lines = [line for _, line in seen]
        self.assertIn("one", lines)
        self.assertIn("two", lines)

    def test_default_timeout_comes_from_config_when_not_overridden(self):
        with mock.patch("lib.executor.config.COMMAND_TIMEOUT_SECONDS", 0.5):
            report = run_commands(["sleep 5" if sys.platform != "win32" else "Start-Sleep -Seconds 5"])
        self.assertTrue(report.results[0].timed_out)


if __name__ == "__main__":
    unittest.main()
