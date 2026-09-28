# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import queue
import time
import unittest
from unittest import mock

import main


class TestStdinReaderLoop(unittest.TestCase):
    def test_enqueues_each_nonempty_stripped_line_until_eof(self):
        lines = iter(["  list files  ", "", "cost", EOFError()])

        def fake_input():
            item = next(lines)
            if isinstance(item, Exception):
                raise item
            return item

        q = queue.Queue()
        main._stdin_reader_loop(input_fn=fake_input, out_queue=q)

        self.assertEqual(q.get_nowait(), "list files")
        self.assertEqual(q.get_nowait(), "cost")
        self.assertTrue(q.empty())

    def test_returns_immediately_on_first_eof_without_enqueuing_anything(self):
        def fake_input():
            raise EOFError()

        q = queue.Queue()
        main._stdin_reader_loop(input_fn=fake_input, out_queue=q)
        self.assertTrue(q.empty())


class TestTakeTypedRequest(unittest.TestCase):
    def setUp(self):
        # take_typed_request() reads the module-level queue -- swap it out
        # per test so tests can't see each other's leftover items.
        self._original_queue = main._typed_input_queue
        main._typed_input_queue = queue.Queue()

    def tearDown(self):
        main._typed_input_queue = self._original_queue

    def test_returns_none_when_nothing_has_been_typed(self):
        self.assertIsNone(main.take_typed_request())

    def test_returns_a_queued_line_without_blocking(self):
        main._typed_input_queue.put("check disk space")
        start = time.monotonic()
        result = main.take_typed_request()
        elapsed = time.monotonic() - start
        self.assertEqual(result, "check disk space")
        self.assertLess(elapsed, 0.5)


class TestStartStdinReader(unittest.TestCase):
    def setUp(self):
        self._original_thread = main._stdin_reader_thread

    def tearDown(self):
        main._stdin_reader_thread = self._original_thread

    def test_returns_false_and_starts_nothing_when_stdin_is_not_a_tty(self):
        main._stdin_reader_thread = None
        with mock.patch("sys.stdin") as fake_stdin:
            fake_stdin.isatty.return_value = False
            self.assertFalse(main.start_stdin_reader())
        self.assertIsNone(main._stdin_reader_thread)

    def test_returns_true_and_starts_a_thread_when_stdin_is_a_tty(self):
        main._stdin_reader_thread = None
        with mock.patch("sys.stdin") as fake_stdin:
            fake_stdin.isatty.return_value = True
            with mock.patch("threading.Thread") as fake_thread_cls:
                fake_thread = mock.Mock()
                fake_thread_cls.return_value = fake_thread
                self.assertTrue(main.start_stdin_reader())
        fake_thread.start.assert_called_once()

    def test_second_call_is_a_noop_once_already_started(self):
        main._stdin_reader_thread = mock.Mock()  # pretend already started
        with mock.patch("threading.Thread") as fake_thread_cls:
            self.assertTrue(main.start_stdin_reader())
        fake_thread_cls.assert_not_called()


if __name__ == "__main__":
    unittest.main()
