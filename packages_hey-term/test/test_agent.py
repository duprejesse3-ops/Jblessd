# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import unittest
from unittest import mock

from lib.agent import SYSTEM_PROMPT, AgentError, _shell_name, parse_plan


class TestParsePlan(unittest.TestCase):
    def test_valid_summary_and_commands(self):
        result = parse_plan('{"summary": "Lists the current folder.", "commands": ["ls -la"]}')
        self.assertEqual(result, {"summary": "Lists the current folder.", "commands": ["ls -la"]})

    def test_valid_clarify(self):
        result = parse_plan('{"clarify": "Which file do you mean?"}')
        self.assertEqual(result, {"clarify": "Which file do you mean?"})

    def test_strips_markdown_code_fence(self):
        text = '```json\n{"summary": "ok", "commands": ["echo hi"]}\n```'
        result = parse_plan(text)
        self.assertEqual(result["commands"], ["echo hi"])

    def test_multiple_commands_preserved_in_order(self):
        result = parse_plan('{"summary": "two steps", "commands": ["mkdir foo", "cd foo"]}')
        self.assertEqual(result["commands"], ["mkdir foo", "cd foo"])

    def test_rejects_non_json(self):
        with self.assertRaises(AgentError):
            parse_plan("sure, I'll run ls for you")

    def test_rejects_empty_commands_list(self):
        with self.assertRaises(AgentError):
            parse_plan('{"summary": "ok", "commands": []}')

    def test_rejects_missing_summary(self):
        with self.assertRaises(AgentError):
            parse_plan('{"commands": ["ls"]}')

    def test_rejects_non_string_command(self):
        with self.assertRaises(AgentError):
            parse_plan('{"summary": "ok", "commands": [123]}')

    def test_rejects_empty_clarify(self):
        with self.assertRaises(AgentError):
            parse_plan('{"clarify": "  "}')

    def test_rejects_object_that_is_neither_shape(self):
        with self.assertRaises(AgentError):
            parse_plan('{"foo": "bar"}')

    def test_rejects_json_array_instead_of_object(self):
        with self.assertRaises(AgentError):
            parse_plan('["ls", "-la"]')


class TestShellSelection(unittest.TestCase):
    def test_shell_name_bash_on_posix(self):
        with mock.patch("lib.agent.is_windows", return_value=False):
            self.assertEqual(_shell_name(), "bash")

    def test_shell_name_powershell_on_windows(self):
        with mock.patch("lib.agent.is_windows", return_value=True):
            self.assertEqual(_shell_name(), "PowerShell")


class TestSystemPromptFormatting(unittest.TestCase):
    def test_formats_with_language_name_and_shell(self):
        rendered = SYSTEM_PROMPT.format(shell="bash", os_name="Linux", language_name="Español")
        self.assertIn("Español", rendered)
        self.assertIn("bash", rendered)
        self.assertIn("Hey Term", rendered)
        self.assertIn("MultiNiche AI", rendered)


if __name__ == "__main__":
    unittest.main()
