#!/usr/bin/env python3
# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Runs every test module in this folder and prints a pass/fail count.
Only exercises pure logic (planning parsing, safety patterns, wake-word
matching, confirmation parsing, the command executor against real `echo`/
`exit` calls) -- nothing here touches a microphone, speaker, or the network,
so it runs the same in this sandbox as on a real machine.
"""
import sys
import unittest


def main() -> int:
    loader = unittest.TestLoader()
    suite = loader.discover(start_dir=".", pattern="test_*.py")
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main())
