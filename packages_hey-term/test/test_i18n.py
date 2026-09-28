# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import unittest

from lib.i18n import DEFAULT_LANGUAGE, get, is_translated, list_languages


class TestI18n(unittest.TestCase):
    def test_default_language_is_english(self):
        self.assertEqual(DEFAULT_LANGUAGE, "en")

    def test_get_known_language_returns_its_own_strings(self):
        strings = get("es")
        self.assertEqual(strings["name"], "Español")

    def test_get_unknown_language_falls_back_to_english(self):
        strings = get("xx-not-real")
        self.assertEqual(strings["name"], "English")

    def test_is_translated_true_for_known_language(self):
        self.assertTrue(is_translated("fr"))

    def test_is_translated_false_for_unknown_language(self):
        self.assertFalse(is_translated("xx-not-real"))

    def test_list_languages_includes_all_shipped_translations(self):
        langs = list_languages()
        for expected in ["en", "es", "fr", "de", "pt", "it"]:
            self.assertIn(expected, langs)

    def test_every_language_has_the_same_string_keys_as_english(self):
        english_keys = set(get("en").keys())
        for code in list_languages():
            with self.subTest(language=code):
                self.assertEqual(set(get(code).keys()), english_keys, f"{code} is missing or has extra keys vs. en")

    def test_every_language_has_nonempty_yes_and_no_word_lists(self):
        for code in list_languages():
            with self.subTest(language=code):
                strings = get(code)
                self.assertTrue(strings["yes_words"])
                self.assertTrue(strings["no_words"])
                # A word can't mean both yes and no in the same language --
                # that would make every reply in that word ambiguous.
                self.assertEqual(strings["yes_words"] & strings["no_words"], set())


if __name__ == "__main__":
    unittest.main()
