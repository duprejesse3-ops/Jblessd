# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import sys
import tempfile
import time
import unittest

from lib import jobs


class TestJobs(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.work_dir = self._tmp.name

    def tearDown(self):
        self._tmp.cleanup()

    def _wait_until_finished(self, job_id, timeout=10):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            for record in jobs.list_jobs(self.work_dir):
                if record["id"] == job_id and record["status"] == "finished":
                    return record
            time.sleep(0.1)
        self.fail(f"job {job_id} did not finish within {timeout}s")

    def test_start_returns_a_job_record_with_pid(self):
        # A near-instant command may already be reaped (status "finished")
        # by the time start() returns, since the reaper thread races the
        # caller -- that's correct, not flaky, so this only asserts the
        # shape of the record, not a status that a fast command can't
        # reliably still be in by the time we check it.
        record = jobs.start("echo background-job-output", work_dir=self.work_dir)
        self.assertIn("id", record)
        self.assertIn("pid", record)
        self.assertIn(record["status"], ("running", "finished"))

    def test_list_jobs_empty_when_none_started(self):
        self.assertEqual(jobs.list_jobs(self.work_dir), [])

    def test_job_eventually_reports_finished(self):
        record = jobs.start("echo done-marker", work_dir=self.work_dir)
        finished = self._wait_until_finished(record["id"])
        self.assertEqual(finished["status"], "finished")

    def test_tail_log_contains_command_output(self):
        record = jobs.start("echo hello-from-job", work_dir=self.work_dir)
        self._wait_until_finished(record["id"])
        log = jobs.tail_log(record["id"], work_dir=self.work_dir)
        self.assertIn("hello-from-job", log)

    def test_tail_log_missing_job_returns_empty_string(self):
        self.assertEqual(jobs.tail_log("no-such-job", work_dir=self.work_dir), "")

    def test_list_jobs_includes_label(self):
        jobs.start("echo x", work_dir=self.work_dir, label="test label")
        records = jobs.list_jobs(self.work_dir)
        self.assertEqual(records[0]["label"], "test label")


if __name__ == "__main__":
    unittest.main()
