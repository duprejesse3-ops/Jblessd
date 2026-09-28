# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import shutil
import subprocess
import tempfile
import unittest
from unittest import mock

import numpy as np

from lib import termux_audio


class TestIsTermux(unittest.TestCase):
    def test_true_when_prefix_env_contains_com_termux(self):
        with mock.patch.dict("os.environ", {"PREFIX": "/data/data/com.termux/files/usr"}):
            self.assertTrue(termux_audio.is_termux())

    def test_true_when_record_binary_is_on_path_even_without_prefix(self):
        with mock.patch.dict("os.environ", {"PREFIX": ""}, clear=False):
            with mock.patch("shutil.which", return_value="/usr/bin/termux-microphone-record"):
                self.assertTrue(termux_audio.is_termux())

    def test_false_on_a_plain_desktop_environment(self):
        with mock.patch.dict("os.environ", {"PREFIX": "/usr"}, clear=False):
            with mock.patch("shutil.which", return_value=None):
                self.assertFalse(termux_audio.is_termux())


class TestDecodeToFloat32(unittest.TestCase):
    def setUp(self):
        if not shutil.which("ffmpeg"):
            self.skipTest("ffmpeg not available in this environment")

    def test_decodes_a_real_wav_file_to_the_expected_float32_array(self):
        rate = 16000
        tone = (0.5 * np.sin(2 * np.pi * 440 * np.arange(rate) / rate)).astype("float32")

        with tempfile.NamedTemporaryFile(suffix=".wav") as wav_file:
            # Write a real WAV using ffmpeg itself so this test round-trips
            # through the exact binary termux_audio shells out to, rather
            # than trusting a second, unrelated WAV writer to agree with it.
            proc = subprocess.run(
                [
                    "ffmpeg", "-y", "-v", "error",
                    "-f", "f32le", "-ar", str(rate), "-ac", "1", "-i", "-",
                    wav_file.name,
                ],
                input=tone.tobytes(),
                capture_output=True,
            )
            self.assertEqual(proc.returncode, 0, proc.stderr)

            decoded = termux_audio._decode_to_float32(wav_file.name, rate)

        self.assertEqual(decoded.dtype, np.dtype("float32"))
        self.assertGreater(len(decoded), 0)
        # Lossy container round-trip (this exercises the real ffmpeg binary),
        # so compare on shape/energy rather than bit-for-bit equality.
        self.assertAlmostEqual(
            float(np.sqrt(np.mean(np.square(decoded)))),
            float(np.sqrt(np.mean(np.square(tone)))),
            places=2,
        )

    def test_missing_ffmpeg_raises_a_runtime_error_instead_of_returning_silence(self):
        with mock.patch("shutil.which", return_value=None):
            with self.assertRaises(RuntimeError):
                termux_audio._decode_to_float32("/tmp/does-not-matter.m4a", 16000)

    def test_ffmpeg_failure_raises_with_its_stderr_instead_of_returning_silence(self):
        with mock.patch("shutil.which", return_value="/usr/bin/ffmpeg"):
            failed = subprocess.CompletedProcess(args=[], returncode=1, stdout=b"", stderr=b"no such file")
            with mock.patch("subprocess.run", return_value=failed):
                with self.assertRaises(RuntimeError):
                    termux_audio._decode_to_float32("/tmp/does-not-exist.m4a", 16000)


class TestRecordClip(unittest.TestCase):
    def test_missing_termux_api_binary_raises_a_clear_runtime_error(self):
        with mock.patch("subprocess.run", side_effect=FileNotFoundError()):
            with self.assertRaises(RuntimeError) as ctx:
                termux_audio._record_clip(1.0, 16000)
        self.assertIn("termux-microphone-record", str(ctx.exception))

    def test_recording_that_never_produces_a_file_returns_silence_not_an_error(self):
        # termux-microphone-record itself exits 0 (start/stop both succeed)
        # but if the Termux:API app declined mic permission, no file ever
        # appears -- that's "no audio captured", not a crash.
        with mock.patch("subprocess.run", return_value=subprocess.CompletedProcess([], 0)):
            with mock.patch("time.sleep"):
                with mock.patch("os.path.exists", return_value=False):
                    result = termux_audio._record_clip(1.0, 16000)
        self.assertEqual(len(result), 0)


class TestSpeakTermux(unittest.TestCase):
    def test_returns_true_when_the_language_specific_call_succeeds(self):
        with mock.patch("subprocess.run", return_value=subprocess.CompletedProcess([], 0)) as run:
            self.assertTrue(termux_audio.speak_termux("hello", "en"))
        run.assert_called_once()
        self.assertIn("-l", run.call_args[0][0])

    def test_falls_back_to_default_voice_when_language_flag_is_rejected(self):
        calls = [
            subprocess.CalledProcessError(1, ["termux-tts-speak", "-l", "xx", "hi"]),
            subprocess.CompletedProcess([], 0),
        ]

        def fake_run(*args, **kwargs):
            result = calls.pop(0)
            if isinstance(result, Exception):
                raise result
            return result

        with mock.patch("subprocess.run", side_effect=fake_run) as run:
            self.assertTrue(termux_audio.speak_termux("hi", "xx"))
        self.assertEqual(run.call_count, 2)

    def test_returns_false_when_the_binary_is_missing_entirely(self):
        with mock.patch("subprocess.run", side_effect=FileNotFoundError()):
            self.assertFalse(termux_audio.speak_termux("hello"))


if __name__ == "__main__":
    unittest.main()
