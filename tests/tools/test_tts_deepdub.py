"""Tests for the DeepDub Hebrew TTS provider in tools/tts_tool.py."""

import json
from unittest.mock import MagicMock, patch


class _Response:
    status_code = 200
    content = b"audio-bytes"


class TestGenerateDeepDubTts:
    def test_successful_mp3_generation(self, tmp_path, monkeypatch):
        from tools.tts_tool import _generate_deepdub_tts

        monkeypatch.setenv("DEEPDUB_API_KEY", "test-key")
        output_path = str(tmp_path / "voice.mp3")

        with patch("requests.post", return_value=_Response()) as post:
            result = _generate_deepdub_tts("שלום", output_path, {"deepdub": {}})

        assert result == output_path
        assert (tmp_path / "voice.mp3").read_bytes() == b"audio-bytes"
        call = post.call_args
        assert call.kwargs["headers"]["x-api-key"] == "test-key"
        assert call.kwargs["json"]["locale"] == "he-IL"
        assert call.kwargs["json"]["format"] == "mp3"

    def test_ogg_generation_transcodes_to_opus(self, tmp_path, monkeypatch):
        from tools.tts_tool import _generate_deepdub_tts

        monkeypatch.setenv("DEEPDUB_API_KEY", "test-key")
        output_path = str(tmp_path / "voice.ogg")

        def fake_transcode(raw_path, final_path):
            assert raw_path.endswith(".deepdub.mp3")
            assert final_path == output_path
            with open(final_path, "wb") as f:
                f.write(b"opus")
            return final_path

        with patch("requests.post", return_value=_Response()), patch(
            "tools.tts_tool._transcode_to_opus", side_effect=fake_transcode
        ):
            result = _generate_deepdub_tts("שלום", output_path, {"deepdub": {}})

        assert result == output_path
        assert (tmp_path / "voice.ogg").read_bytes() == b"opus"
        assert not (tmp_path / "voice.deepdub.mp3").exists()


class TestTtsDispatcherDeepDub:
    def test_telegram_output_is_voice_compatible(self, tmp_path, monkeypatch):
        from tools.tts_tool import text_to_speech_tool

        monkeypatch.setenv("HERMES_SESSION_PLATFORM", "telegram")

        def fake_generate(_text, output_path, _config):
            assert output_path.endswith(".ogg")
            with open(output_path, "wb") as f:
                f.write(b"opus")
            return output_path

        with patch("tools.tts_tool._load_tts_config", return_value={"provider": "deepdub"}), patch(
            "tools.tts_tool._generate_deepdub_tts", side_effect=fake_generate
        ):
            result = json.loads(text_to_speech_tool("שלום"))

        assert result["success"] is True
        assert result["provider"] == "deepdub"
        assert result["file_path"].endswith(".ogg")
        assert result["voice_compatible"] is True
        assert "[[audio_as_voice]]" in result["media_tag"]


class TestSpeakableTtsText:
    def test_letters_and_numbers_are_speakable(self):
        from tools.tts_tool import is_speakable_tts_text

        assert is_speakable_tts_text("שלום 😊") is True
        assert is_speakable_tts_text("123") is True

    def test_emoji_and_punctuation_only_are_not_speakable(self):
        from tools.tts_tool import is_speakable_tts_text

        assert is_speakable_tts_text("😊✅") is False
        assert is_speakable_tts_text("!!! ---") is False

    def test_text_to_speech_skips_emoji_only(self):
        from tools.tts_tool import text_to_speech_tool

        with patch("tools.tts_tool._generate_deepdub_tts") as generate, patch(
            "tools.tts_tool._load_tts_config", return_value={"provider": "deepdub"}
        ):
            result = json.loads(text_to_speech_tool("😊✅"))

        assert result["success"] is False
        assert "no speakable text" in result["error"]
        generate.assert_not_called()


class TestCheckTtsRequirementsDeepDub:
    def test_deepdub_provider_requires_env_key(self, monkeypatch):
        from tools.tts_tool import check_tts_requirements

        monkeypatch.delenv("DEEPDUB_API_KEY", raising=False)
        monkeypatch.delenv("DEEPDUB_TRIAL_KEY", raising=False)
        with patch("tools.tts_tool._load_tts_config", return_value={"provider": "deepdub"}):
            assert check_tts_requirements() is False

    def test_deepdub_provider_returns_true_with_env_key(self, monkeypatch):
        from tools.tts_tool import check_tts_requirements

        monkeypatch.setenv("DEEPDUB_API_KEY", "test-key")
        with patch("tools.tts_tool._load_tts_config", return_value={"provider": "deepdub"}):
            assert check_tts_requirements() is True
