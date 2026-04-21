import json
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from gateway.config import Platform, PlatformConfig, load_gateway_config


@pytest.fixture(autouse=True)
def clear_whatsapp_gating_env(monkeypatch):
    monkeypatch.delenv("WHATSAPP_REQUIRE_MENTION", raising=False)
    monkeypatch.delenv("WHATSAPP_MENTION_PATTERNS", raising=False)
    monkeypatch.delenv("WHATSAPP_FREE_RESPONSE_CHATS", raising=False)
    monkeypatch.delenv("WHATSAPP_FREE_RESPONSE_GROUP_USERS", raising=False)


def _make_adapter(
    require_mention=None,
    mention_patterns=None,
    free_response_chats=None,
    free_response_group_users=None,
):
    from gateway.platforms.whatsapp import WhatsAppAdapter

    extra = {}
    if require_mention is not None:
        extra["require_mention"] = require_mention
    if mention_patterns is not None:
        extra["mention_patterns"] = mention_patterns
    if free_response_chats is not None:
        extra["free_response_chats"] = free_response_chats
    if free_response_group_users is not None:
        extra["free_response_group_users"] = free_response_group_users

    adapter = object.__new__(WhatsAppAdapter)
    adapter.platform = Platform.WHATSAPP
    adapter.config = PlatformConfig(enabled=True, extra=extra)
    adapter._session_path = Path(extra.get("session_path", "/tmp/hermes-whatsapp-test-session"))
    adapter._message_handler = AsyncMock()
    adapter._mention_patterns = adapter._compile_mention_patterns()
    return adapter


def _group_message(body="hello", **overrides):
    data = {
        "isGroup": True,
        "body": body,
        "chatId": "120363001234567890@g.us",
        "senderId": "19175395595@s.whatsapp.net",
        "mentionedIds": [],
        "botIds": ["15551230000@s.whatsapp.net", "15551230000@lid"],
        "quotedParticipant": "",
    }
    data.update(overrides)
    return data


def test_group_messages_can_be_opened_via_config():
    adapter = _make_adapter(require_mention=False)

    assert adapter._should_process_message(_group_message("hello everyone")) is True


def test_group_messages_can_require_direct_trigger_via_config():
    adapter = _make_adapter(require_mention=True)

    assert adapter._should_process_message(_group_message("hello everyone")) is False
    assert adapter._should_process_message(
        _group_message(
            "hi there",
            mentionedIds=["15551230000@s.whatsapp.net"],
        )
    ) is True
    assert adapter._should_process_message(
        _group_message(
            "replying",
            quotedParticipant="15551230000@lid",
        )
    ) is True
    assert adapter._should_process_message(_group_message("/status")) is True


def test_regex_mention_patterns_allow_custom_wake_words():
    adapter = _make_adapter(require_mention=True, mention_patterns=[r"^\s*chompy\b"])

    assert adapter._should_process_message(_group_message("chompy status")) is True
    assert adapter._should_process_message(_group_message("   chompy help")) is True
    assert adapter._should_process_message(_group_message("hey chompy")) is False


def test_invalid_regex_patterns_are_ignored():
    adapter = _make_adapter(require_mention=True, mention_patterns=[r"(", r"^\s*chompy\b"])

    assert adapter._should_process_message(_group_message("chompy status")) is True
    assert adapter._should_process_message(_group_message("hello everyone")) is False


def test_config_bridges_whatsapp_group_settings(monkeypatch, tmp_path):
    hermes_home = tmp_path / ".hermes"
    hermes_home.mkdir()
    (hermes_home / "config.yaml").write_text(
        "whatsapp:\n"
        "  require_mention: true\n"
        "  mention_patterns:\n"
        "    - \"^\\\\s*chompy\\\\b\"\n"
        "  free_response_group_users:\n"
        "    120363001234567890@g.us:\n"
        "      - 19175395595@s.whatsapp.net\n",
        encoding="utf-8",
    )

    monkeypatch.setenv("HERMES_HOME", str(hermes_home))
    monkeypatch.delenv("WHATSAPP_REQUIRE_MENTION", raising=False)
    monkeypatch.delenv("WHATSAPP_MENTION_PATTERNS", raising=False)
    monkeypatch.delenv("WHATSAPP_FREE_RESPONSE_GROUP_USERS", raising=False)

    config = load_gateway_config()

    assert config is not None
    assert config.platforms[Platform.WHATSAPP].extra["require_mention"] is True
    assert config.platforms[Platform.WHATSAPP].extra["mention_patterns"] == [r"^\s*chompy\b"]
    assert config.platforms[Platform.WHATSAPP].extra["free_response_group_users"] == {
        "120363001234567890@g.us": ["19175395595@s.whatsapp.net"],
    }
    assert __import__("os").environ["WHATSAPP_REQUIRE_MENTION"] == "true"
    assert json.loads(__import__("os").environ["WHATSAPP_MENTION_PATTERNS"]) == [r"^\s*chompy\b"]
    assert json.loads(__import__("os").environ["WHATSAPP_FREE_RESPONSE_GROUP_USERS"]) == {
        "120363001234567890@g.us": ["19175395595@s.whatsapp.net"],
    }


def test_free_response_chats_bypass_mention_gating():
    adapter = _make_adapter(
        require_mention=True,
        free_response_chats=["120363001234567890@g.us"],
    )

    assert adapter._should_process_message(_group_message("hello everyone")) is True


def test_free_response_chats_does_not_bypass_other_groups():
    adapter = _make_adapter(
        require_mention=True,
        free_response_chats=["999999999999@g.us"],
    )

    assert adapter._should_process_message(_group_message("hello everyone")) is False


def test_free_response_group_users_bypasses_mention_for_matching_sender_only():
    adapter = _make_adapter(
        require_mention=True,
        free_response_group_users={
            "120363001234567890@g.us": ["19175395595@s.whatsapp.net"],
        },
    )

    assert adapter._should_process_message(
        _group_message("Rotem can ask freely", senderId="19175395595@s.whatsapp.net")
    ) is True
    assert adapter._should_process_message(
        _group_message("other participant still needs mention", senderId="15550001111@s.whatsapp.net")
    ) is False


def test_free_response_group_users_matches_lid_or_bare_phone_syntax():
    adapter = _make_adapter(
        require_mention=True,
        free_response_group_users={
            "120363001234567890@g.us": ["+19175395595"],
        },
    )

    assert adapter._should_process_message(
        _group_message("Rotem via LID syntax", senderId="19175395595:12@lid")
    ) is True


def test_free_response_group_users_resolves_phone_lid_aliases(tmp_path):
    session_path = tmp_path / "session"
    session_path.mkdir()
    (session_path / "lid-mapping-19175395595.json").write_text(
        json.dumps("267383306489914"),
        encoding="utf-8",
    )

    adapter = _make_adapter(
        require_mention=True,
        free_response_group_users={
            "120363001234567890@g.us": ["19175395595@s.whatsapp.net"],
        },
    )
    adapter._session_path = session_path

    assert adapter._should_process_message(
        _group_message("Rotem via mapped LID", senderId="267383306489914@lid")
    ) is True


def test_free_response_group_users_does_not_bypass_other_groups():
    adapter = _make_adapter(
        require_mention=True,
        free_response_group_users={
            "999999999999@g.us": ["19175395595@s.whatsapp.net"],
        },
    )

    assert adapter._should_process_message(
        _group_message("Rotem still needs trigger in unlisted group", senderId="19175395595@s.whatsapp.net")
    ) is False


def test_non_free_group_user_can_still_trigger_with_mention_or_reply():
    adapter = _make_adapter(
        require_mention=True,
        free_response_group_users={
            "120363001234567890@g.us": ["19175395595@s.whatsapp.net"],
        },
    )

    assert adapter._should_process_message(
        _group_message(
            "hi Hermes",
            senderId="15550001111@s.whatsapp.net",
            mentionedIds=["15551230000@s.whatsapp.net"],
        )
    ) is True
    assert adapter._should_process_message(
        _group_message(
            "replying to Hermes",
            senderId="15550001111@s.whatsapp.net",
            quotedParticipant="15551230000@lid",
        )
    ) is True


def test_dm_always_passes_even_with_require_mention():
    adapter = _make_adapter(require_mention=True)

    dm = {"isGroup": False, "body": "hello", "botIds": [], "mentionedIds": []}
    assert adapter._should_process_message(dm) is True


def test_mention_stripping_removes_bot_phone_from_body():
    adapter = _make_adapter(require_mention=True)

    data = _group_message("@15551230000 what is the weather?")
    cleaned = adapter._clean_bot_mention_text(data["body"], data)
    assert "15551230000" not in cleaned
    assert "weather" in cleaned


def test_mention_stripping_preserves_body_when_no_mention():
    adapter = _make_adapter(require_mention=True)

    data = _group_message("just a normal message")
    cleaned = adapter._clean_bot_mention_text(data["body"], data)
    assert cleaned == "just a normal message"
