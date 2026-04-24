"""Read-only API for Rotem's Mad Hatter dashboard tab."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter

router = APIRouter()

MAIN_HOME = Path("/home/rotemg/.hermes/profiles/madhatter")
OPERATOR_HOME = Path("/home/rotemg/.hermes-twitter-operator")

EXPECTED_CRON = {
    "twitter-0900": "0 9 * * *",
    "twitter-1300": "0 13 * * *",
    "twitter-1700": "0 17 * * *",
    "twitter-2100": "0 21 * * *",
}


def _read_json(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _pid_running(pid: Any) -> bool:
    try:
        value = int(pid)
    except (TypeError, ValueError):
        return False
    return value > 0 and Path(f"/proc/{value}").exists()


def _first_line(path: Path, fallback: str) -> str:
    try:
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if line:
                return line.removeprefix("You are ").rstrip(".")
    except Exception:
        pass
    return fallback


def _channels(home: Path, platform: str) -> list[str]:
    data = _read_json(home / "channel_directory.json")
    items = data.get("platforms", {}).get(platform, [])
    if not isinstance(items, list):
        return []
    result = []
    for item in items:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        channel_id = str(item.get("id") or "").strip()
        if name and channel_id:
            result.append(f"{name} ({channel_id})")
        elif name or channel_id:
            result.append(name or channel_id)
    return result


def _platform_status(home: Path, platform: str) -> dict[str, Any]:
    state = _read_json(home / "gateway_state.json")
    platforms = state.get("platforms") if isinstance(state.get("platforms"), dict) else {}
    platform_state = platforms.get(platform) if isinstance(platforms.get(platform), dict) else {}
    pid = state.get("pid")
    return {
        "gateway_state": state.get("gateway_state") or "unknown",
        "pid": pid,
        "pid_running": _pid_running(pid),
        "platform_state": platform_state.get("state") or "unknown",
        "updated_at": platform_state.get("updated_at") or state.get("updated_at"),
        "error_code": platform_state.get("error_code"),
        "error_message": platform_state.get("error_message"),
    }


def _cron_status() -> dict[str, Any]:
    data = _read_json(OPERATOR_HOME / "cron" / "jobs.json")
    jobs = data.get("jobs") if isinstance(data.get("jobs"), list) else []
    summaries = []
    for job in jobs:
        if not isinstance(job, dict):
            continue
        schedule = job.get("schedule") if isinstance(job.get("schedule"), dict) else {}
        summaries.append({
            "name": job.get("name"),
            "enabled": bool(job.get("enabled", True)),
            "state": job.get("state") or ("scheduled" if job.get("enabled", True) else "disabled"),
            "schedule": schedule.get("expr") or job.get("schedule_display") or job.get("schedule"),
            "last_run_at": job.get("last_run_at"),
            "next_run_at": job.get("next_run_at"),
            "last_status": job.get("last_status"),
        })
    found = {job.get("name"): job.get("schedule") for job in summaries}
    missing = [name for name in EXPECTED_CRON if name not in found]
    mismatched = [
        {"name": name, "expected": expr, "actual": found.get(name)}
        for name, expr in EXPECTED_CRON.items()
        if name in found and found.get(name) != expr
    ]
    active_count = sum(1 for job in summaries if job.get("enabled") and job.get("state") != "paused")
    return {
        "jobs": summaries,
        "active_count": active_count,
        "expected_count": len(EXPECTED_CRON),
        "ok": active_count >= len(EXPECTED_CRON) and not missing and not mismatched,
        "missing": missing,
        "mismatched": mismatched,
    }


@router.get("/status")
async def status():
    main = _platform_status(MAIN_HOME, "whatsapp")
    operator = _platform_status(OPERATOR_HOME, "telegram")
    cron = _cron_status()
    return {
        "title_he": "לוח הבקרה של Hermes Mad Hatter",
        "subtitle_he": "מסך מיקוד קצר: מה מחובר, מה להריץ, ומה שייך ל-Jarvis ולא ל-Hermes.",
        "main": {
            "id": "hermes-main",
            "label": "Hermes Main / WhatsApp",
            "label_he": "הרמס מאד־האטר / וואטסאפ",
            "identity": _first_line(MAIN_HOME / "SOUL.md", "Hermes The Mad Hatter"),
            "home": str(MAIN_HOME),
            "service": "hermes-gateway-madhatter.service",
            "platform": "WhatsApp",
            "brand": "whatsapp",
            "channels": _channels(MAIN_HOME, "whatsapp"),
            "status": main,
            "commands": [
                {
                    "label_he": "בדוק סטטוס של Hermes main",
                    "value": "systemctl --user status hermes-gateway-madhatter.service --no-pager",
                },
                {
                    "label_he": "הפעל מחדש את Hermes main",
                    "value": "systemctl --user restart hermes-gateway-madhatter.service",
                },
                {
                    "label_he": "זיווג WhatsApp רק אם נשבר",
                    "value": "HERMES_HOME=/home/rotemg/.hermes/profiles/madhatter hermes whatsapp",
                },
            ],
        },
        "operator": {
            "id": "twitter-operator",
            "label": "Twitter Operator / Telegram",
            "label_he": "אופרטור טוויטר / טלגרם",
            "identity": _first_line(OPERATOR_HOME / "SOUL.md", "Hermes Twitter Operator"),
            "home": str(OPERATOR_HOME),
            "service": "hermes-twitter-operator-gateway.service",
            "platform": "Telegram + X",
            "brand": "telegram-x",
            "channels": _channels(OPERATOR_HOME, "telegram"),
            "status": operator,
            "cron": cron,
            "commands": [
                {
                    "label_he": "בדוק סטטוס של האופרטור",
                    "value": "systemctl --user status hermes-twitter-operator-gateway.service --no-pager",
                },
                {
                    "label_he": "לוגים של האופרטור",
                    "value": "journalctl --user -u hermes-twitter-operator-gateway.service -n 80 --no-pager",
                },
                {
                    "label_he": "רשימת pairing של Telegram",
                    "value": "HERMES_HOME=/home/rotemg/.hermes-twitter-operator hermes pairing list",
                },
            ],
        },
        "jarvis": {
            "label": "Jarvis MAIN",
            "label_he": "Jarvis חיצוני - לא Hermes",
            "state": "external",
            "portal_url": "http://127.0.0.1:19101/chat?session=agent%3Amain%3Amain",
            "note_he": "פותחים רק דרך כפתור 06 בתיקיית HERMES ONBOARD. לא לערבב עם כפתורי Hermes.",
            "commands": [
                {
                    "label_he": "כפתור Jarvis Web UI בלפטופ",
                    "value": r"C:\Users\user\Desktop\HERMES ONBOARD\06 Jarvis MAIN Web UI (Laptop).cmd",
                },
                {
                    "label_he": "קישור Jarvis אחרי tunnel",
                    "value": "http://127.0.0.1:19101/chat?session=agent%3Amain%3Amain",
                },
            ],
        },
    }
