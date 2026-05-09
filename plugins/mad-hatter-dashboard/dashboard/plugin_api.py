"""Read-only API for Rotem's Mad Hatter dashboard tab."""

from __future__ import annotations

import json
import socket
import urllib.request
from pathlib import Path
from typing import Any

from fastapi import APIRouter

router = APIRouter()

MAIN_HOME = Path("/home/rotemg/.hermes/profiles/madhatter")
OPERATOR_HOME = Path("/home/rotemg/.hermes-twitter-operator")
FACEBOOK_HOME = Path("/home/rotemg/.hermes-facebook-operator")

EXPECTED_CRON = {
    "twitter-0900": "0 9 * * *",
    "twitter-1300": "0 13 * * *",
    "twitter-1700": "0 17 * * *",
    "twitter-2100": "0 21 * * *",
}

OFFICE_URL = "http://127.0.0.1:3001/office"
OFFICE_ADAPTER_PORT = 18789


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


def _tcp_open(host: str, port: int, timeout: float = 0.35) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


def _http_ok(url: str, timeout: float = 0.6) -> bool:
    try:
        request = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return 200 <= int(response.status) < 500
    except Exception:
        return False


def _office_status() -> dict[str, Any]:
    office_running = _http_ok(OFFICE_URL)
    adapter_running = _tcp_open("127.0.0.1", OFFICE_ADAPTER_PORT)
    return {
        "label": "Hermes Office / Kanban",
        "label_he": "קאנבן / Office",
        "office_url": OFFICE_URL,
        "adapter_url": "ws://localhost:18789",
        "office_running": office_running,
        "adapter_running": adapter_running,
        "ready": office_running and adapter_running,
        "note_he": "ב-v0.13 הקאנבן הרשמי נמצא ב-Web Dashboard על /kanban. Office/Claw3D נשאר ממשק ויזואלי משני ולא מקור האמת.",
        "commands": [
            {
                "label_he": "הפעל Hermes Office adapter",
                "value": "cd /home/rotemg/.hermes/hermes-office && HERMES_API_URL=http://127.0.0.1:8642 HERMES_ADAPTER_PORT=18789 npm run hermes-adapter",
            },
            {
                "label_he": "הפעל Office על פורט 3001",
                "value": "cd /home/rotemg/.hermes/hermes-office && PORT=3001 NEXT_PUBLIC_GATEWAY_URL=ws://localhost:18789 npm run dev",
            },
            {
                "label_he": "פתח Office/Kanban",
                "value": OFFICE_URL,
            },
        ],
    }


@router.get("/status")
async def status():
    main = _platform_status(MAIN_HOME, "whatsapp")
    operator = _platform_status(OPERATOR_HOME, "telegram")
    facebook = _platform_status(FACEBOOK_HOME, "telegram")
    cron = _cron_status()
    return {
        "title_he": "לוח הסוכנים של Hermes",
        "subtitle_he": "מסך מיקוד קצר: מי מחובר, מי מפעיל איזה ערוץ, ומה שייך ל-Jarvis ולא ל-Hermes.",
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
        "facebook": {
            "id": "facebook-operator",
            "label": "Facebook Operator / Telegram",
            "label_he": "אופרטור פייסבוק / טלגרם",
            "identity": _first_line(FACEBOOK_HOME / "SOUL.md", "Hermes Facebook Operator"),
            "home": str(FACEBOOK_HOME),
            "service": "hermes-facebook-operator-gateway.service",
            "platform": "Telegram + Meta",
            "brand": "facebook",
            "channels": _channels(FACEBOOK_HOME, "telegram"),
            "status": facebook,
            "commands": [
                {
                    "label_he": "בדוק סטטוס של אופרטור פייסבוק",
                    "value": "systemctl --user status hermes-facebook-operator-gateway.service --no-pager",
                },
                {
                    "label_he": "לוגים של אופרטור פייסבוק",
                    "value": "journalctl --user -u hermes-facebook-operator-gateway.service -n 80 --no-pager",
                },
                {
                    "label_he": "רשימת pairing של Telegram",
                    "value": "HERMES_HOME=/home/rotemg/.hermes-facebook-operator hermes pairing list",
                },
                {
                    "label_he": "בדיקת Meta auth מקומית",
                    "value": "HERMES_HOME=/home/rotemg/.hermes-facebook-operator python /home/rotemg/.hermes-facebook-operator/scripts/meta_auth_health.py",
                },
            ],
        },
        "jarvis": {
            "label": "Jarvis MAIN",
            "label_he": "Jarvis חיצוני - לא Hermes",
            "state": "external",
            "portal_url": "http://127.0.0.1:19101/chat?session=agent%3Amain%3Amain",
            "note_he": "פותחים רק דרך כפתור 02 JARVIS CONTROL בתיקיית HERMES ONBOARD. לא לערבב עם כפתור 01 HERMES CONTROL.",
            "commands": [
                {
                    "label_he": "כפתור Jarvis Web UI בלפטופ",
                    "value": r"C:\Users\user\Desktop\HERMES ONBOARD\02 JARVIS CONTROL.lnk",
                },
                {
                    "label_he": "קישור Jarvis אחרי tunnel",
                    "value": "http://127.0.0.1:19101/chat?session=agent%3Amain%3Amain",
                },
            ],
        },
        "office": _office_status(),
    }
