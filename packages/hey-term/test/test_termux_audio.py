# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import os
import shutil
import subprocess
import tempfile
import unittest
import wave
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


class TestAndroidTtsLanguageTag(unittest.TestCase):
    def test_known_language_maps_to_a_bcp47_tag(self):
        self.assertEqual(termux_audio.android_tts_language_tag("en"), "en-US")
        self.assertEqual(termux_audio.android_tts_language_tag("es"), "es-ES")

    def test_unknown_or_auto_returns_none(self):
        self.assertIsNone(termux_audio.android_tts_language_tag("auto"))
        self.assertIsNone(termux_audio.android_tts_language_tag("xx"))


class TestFindWhisperCliAndModel(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()

    def tearDown(self):
        self._tmp.cleanup()

    def test_find_whisper_cli_none_when_path_does_not_exist(self):
        with mock.patch.object(termux_audio.config, "WHISPER_CPP_BIN", os.path.join(self._tmp.name, "nope")):
            self.assertIsNone(termux_audio.find_whisper_cli())

    def test_find_whisper_cli_none_when_present_but_not_executable(self):
        path = os.path.join(self._tmp.name, "whisper-cli")
        with open(path, "w") as f:
            f.write("not actually executable")
        os.chmod(path, 0o644)
        with mock.patch.object(termux_audio.config, "WHISPER_CPP_BIN", path):
            self.assertIsNone(termux_audio.find_whisper_cli())

    def test_find_whisper_cli_found_when_present_and_executable(self):
        path = os.path.join(self._tmp.name, "whisper-cli")
        with open(path, "w") as f:
            f.write("#!/bin/sh\n")
        os.chmod(path, 0o755)
        with mock.patch.object(termux_audio.config, "WHISPER_CPP_BIN", path):
            self.assertEqual(termux_audio.find_whisper_cli(), path)

    def test_find_whisper_model_none_when_missing(self):
        with mock.patch.object(termux_audio.config, "WHISPER_CPP_MODELS_DIR", self._tmp.name), \
             mock.patch.object(termux_audio.config, "WHISPER_MODEL_SIZE", "base"):
            self.assertIsNone(termux_audio.find_whisper_model())

    def test_find_whisper_model_found_when_present(self):
        model_path = os.path.join(self._tmp.name, "ggml-base.bin")
        open(model_path, "w").close()
        with mock.patch.object(termux_audio.config, "WHISPER_CPP_MODELS_DIR", self._tmp.name), \
             mock.patch.object(termux_audio.config, "WHISPER_MODEL_SIZE", "base"):
            self.assertEqual(termux_audio.find_whisper_model(), model_path)


class TestWriteWav(unittest.TestCase):
    def test_round_trips_a_float32_clip_as_16_bit_pcm(self):
        rate = 16000
        tone = (0.5 * np.sin(2 * np.pi * 440 * np.arange(rate) / rate)).astype("float32")

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            path = f.name
        try:
            termux_audio._write_wav(tone, rate, path)
            with wave.open(path, "rb") as wf:
                self.assertEqual(wf.getnchannels(), 1)
                self.assertEqual(wf.getsampwidth(), 2)
                self.assertEqual(wf.getframerate(), rate)
                frames = wf.readframes(wf.getnframes())
            decoded = np.frombuffer(frames, dtype="<i2").astype("float32") / 32767.0
            self.assertEqual(len(decoded), len(tone))
            self.assertAlmostEqual(
                float(np.sqrt(np.mean(np.square(decoded)))),
                float(np.sqrt(np.mean(np.square(tone)))),
                places=3,
            )
        finally:
            os.remove(path)

    def test_clips_out_of_range_samples_instead_of_wrapping(self):
        rate = 8000
        loud = np.array([2.0, -2.0, 0.0], dtype="float32")
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            path = f.name
        try:
            termux_audio._write_wav(loud, rate, path)
            with wave.open(path, "rb") as wf:
                frames = wf.readframes(wf.getnframes())
            decoded = np.frombuffer(frames, dtype="<i2")
            self.assertEqual(decoded[0], 32767)
            self.assertEqual(decoded[1], -32767)
        finally:
            os.remove(path)


class TestTranscribeTermux(unittest.TestCase):
    def setUp(self):
        termux_audio._setup_incomplete_warned = False

    def test_empty_audio_returns_empty_string_without_touching_the_binary(self):
        with mock.patch.object(termux_audio, "find_whisper_cli") as fake_find:
            result = termux_audio.transcribe_termux(np.zeros(0, dtype="float32"), 16000)
        fake_find.assert_not_called()
        self.assertEqual(result, "")

    def test_missing_setup_returns_empty_string_and_warns_once(self):
        audio = np.ones(1000, dtype="float32") * 0.1
        with mock.patch.object(termux_audio, "find_whisper_cli", return_value=None), \
             mock.patch.object(termux_audio, "find_whisper_model", return_value="/some/model.bin"), \
             mock.patch("builtins.print") as fake_print:
            self.assertEqual(termux_audio.transcribe_termux(audio, 16000), "")
            self.assertEqual(termux_audio.transcribe_termux(audio, 16000), "")
        # Only the first call prints the setup-incomplete notice.
        setup_notices = [c for c in fake_print.call_args_list if "isn't set up yet" in str(c)]
        self.assertEqual(len(setup_notices), 1)

    def test_successful_transcription_reads_the_output_text_file_and_cleans_up(self):
        audio = np.ones(1000, dtype="float32") * 0.1

        def fake_run(args, **kwargs):
            # -of is followed by the output basename; whisper-cli itself
            # would write <basename>.txt -- simulate that side effect here
            # since we're not invoking the real binary in this test.
            out_base = args[args.index("-of") + 1]
            with open(out_base + ".txt", "w", encoding="utf-8") as f:
                f.write("list the files\n")
            return subprocess.CompletedProcess(args, 0)

        with mock.patch.object(termux_audio, "find_whisper_cli", return_value="/fake/whisper-cli"), \
             mock.patch.object(termux_audio, "find_whisper_model", return_value="/fake/model.bin"), \
             mock.patch("subprocess.run", side_effect=fake_run):
            result = termux_audio.transcribe_termux(audio, 16000, language="en")

        self.assertEqual(result, "list the files")
        # No leftover temp files (the .wav or the .txt) after a successful call.
        leftovers = [p for p in os.listdir(tempfile.gettempdir()) if p.startswith("hey-term-stt-")]
        self.assertEqual(leftovers, [])

    def test_nonzero_exit_returns_empty_string(self):
        audio = np.ones(1000, dtype="float32") * 0.1
        with mock.patch.object(termux_audio, "find_whisper_cli", return_value="/fake/whisper-cli"), \
             mock.patch.object(termux_audio, "find_whisper_model", return_value="/fake/model.bin"), \
             mock.patch("subprocess.run", return_value=subprocess.CompletedProcess([], 1)):
            self.assertEqual(termux_audio.transcribe_termux(audio, 16000), "")

    def test_timeout_returns_empty_string_instead_of_raising(self):
        audio = np.ones(1000, dtype="float32") * 0.1
        with mock.patch.object(termux_audio, "find_whisper_cli", return_value="/fake/whisper-cli"), \
             mock.patch.object(termux_audio, "find_whisper_model", return_value="/fake/model.bin"), \
             mock.patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="whisper-cli", timeout=60)):
            self.assertEqual(termux_audio.transcribe_termux(audio, 16000), "")


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
        self.assertIn("en-US", run.call_args[0][0])

    def test_falls_back_to_default_voice_when_language_flag_is_rejected(self):
        calls = [
            subprocess.CalledProcessError(1, ["termux-tts-speak", "-l", "en-US", "hi"]),
            subprocess.CompletedProcess([], 0),
        ]

        def fake_run(*args, **kwargs):
            result = calls.pop(0)
            if isinstance(result, Exception):
                raise result
            return result

        with mock.patch("subprocess.run", side_effect=fake_run) as run:
            self.assertTrue(termux_audio.speak_termux("hi", "en"))
        self.assertEqual(run.call_count, 2)

    def test_unmapped_language_skips_straight_to_the_plain_call(self):
        with mock.patch("subprocess.run", return_value=subprocess.CompletedProcess([], 0)) as run:
            self.assertTrue(termux_audio.speak_termux("hi", "xx"))
        run.assert_called_once()
        self.assertNotIn("-l", run.call_args[0][0])

    def test_returns_false_when_the_binary_is_missing_entirely(self):
        with mock.patch("subprocess.run", side_effect=FileNotFoundError()):
            self.assertFalse(termux_audio.speak_termux("hello"))


if __name__ == "__main__":
    unittest.main()
