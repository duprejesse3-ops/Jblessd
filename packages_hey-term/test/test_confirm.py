# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import unittest

from lib.confirm import parse_confirmation


class TestParseConfirmation(unittest.TestCase):
    def test_confirm_word(self):
        self.assertEqual(parse_confirmation("confirm"), "confirm")

    def test_yes_variants(self):
        for word in ["yes", "yeah", "yep", "sure"]:
            self.assertEqual(parse_confirmation(word), "confirm")

    def test_go_ahead_phrase(self):
        self.assertEqual(parse_confirmation("go ahead"), "confirm")

    def test_cancel_word(self):
        self.assertEqual(parse_confirmation("cancel"), "cancel")

    def test_no_variants(self):
        for word in ["no", "nope", "stop", "abort"]:
            self.assertEqual(parse_confirmation(word), "cancel")

    def test_never_mind_phrase(self):
        self.assertEqual(parse_confirmation("never mind"), "cancel")

    def test_empty_is_unclear(self):
        self.assertEqual(parse_confirmation(""), "unclear")

    def test_silence_transcript_is_unclear(self):
        self.assertEqual(parse_confirmation("   "), "unclear")

    def test_unrelated_speech_is_unclear(self):
        self.assertEqual(parse_confirmation("what's for dinner"), "unclear")

    def test_conflicting_words_is_unclear(self):
        self.assertEqual(parse_confirmation("yes no wait"), "unclear")

    def test_case_insensitive(self):
        self.assertEqual(parse_confirmation("CONFIRM"), "confirm")


class TestParseConfirmationOtherLanguages(unittest.TestCase):
    def test_spanish_confirm(self):
        self.assertEqual(parse_confirmation("sí", language="es"), "confirm")
        self.assertEqual(parse_confirmation("confirmar", language="es"), "confirm")

    def test_spanish_cancel(self):
        self.assertEqual(parse_confirmation("no", language="es"), "cancel")
        self.assertEqual(parse_confirmation("cancelar", language="es"), "cancel")

    def test_spanish_accented_word_matches(self):
        # Whisper commonly returns the accented form for "sí" -- confirm the
        # normalizer keeps accented letters intact rather than mangling them.
        self.assertEqual(parse_confirmation("Sí, confirmar", language="es"), "confirm")

    def test_french_confirm_and_cancel(self):
        self.assertEqual(parse_confirmation("oui", language="fr"), "confirm")
        self.assertEqual(parse_confirmation("annuler", language="fr"), "cancel")

    def test_german_confirm_and_cancel(self):
        self.assertEqual(parse_confirmation("ja", language="de"), "confirm")
        self.assertEqual(parse_confirmation("nein", language="de"), "cancel")

    def test_portuguese_confirm_and_cancel(self):
        self.assertEqual(parse_confirmation("sim", language="pt"), "confirm")
        self.assertEqual(parse_confirmation("cancelar", language="pt"), "cancel")

    def test_italian_confirm_and_cancel(self):
        self.assertEqual(parse_confirmation("sì", language="it"), "confirm")
        self.assertEqual(parse_confirmation("annulla", language="it"), "cancel")

    def test_unknown_language_falls_back_to_english(self):
        self.assertEqual(parse_confirmation("confirm", language="xx-not-real"), "confirm")

    def test_wrong_language_word_is_unclear_not_a_false_positive(self):
        # Spanish "sí" spoken while configured for French shouldn't accidentally
        # match French's word list and produce a false confirm.
        self.assertEqual(parse_confirmation("sí", language="fr"), "unclear")


if __name__ == "__main__":
    unittest.main()
