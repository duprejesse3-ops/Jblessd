# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import json
import tempfile
import unittest
from unittest import mock

import main
from lib.agent import AgentError
from lib.executor import CommandResult


class TestHandleRequestConversationHistory(unittest.TestCase):
    """handle_request() is what actually wires main.py's conversational
    memory together -- forwarding _conversation_history into plan(),
    remembering a successful turn, resetting on "stop listening", and
    deliberately NOT remembering an offline-fallback turn (see
    MAX_HISTORY_MESSAGES's comment in main.py for why). Heavily mocked since
    the function itself talks to voice/confirmation/execution, but the
    history bookkeeping is real.
    """

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.work_dir = self._tmp.name
        main._reset_conversation()

    def tearDown(self):
        self._tmp.cleanup()
        main._reset_conversation()

    def test_successful_plan_is_forwarded_history_and_then_remembered(self):
        main._conversation_history = [{"role": "user", "content": "earlier turn"}]
        seen_history = []

        def fake_plan(request_text, language, history=None):
            # handle_request passes the live module-level list by reference,
            # not a copy -- snapshot it immediately, the same way the real
            # plan() does internally (see lib/agent.py's `list(history or [])`),
            # since later _remember_turn() calls mutate that same object.
            seen_history.append(list(history or []))
            return {"summary": "Lists files.", "commands": ["ls"]}

        with mock.patch("main.plan", side_effect=fake_plan), \
             mock.patch("main.speak"), \
             mock.patch("main.get_confirmation", return_value="cancel"):
            main.handle_request("list files", "en", self.work_dir, 30)

        self.assertEqual(seen_history, [[{"role": "user", "content": "earlier turn"}]])
        self.assertEqual(main._conversation_history[-2], {"role": "user", "content": "list files"})
        self.assertEqual(
            json.loads(main._conversation_history[-1]["content"]),
            {"summary": "Lists files.", "commands": ["ls"]},
        )

    def test_clarify_response_is_also_remembered(self):
        with mock.patch("main.plan", return_value={"clarify": "Which file do you mean?"}), \
             mock.patch("main.speak"):
            main.handle_request("delete it", "en", self.work_dir, 30)

        self.assertEqual(main._conversation_history[-2], {"role": "user", "content": "delete it"})
        self.assertEqual(json.loads(main._conversation_history[-1]["content"]), {"clarify": "Which file do you mean?"})

    def test_offline_fallback_does_not_join_the_remembered_conversation(self):
        offline_result = {"summary": "Lists files.", "commands": ["ls -la"]}
        with mock.patch("main.plan", side_effect=AgentError("no API key")), \
             mock.patch("main.offline_fallback.try_offline_plan", return_value=offline_result), \
             mock.patch("main.speak"), \
             mock.patch("main.get_confirmation", return_value="cancel"):
            main.handle_request("list files", "en", self.work_dir, 30)

        self.assertEqual(main._conversation_history, [])

    def test_stop_phrase_resets_conversation(self):
        main._conversation_history = [{"role": "user", "content": "earlier turn"}]
        with mock.patch("main.speak"):
            main.handle_request("stop listening", "en", self.work_dir, 30)
        self.assertEqual(main._conversation_history, [])

    def test_a_meta_command_like_jobs_leaves_history_untouched(self):
        main._conversation_history = [{"role": "user", "content": "earlier turn"}]
        with mock.patch("main.speak"):
            main.handle_request("jobs", "en", self.work_dir, 30)
        self.assertEqual(main._conversation_history, [{"role": "user", "content": "earlier turn"}])


if __name__ == "__main__":
    unittest.main()
