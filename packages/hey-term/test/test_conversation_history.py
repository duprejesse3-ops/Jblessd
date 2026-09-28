# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import unittest

import main


class TestConversationHistory(unittest.TestCase):
    def setUp(self):
        self._original = list(main._conversation_history)
        main._reset_conversation()

    def tearDown(self):
        main._conversation_history = self._original

    def test_starts_empty_after_reset(self):
        self.assertEqual(main._conversation_history, [])

    def test_remember_turn_appends_role_and_content(self):
        main._remember_turn("user", "list files")
        main._remember_turn("assistant", '{"summary": "ok", "commands": ["ls"]}')
        self.assertEqual(main._conversation_history, [
            {"role": "user", "content": "list files"},
            {"role": "assistant", "content": '{"summary": "ok", "commands": ["ls"]}'},
        ])

    def test_reset_clears_previously_remembered_turns(self):
        main._remember_turn("user", "list files")
        main._reset_conversation()
        self.assertEqual(main._conversation_history, [])

    def test_history_is_capped_at_max_history_messages(self):
        for i in range(main.MAX_HISTORY_MESSAGES + 5):
            main._remember_turn("user", f"request {i}")
        self.assertEqual(len(main._conversation_history), main.MAX_HISTORY_MESSAGES)
        # Oldest turns age out first -- the most recent ones survive.
        self.assertEqual(
            main._conversation_history[-1],
            {"role": "user", "content": f"request {main.MAX_HISTORY_MESSAGES + 4}"},
        )


if __name__ == "__main__":
    unittest.main()
