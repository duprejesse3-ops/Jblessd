# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import json
import unittest
from unittest import mock

from lib.agent import SYSTEM_PROMPT, AgentError, _shell_name, parse_plan, plan


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


def _fake_response(payload: dict, usage=None):
    return mock.Mock(
        status_code=200,
        json=mock.Mock(return_value={
            "content": [{"type": "text", "text": json.dumps(payload)}],
            "usage": usage or {"input_tokens": 10, "output_tokens": 5},
        }),
    )


class TestPlanConversationHistory(unittest.TestCase):
    """plan()'s `history` param is what main.py's conversational-memory
    feature relies on to let a follow-up ("undo that") or a clarifying
    answer land in context -- see main.py's _remember_turn/_reset_conversation
    and its module docstring. These tests cover plan()'s side of that
    contract without a real network call.
    """

    def test_no_history_sends_only_the_current_request(self):
        with mock.patch("lib.agent.requests.post", return_value=_fake_response({"summary": "ok", "commands": ["ls"]})) as post:
            plan("list files", api_key="test-key")
        sent = post.call_args.kwargs["json"]["messages"]
        self.assertEqual(sent, [{"role": "user", "content": "list files"}])

    def test_history_is_forwarded_ahead_of_the_new_request(self):
        history = [
            {"role": "user", "content": "list files"},
            {"role": "assistant", "content": '{"summary": "Lists files.", "commands": ["ls -la"]}'},
        ]
        with mock.patch("lib.agent.requests.post", return_value=_fake_response({"summary": "ok", "commands": ["rm foo"]})) as post:
            plan("undo that", api_key="test-key", history=history)
        sent = post.call_args.kwargs["json"]["messages"]
        self.assertEqual(sent, history + [{"role": "user", "content": "undo that"}])

    def test_none_history_is_treated_the_same_as_no_history(self):
        with mock.patch("lib.agent.requests.post", return_value=_fake_response({"summary": "ok", "commands": ["ls"]})) as post:
            plan("list files", api_key="test-key", history=None)
        sent = post.call_args.kwargs["json"]["messages"]
        self.assertEqual(sent, [{"role": "user", "content": "list files"}])

    def test_does_not_mutate_the_caller_s_history_list(self):
        history = [{"role": "user", "content": "list files"}]
        original_len = len(history)
        with mock.patch("lib.agent.requests.post", return_value=_fake_response({"summary": "ok", "commands": ["ls"]})):
            plan("and now what", api_key="test-key", history=history)
        self.assertEqual(len(history), original_len)


if __name__ == "__main__":
    unittest.main()
