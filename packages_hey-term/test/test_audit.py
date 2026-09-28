# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import os
import tempfile
import unittest

from lib import audit, config


class TestAudit(unittest.TestCase):
    def setUp(self):
        self._orig_path = config.AUDIT_LOG_PATH
        self._tmpdir = tempfile.TemporaryDirectory()
        config.AUDIT_LOG_PATH = os.path.join(self._tmpdir.name, "audit.jsonl")

    def tearDown(self):
        config.AUDIT_LOG_PATH = self._orig_path
        self._tmpdir.cleanup()

    def test_log_event_appends_a_json_line(self):
        audit.log_event("test_event", foo="bar")
        events = audit.read_events()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["kind"], "test_event")
        self.assertEqual(events[0]["foo"], "bar")

    def test_multiple_events_append_in_order(self):
        audit.log_event("first")
        audit.log_event("second")
        events = audit.read_events()
        self.assertEqual([e["kind"] for e in events], ["first", "second"])

    def test_every_event_has_a_timestamp(self):
        audit.log_event("timed")
        events = audit.read_events()
        self.assertIn("ts", events[0])
        self.assertIn("iso", events[0])

    def test_read_events_on_missing_file_returns_empty_list(self):
        config.AUDIT_LOG_PATH = os.path.join(self._tmpdir.name, "does-not-exist.jsonl")
        self.assertEqual(audit.read_events(), [])

    def test_read_events_skips_a_corrupted_line_without_crashing(self):
        with open(config.AUDIT_LOG_PATH, "w", encoding="utf-8") as f:
            f.write("not valid json\n")
            f.write('{"kind": "ok_line"}\n')
        events = audit.read_events()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["kind"], "ok_line")


if __name__ == "__main__":
    unittest.main()
