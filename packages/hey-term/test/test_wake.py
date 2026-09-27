# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import unittest

from lib.wake import heard_wake_word


class TestWakeWord(unittest.TestCase):
    def test_exact_match(self):
        self.assertTrue(heard_wake_word("hey terminal", wake_word="hey terminal"))

    def test_match_with_punctuation_and_case(self):
        self.assertTrue(heard_wake_word("Hey, Terminal!", wake_word="hey terminal"))

    def test_match_embedded_in_longer_utterance(self):
        self.assertTrue(heard_wake_word("okay hey terminal what time is it", wake_word="hey terminal"))

    def test_near_miss_stt_error_still_matches(self):
        # A plausible whisper mis-transcription of "hey terminal".
        self.assertTrue(heard_wake_word("hey term no", wake_word="hey terminal"))

    def test_unrelated_speech_does_not_match(self):
        self.assertFalse(heard_wake_word("what's the weather like today", wake_word="hey terminal"))

    def test_empty_transcript_does_not_match(self):
        self.assertFalse(heard_wake_word("", wake_word="hey terminal"))

    def test_silence_transcript_does_not_match(self):
        self.assertFalse(heard_wake_word("   ", wake_word="hey terminal"))

    def test_respects_custom_wake_word(self):
        self.assertTrue(heard_wake_word("computer run the tests", wake_word="computer"))
        self.assertFalse(heard_wake_word("hey terminal", wake_word="computer"))


if __name__ == "__main__":
    unittest.main()
