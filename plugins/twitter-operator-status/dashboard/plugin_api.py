"""Read-only dashboard API for Rotem's Twitter operator runtime."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

from fastapi import APIRouter

router = APIRouter()

DEFAULT_OPERATOR_HOME = Path("/home/rotemg/.hermes-twitter-operator")
EXPECTED_CRON = {
    "twitter-0900": "0 9 * * *",
    "twitter-1300": "0 13 * * *",
    "twitter-1700": "0 17 * * *",
    "twitter-2100": "0 21 * * *",
}


def _operator_home() -> Path:
    return Path(os.getenv("HERMES_TWITTER_OPERATOR_HOME", str(DEFAULT_OPERATOR_HOME))).expanduser()


def _read_json(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _pid_running(pid: Any) -> bool:
    try:
        value = int(pid)
    except (TypeError, ValueError):
        return False
    return value > 0 and Path(f"/proc/{value}").exists()


def _job_summary(job: dict[str, Any]) -> dict[str, Any]:
    schedule = job.get("schedule") if isinstance(job.get("schedule"), dict) else {}
    return {
        "id": job.get("id"),
        "name": job.get("name"),
        "enabled": bool(job.get("enabled", True)),
        "state": job.get("state") or ("active" if job.get("enabled", True) else "disabled"),
        "schedule": schedule.get("expr") or schedule.get("display") or job.get("schedule"),
        "deliver": job.get("deliver"),
        "last_run_at": job.get("last_run_at") or job.get("last_run"),
        "last_status": job.get("last_status") or job.get("last_result"),
        "next_run_at": job.get("next_run_at") or job.get("next_run"),
        "skills_count": len(job.get("skills") or []),
        "script": job.get("script"),
    }


def _cron_status(home: Path) -> dict[str, Any]:
    data = _read_json(home / "cron" / "jobs.json")
    jobs = data.get("jobs") if isinstance(data.get("jobs"), list) else []
    summaries = [_job_summary(job) for job in jobs if isinstance(job, dict)]
    found = {job.get("name"): job.get("schedule") for job in summaries}
    missing = [name for name in EXPECTED_CRON if name not in found]
    mismatched = [
        {"name": name, "expected": expr, "actual": found.get(name)}
        for name, expr in EXPECTED_CRON.items()
        if name in found and found.get(name) != expr
    ]
    return {
        "jobs": summaries,
        "count": len(summaries),
        "active_count": sum(1 for job in summaries if job.get("enabled") and job.get("state") != "paused"),
        "expected_count": len(EXPECTED_CRON),
        "missing_expected": missing,
        "mismatched_expected": mismatched,
        "ok": len(summaries) >= len(EXPECTED_CRON) and not missing and not mismatched,
    }


def _gateway_status(home: Path) -> dict[str, Any]:
    state = _read_json(home / "gateway_state.json")
    platforms = state.get("platforms") if isinstance(state.get("platforms"), dict) else {}
    telegram = platforms.get("telegram") if isinstance(platforms.get("telegram"), dict) else {}
    return {
        "gateway_state": state.get("gateway_state"),
        "pid": state.get("pid"),
        "pid_running": _pid_running(state.get("pid")),
        "updated_at": state.get("updated_at"),
        "active_agents": state.get("active_agents"),
        "telegram_state": telegram.get("state"),
        "telegram_updated_at": telegram.get("updated_at"),
        "telegram_error_code": telegram.get("error_code"),
        "telegram_error_message": telegram.get("error_message"),
    }


def _watchdog_status() -> dict[str, Any]:
    if not shutil.which("powershell.exe"):
        return {"available": False, "state": "unavailable", "detail": "powershell.exe not found"}
    command = (
        "Get-ScheduledTask -TaskName 'Hermes Twitter Gate A Watchdog' "
        "| Select-Object TaskName,@{Name='State';Expression={$_.State.ToString()}} "
        "| ConvertTo-Json -Compress"
    )
    try:
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-Command", command],
            capture_output=True,
            text=True,
            timeout=3,
        )
    except Exception as exc:
        return {"available": False, "state": "unknown", "detail": str(exc)}
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        return {"available": False, "state": "unknown", "detail": detail[:300]}
    try:
        data = json.loads(result.stdout or "{}")
    except json.JSONDecodeError:
        data = {}
    return {
        "available": True,
        "task_name": data.get("TaskName"),
        "state": data.get("State") or "unknown",
    }


@router.get("/status")
async def status():
    home = _operator_home()
    return {
        "operator_home": str(home),
        "home_exists": home.exists(),
        "gateway": _gateway_status(home),
        "cron": _cron_status(home),
        "watchdog": _watchdog_status(),
    }
