import importlib
import sys
import types
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from gateway.config import Platform, PlatformConfig
from gateway.platforms.base import BasePlatformAdapter, SendResult
from gateway.session import SessionSource


class CaptureAdapter(BasePlatformAdapter):
    def __init__(self):
        super().__init__(PlatformConfig(enabled=True, token="***"), Platform.TELEGRAM)
        self.sent = []

    async def connect(self) -> bool:
        return True

    async def disconnect(self) -> None:
        return None

    async def send(self, chat_id, content, reply_to=None, metadata=None) -> SendResult:
        self.sent.append({"chat_id": chat_id, "content": content, "metadata": metadata})
        return SendResult(success=True, message_id=str(len(self.sent)))

    async def send_typing(self, chat_id, metadata=None) -> None:
        return None

    async def stop_typing(self, chat_id) -> None:
        return None

    async def get_chat_info(self, chat_id: str):
        return {"id": chat_id}


class SuccessfulAgent:
    def __init__(self, **kwargs):
        self.model = kwargs.get("model")
        self.provider = kwargs.get("provider")
        self.base_url = kwargs.get("base_url")
        self.api_key = kwargs.get("api_key")
        self.api_mode = kwargs.get("api_mode")
        self.session_id = kwargs.get("session_id")
        self.tools = []

    def _emit_auxiliary_failure(self, task, exc):
        raise AssertionError("gateway title generation must not surface user warnings")

    def run_conversation(self, message, conversation_history=None, task_id=None):
        return {
            "final_response": "done",
            "messages": [
                {"role": "user", "content": message},
                {"role": "assistant", "content": "done"},
            ],
            "api_calls": 1,
        }


def _make_runner(adapter):
    gateway_run = importlib.import_module("gateway.run")
    runner = object.__new__(gateway_run.GatewayRunner)
    runner.adapters = {adapter.platform: adapter}
    runner._voice_mode = {}
    runner._prefill_messages = []
    runner._ephemeral_system_prompt = ""
    runner._reasoning_config = None
    runner._provider_routing = {}
    runner._fallback_model = None
    runner._session_db = MagicMock()
    runner._running_agents = {}
    runner._session_run_generation = {}
    runner.hooks = SimpleNamespace(loaded_hooks=False)
    runner.config = SimpleNamespace(
        thread_sessions_per_user=False,
        group_sessions_per_user=False,
        stt_enabled=False,
    )
    return runner, gateway_run


def _install_fakes(monkeypatch, gateway_run):
    fake_dotenv = types.ModuleType("dotenv")
    fake_dotenv.load_dotenv = lambda *a, **k: None
    monkeypatch.setitem(sys.modules, "dotenv", fake_dotenv)

    fake_run_agent = types.ModuleType("run_agent")
    fake_run_agent.AIAgent = SuccessfulAgent
    monkeypatch.setitem(sys.modules, "run_agent", fake_run_agent)

    monkeypatch.setattr(gateway_run, "_resolve_runtime_agent_kwargs", lambda: {"api_key": "fake"})
    monkeypatch.setattr(gateway_run, "_load_gateway_config", lambda: {})


@pytest.mark.asyncio
async def test_gateway_auto_title_failures_are_log_only(monkeypatch, tmp_path):
    adapter = CaptureAdapter()
    runner, gateway_run = _make_runner(adapter)
    _install_fakes(monkeypatch, gateway_run)
    monkeypatch.setattr(gateway_run, "_hermes_home", tmp_path)

    source = SessionSource(platform=Platform.TELEGRAM, chat_id="12345")

    with patch("agent.title_generator.maybe_auto_title") as mock_auto_title:
        result = await runner._run_agent(
            message="hello",
            context_prompt="",
            history=[],
            source=source,
            session_id="sess-1",
            session_key="agent:main:telegram:dm:12345",
        )

    assert result["final_response"] == "done"
    mock_auto_title.assert_called_once()
    assert mock_auto_title.call_args.kwargs["failure_callback"] is None
    assert not any(
        "Auxiliary title generation failed" in item["content"]
        for item in adapter.sent
    )
