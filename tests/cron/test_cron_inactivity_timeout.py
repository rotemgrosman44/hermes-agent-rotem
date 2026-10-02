"""Tests for cron job inactivity-based timeout.

Tests cover:
- Active agent runs indefinitely (no inactivity timeout)
- Idle agent triggers inactivity timeout with diagnostic info
- Unlimited timeout (HERMES_CRON_TIMEOUT=0)
- Backward compat: HERMES_CRON_TIMEOUT env var still works
- Error message includes activity summary
"""

import concurrent.futures
import os
import sys
import threading
import time
from pathlib import Path

import pytest


# Ensure project root is importable
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


class FakeAgent:
    """Mock agent with controllable activity summary for timeout tests."""

    def __init__(self, idle_seconds=0.0, activity_desc="tool_call",
                 current_tool=None, api_call_count=5, max_iterations=90):
        self._idle_seconds = idle_seconds
        self._activity_desc = activity_desc
        self._current_tool = current_tool
        self._api_call_count = api_call_count
        self._max_iterations = max_iterations
        self._interrupted = False
        self._interrupt_msg = None

    def get_activity_summary(self):
        return {
            "last_activity_ts": time.time() - self._idle_seconds,
            "last_activity_desc": self._activity_desc,
            "seconds_since_activity": self._idle_seconds,
            "current_tool": self._current_tool,
            "api_call_count": self._api_call_count,
            "max_iterations": self._max_iterations,
        }

    def interrupt(self, msg):
        self._interrupted = True
        self._interrupt_msg = msg

    def run_conversation(self, prompt, **_kwargs):
        """Simulate a quick agent run that finishes immediately."""
        return {"final_response": "Done", "messages": []}


class SlowFakeAgent(FakeAgent):
    """Agent that runs for a while, simulating active work then going idle."""

    def __init__(self, run_duration=0.5, idle_after=None, **kwargs):
        super().__init__(**kwargs)
        self._run_duration = run_duration
        self._idle_after = idle_after  # seconds before becoming idle
        self._start_time = None

    def get_activity_summary(self):
        summary = super().get_activity_summary()
        if self._idle_after is not None and self._start_time:
            elapsed = time.time() - self._start_time
            if elapsed > self._idle_after:
                # Agent has gone idle
                idle_time = elapsed - self._idle_after
                summary["seconds_since_activity"] = idle_time
                summary["last_activity_desc"] = "api_call_streaming"
            else:
                summary["seconds_since_activity"] = 0.0
        return summary

    def run_conversation(self, prompt, **_kwargs):
        self._start_time = time.time()
        time.sleep(self._run_duration)
        return {"final_response": "Completed after work", "messages": []}


class TestInactivityTimeout:
    """Test the inactivity-based timeout polling loop in cron scheduler."""

    def test_active_agent_completes_normally(self):
        """An agent that finishes quickly should return its result."""
        agent = FakeAgent(idle_seconds=0.0)
        _cron_inactivity_limit = 10.0
        _POLL_INTERVAL = 0.1

        pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        future = pool.submit(agent.run_conversation, "test prompt")
        _inactivity_timeout = False

        result = None
        while True:
            done, _ = concurrent.futures.wait({future}, timeout=_POLL_INTERVAL)
            if done:
                result = future.result()
                break
            _idle_secs = 0.0
            if hasattr(agent, "get_activity_summary"):
                _act = agent.get_activity_summary()
                _idle_secs = _act.get("seconds_since_activity", 0.0)
            if _idle_secs >= _cron_inactivity_limit:
                _inactivity_timeout = True
                break

        pool.shutdown(wait=False)
        assert result is not None
        assert result["final_response"] == "Done"
        assert not _inactivity_timeout
        assert not agent._interrupted

    def test_idle_agent_triggers_timeout(self):
        """An agent that goes idle should be detected and interrupted."""
        # Agent will run for 0.3s, then become idle after 0.1s of that
        agent = SlowFakeAgent(
            run_duration=5.0,  # would run forever without timeout
            idle_after=0.1,    # goes idle almost immediately
            activity_desc="api_call_streaming",
            current_tool="web_search",
            api_call_count=3,
            max_iterations=50,
        )

        _cron_inactivity_limit = 0.5  # 0.5s inactivity triggers timeout
        _POLL_INTERVAL = 0.1

        pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        future = pool.submit(agent.run_conversation, "test prompt")
        _inactivity_timeout = False

        result = None
        while True:
            done, _ = concurrent.futures.wait({future}, timeout=_POLL_INTERVAL)
            if done:
                result = future.result()
                break
            _idle_secs = 0.0
            if hasattr(agent, "get_activity_summary"):
                try:
                    _act = agent.get_activity_summary()
                    _idle_secs = _act.get("seconds_since_activity", 0.0)
                except Exception:
                    pass
            if _idle_secs >= _cron_inactivity_limit:
                _inactivity_timeout = True
                break

        pool.shutdown(wait=False, cancel_futures=True)
        assert _inactivity_timeout is True
        assert result is None  # Never got a result — interrupted

    def test_unlimited_timeout(self):
        """HERMES_CRON_TIMEOUT=0 means no timeout at all."""
        agent = FakeAgent(idle_seconds=0.0)
        _cron_inactivity_limit = None  # unlimited

        pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        future = pool.submit(agent.run_conversation, "test prompt")

        # With unlimited, we just await the result directly.
        result = future.result()
        pool.shutdown(wait=False)

        assert result["final_response"] == "Done"

    @pytest.mark.parametrize("job_value", [0, -1, "malformed", None])
    def test_nonpositive_or_invalid_job_cap_falls_back_to_profile(self, monkeypatch, job_value):
        """A job override only wins when it is a positive duration."""
        from cron import scheduler
        import hermes_cli.config as config

        monkeypatch.setattr(
            config, "load_config", lambda: {"cron": {"max_runtime_seconds": 120}}
        )

        assert scheduler._cron_max_runtime_seconds(
            {"max_runtime_seconds": job_value}
        ) == 120.0

    def test_positive_job_cap_overrides_profile(self, monkeypatch):
        from cron import scheduler
        import hermes_cli.config as config

        monkeypatch.setattr(
            config, "load_config", lambda: {"cron": {"max_runtime_seconds": 120}}
        )

        assert scheduler._cron_max_runtime_seconds({"max_runtime_seconds": 45}) == 45.0

    @pytest.mark.parametrize("profile_value", [0, -1, "malformed", None])
    def test_missing_or_nonpositive_profile_cap_is_unlimited(self, monkeypatch, profile_value):
        from cron import scheduler
        import hermes_cli.config as config

        monkeypatch.setattr(
            config, "load_config", lambda: {"cron": {"max_runtime_seconds": profile_value}}
        )

        assert scheduler._cron_max_runtime_seconds({}) is None

    def test_hard_runtime_cap_interrupts_an_active_agent(self, monkeypatch):
        """An active tool/model loop cannot evade a wall-clock interval budget."""
        from cron import scheduler

        agent = SlowFakeAgent(run_duration=2.0, idle_after=None, idle_seconds=0.0)
        monkeypatch.setattr(scheduler, "_cron_max_runtime_seconds", lambda _job: 0.05)
        monkeypatch.setattr(scheduler, "_CRON_WATCHDOG_POLL_SECONDS", 0.01)

        with pytest.raises(TimeoutError, match="exceeded hard runtime"):
            scheduler._run_agent_with_watchdog(
                agent, "test", {"id": "job"}, "job", "job", "task", None
            )

        assert agent._interrupted is True
        assert agent._interrupt_msg == "Cron job exceeded hard runtime limit"

    def _parse_cron_timeout(self, raw_value):
        """Mirror the defensive parsing logic from cron/scheduler.py run_job()."""
        if raw_value:
            try:
                return float(raw_value)
            except (ValueError, TypeError):
                return 600.0
        return 600.0

    def test_timeout_env_var_parsing(self, monkeypatch):
        """HERMES_CRON_TIMEOUT env var is respected."""
        monkeypatch.setenv("HERMES_CRON_TIMEOUT", "1200")
        raw = os.getenv("HERMES_CRON_TIMEOUT", "").strip()
        _cron_timeout = self._parse_cron_timeout(raw)
        assert _cron_timeout == 1200.0

        _cron_inactivity_limit = _cron_timeout if _cron_timeout > 0 else None
        assert _cron_inactivity_limit == 1200.0


    def test_agent_without_activity_summary_uses_wallclock_fallback(self):
        """If agent lacks get_activity_summary, idle_secs stays 0 (never times out).
        
        This ensures backward compat if somehow an old agent is used.
        The polling loop will eventually complete when the task finishes.
        """
        class BareAgent:
            def run_conversation(self, prompt):
                return {"final_response": "no activity tracker", "messages": []}

        agent = BareAgent()
        _cron_inactivity_limit = 0.1  # tiny limit
        _POLL_INTERVAL = 0.1

        pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        future = pool.submit(agent.run_conversation, "test")
        _inactivity_timeout = False

        while True:
            done, _ = concurrent.futures.wait({future}, timeout=_POLL_INTERVAL)
            if done:
                result = future.result()
                break
            _idle_secs = 0.0
            if hasattr(agent, "get_activity_summary"):
                try:
                    _act = agent.get_activity_summary()
                    _idle_secs = _act.get("seconds_since_activity", 0.0)
                except Exception:
                    pass
            if _idle_secs >= _cron_inactivity_limit:
                _inactivity_timeout = True
                break

        pool.shutdown(wait=False)
        # Should NOT have timed out — bare agent has no get_activity_summary
        assert not _inactivity_timeout
        assert result["final_response"] == "no activity tracker"


class TestSysPathOrdering:
    """Test that sys.path is set before repo-level imports."""

    def test_hermes_time_importable(self):
        """hermes_time should be importable when cron.scheduler loads."""
        # This import would fail if sys.path.insert comes after the import
        from cron.scheduler import _hermes_now
        assert callable(_hermes_now)


class TestInactivityWatchdogLoop:
    """The daemon-thread inactivity helper must not depend on the caller thread."""

    def test_fires_when_idle_crosses_limit(self):
        from cron.scheduler import _inactivity_watchdog_loop

        stop = threading.Event()
        idle = {"s": 0.0}
        results: list = []

        def _watch():
            results.append(
                _inactivity_watchdog_loop(
                    get_idle_seconds=lambda: idle["s"],
                    limit_s=0.2,
                    poll_s=0.05,
                    stop=stop,
                    future_done=lambda: False,
                )
            )

        watcher = threading.Thread(target=_watch, daemon=True)
        watcher.start()
        time.sleep(0.12)
        idle["s"] = 1.0
        watcher.join(timeout=2.0)
        stop.set()
        assert results == [True]
        assert not watcher.is_alive()

    def test_stops_when_future_completes_before_idle_limit(self):
        from cron.scheduler import _inactivity_watchdog_loop

        stop = threading.Event()
        fired = _inactivity_watchdog_loop(
            get_idle_seconds=lambda: 0.0,
            limit_s=10.0,
            poll_s=0.05,
            stop=stop,
            future_done=lambda: True,
        )
        assert fired is False

    def test_fires_while_caller_thread_is_blocked(self):
        """#94285: a blocked run_job thread must not disable the watchdog."""
        from cron.scheduler import _inactivity_watchdog_loop

        stop = threading.Event()
        idle = {"s": 1.0}
        result = {"fired": None}

        def _watch():
            result["fired"] = _inactivity_watchdog_loop(
                get_idle_seconds=lambda: idle["s"],
                limit_s=0.15,
                poll_s=0.05,
                stop=stop,
                future_done=lambda: False,
            )

        watcher = threading.Thread(target=_watch, daemon=True)
        watcher.start()
        # Simulate the family-A stall: this thread cannot poll.
        time.sleep(0.4)
        watcher.join(timeout=2.0)
        stop.set()
        assert result["fired"] is True
        assert not watcher.is_alive()
