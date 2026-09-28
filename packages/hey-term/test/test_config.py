# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import importlib
import os
import tempfile
import unittest
from unittest import mock

from lib import config


class TestExtraDangerousPatterns(unittest.TestCase):
    def test_builtin_patterns_always_present(self):
        self.assertIn("rm -rf /", config.DANGEROUS_PATTERNS)

    def test_env_var_adds_patterns(self):
        with mock.patch.dict(os.environ, {"EXTRA_DANGEROUS_PATTERNS": "kubectl delete namespace, terraform destroy"}):
            extra = config._load_extra_patterns()
        self.assertIn("kubectl delete namespace", extra)
        self.assertIn("terraform destroy", extra)

    def test_patterns_file_adds_patterns(self):
        with tempfile.TemporaryDirectory() as tmp:
            patterns_path = os.path.join(tmp, "patterns.txt")
            with open(patterns_path, "w") as f:
                f.write("# a comment\n")
                f.write("drop prod_customers\n")
                f.write("\n")
                f.write("git push origin release\n")
            with mock.patch.dict(os.environ, {"PATTERNS_FILE": patterns_path}, clear=False):
                extra = config._load_extra_patterns()
        self.assertEqual(extra, ["drop prod_customers", "git push origin release"])

    def test_missing_patterns_file_is_not_an_error(self):
        with mock.patch.dict(os.environ, {"PATTERNS_FILE": "/no/such/file.txt"}):
            extra = config._load_extra_patterns()
        self.assertEqual(extra, [])

    def test_command_timeout_seconds_configurable_via_env(self):
        with mock.patch.dict(os.environ, {"COMMAND_TIMEOUT_SECONDS": "45"}):
            reloaded = importlib.reload(config)
        try:
            self.assertEqual(reloaded.COMMAND_TIMEOUT_SECONDS, 45.0)
        finally:
            importlib.reload(config)  # restore normal env for every other test


if __name__ == "__main__":
    unittest.main()
