# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import os
import tempfile
import unittest

from lib import cost


class TestCost(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.path = os.path.join(self._tmp.name, "cost.json")

    def tearDown(self):
        self._tmp.cleanup()

    def test_estimate_cost_known_model(self):
        # 1M input + 1M output tokens on sonnet-4-5 at $3/$15 per million.
        value = cost.estimate_cost("claude-sonnet-4-5", 1_000_000, 1_000_000)
        self.assertAlmostEqual(value, 18.00, places=2)

    def test_estimate_cost_unknown_model_uses_default(self):
        known = cost.estimate_cost("claude-sonnet-4-5", 1000, 1000)
        unknown = cost.estimate_cost("some-future-model", 1000, 1000)
        self.assertEqual(known, unknown)

    def test_get_totals_empty_when_no_file(self):
        totals = cost.get_totals(self.path)
        self.assertEqual(totals["total_cost_usd"], 0.0)
        self.assertEqual(totals["requests"], 0)

    def test_record_usage_accumulates(self):
        cost.record_usage("claude-sonnet-4-5", 1000, 500, path=self.path)
        cost.record_usage("claude-sonnet-4-5", 2000, 1000, path=self.path)
        totals = cost.get_totals(self.path)
        self.assertEqual(totals["requests"], 2)
        self.assertEqual(totals["total_input_tokens"], 3000)
        self.assertEqual(totals["total_output_tokens"], 1500)
        self.assertGreater(totals["total_cost_usd"], 0)

    def test_spoken_summary_no_requests(self):
        summary = cost.spoken_summary(self.path)
        self.assertIn("hasn't made any Claude requests", summary)

    def test_spoken_summary_after_usage(self):
        cost.record_usage("claude-sonnet-4-5", 1_000_000, 1_000_000, path=self.path)
        summary = cost.spoken_summary(self.path)
        self.assertIn("$18.00", summary)
        self.assertIn("1 request", summary)


if __name__ == "__main__":
    unittest.main()
