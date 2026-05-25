"""Bumblebee inventory plugin.

Wraps the Perplexity Bumblebee read-only scanner as an opt-in Hermes tool.
The wrapper never sends records over HTTP; it stores NDJSON output under the
active HERMES_HOME profile and returns a compact JSON summary to the agent.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from hermes_constants import get_hermes_home


PLUGIN_NAME = "bumblebee_inventory"
DEFAULT_MAX_DURATION_SECONDS = 120
DEFAULT_SUBPROCESS_TIMEOUT_SECONDS = 240

_SUPPORTED_PROFILES = {"baseline", "project", "deep"}
_SUPPORTED_ECOSYSTEMS = {
    "npm",
    "pypi",
    "go",
    "rubygems",
    "packagist",
    "mcp",
    "editor-extension",
    "browser-extension",
}


BUMBLEBEE_INVENTORY_SCHEMA = {
    "name": PLUGIN_NAME,
    "description": (
        "Run Perplexity Bumblebee read-only package, extension, and MCP "
        "inventory scans. Actions: version, selftest, roots, scan, latest. "
        "Scan output is stored locally under the active Hermes profile."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["version", "selftest", "roots", "scan", "latest"],
                "description": "Operation to run.",
            },
            "profile": {
                "type": "string",
                "enum": ["baseline", "project", "deep"],
                "description": "Bumblebee scan profile. Defaults to baseline.",
                "default": "baseline",
            },
            "roots": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Filesystem roots for roots/scan. Required by Bumblebee for deep scans.",
            },
            "ecosystems": {
                "type": "array",
                "items": {
                    "type": "string",
                    "enum": sorted(_SUPPORTED_ECOSYSTEMS),
                },
                "description": "Optional emitted ecosystem filters.",
            },
            "catalogs": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Optional local exposure catalog files, or one catalog directory.",
            },
            "findings_only": {
                "type": "boolean",
                "description": "Suppress package records. Requires an exposure catalog.",
                "default": False,
            },
            "max_duration_seconds": {
                "type": "integer",
                "minimum": 1,
                "maximum": 3600,
                "description": "Bumblebee max scan duration in seconds.",
                "default": DEFAULT_MAX_DURATION_SECONDS,
            },
            "limit": {
                "type": "integer",
                "minimum": 1,
                "maximum": 20,
                "description": "Number of recent runs to return for latest.",
                "default": 1,
            },
        },
        "required": ["action"],
    },
}


def _json_result(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True)


def _error(message: str, **extra: Any) -> str:
    payload = {"ok": False, "error": message}
    payload.update(extra)
    return _json_result(payload)


def _hermes_home() -> Path:
    return Path(get_hermes_home())


def _state_dir() -> Path:
    return _hermes_home() / "bumblebee"


def _runs_dir() -> Path:
    return _state_dir() / "runs"


def _candidate_binary_paths() -> list[Path]:
    explicit = os.getenv("BUMBLEBEE_BIN", "").strip()
    paths: list[Path] = []
    if explicit:
        paths.append(Path(explicit).expanduser())

    home = _hermes_home()
    paths.extend(
        [
            home / "bin" / "bumblebee",
            Path("/home/rotemg/.hermes/profiles/madhatter/bin/bumblebee"),
            Path("/home/rotemg/.hermes/bin/bumblebee"),
        ]
    )
    found = shutil.which("bumblebee")
    if found:
        paths.append(Path(found))
    return paths


def _binary_path() -> Path | None:
    for path in _candidate_binary_paths():
        try:
            if path.is_file() and os.access(path, os.X_OK):
                return path
        except OSError:
            continue
    return None


def check_bumblebee_requirements() -> bool:
    return _binary_path() is not None


def _normalize_profile(value: Any) -> str:
    profile = str(value or "baseline").strip().lower()
    if profile not in _SUPPORTED_PROFILES:
        raise ValueError(
            "profile must be one of: " + ", ".join(sorted(_SUPPORTED_PROFILES))
        )
    return profile


def _string_list(value: Any, field: str) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        raise ValueError(f"{field} must be a string or array of strings")
    out = []
    for item in value:
        text = str(item).strip()
        if text:
            out.append(text)
    return out


def _ecosystems(value: Any) -> list[str]:
    ecosystems = _string_list(value, "ecosystems")
    invalid = sorted(set(ecosystems) - _SUPPORTED_ECOSYSTEMS)
    if invalid:
        raise ValueError(
            "invalid ecosystems: "
            + ", ".join(invalid)
            + " (allowed: "
            + ", ".join(sorted(_SUPPORTED_ECOSYSTEMS))
            + ")"
        )
    return ecosystems


def _max_duration(value: Any) -> int:
    if value in (None, ""):
        return DEFAULT_MAX_DURATION_SECONDS
    try:
        seconds = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("max_duration_seconds must be an integer") from exc
    if seconds < 1 or seconds > 3600:
        raise ValueError("max_duration_seconds must be between 1 and 3600")
    return seconds


def _run_name() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")


def _run_command(argv: list[str], *, timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        argv,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
    )


def _parse_roots(stdout: str) -> list[dict[str, str]]:
    roots = []
    for line in stdout.splitlines():
        if not line.strip():
            continue
        kind, sep, path = line.partition("\t")
        roots.append({"kind": kind, "path": path if sep else ""})
    return roots


def _read_ndjson(path: Path, *, max_records: int | None = None) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    if not path.is_file():
        return records
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue
            if max_records is not None and len(records) >= max_records:
                break
    return records


def _scan_summary(records_path: Path) -> dict[str, Any] | None:
    summary = None
    for record in _read_ndjson(records_path):
        if record.get("record_type") == "scan_summary":
            summary = record
    return summary


def _finding_records(records_path: Path, *, limit: int = 20) -> list[dict[str, Any]]:
    findings = []
    for record in _read_ndjson(records_path):
        if record.get("record_type") != "finding":
            continue
        findings.append(
            {
                "catalog_id": record.get("catalog_id", ""),
                "severity": record.get("severity", ""),
                "ecosystem": record.get("ecosystem", ""),
                "package_name": record.get("package_name", ""),
                "version": record.get("version", ""),
                "source_file": record.get("source_file", ""),
                "confidence": record.get("confidence", ""),
            }
        )
        if len(findings) >= limit:
            break
    return findings


def _merge_catalog_files(catalogs: list[Path], destination: Path) -> Path:
    schema_version = None
    entries: list[Any] = []
    for catalog in catalogs:
        data = json.loads(catalog.read_text(encoding="utf-8"))
        current_schema = data.get("schema_version")
        if not current_schema:
            raise ValueError(f"catalog missing schema_version: {catalog}")
        if schema_version is None:
            schema_version = current_schema
        elif current_schema != schema_version:
            raise ValueError("all exposure catalogs must share schema_version")
        current_entries = data.get("entries")
        if not isinstance(current_entries, list):
            raise ValueError(f"catalog entries must be a list: {catalog}")
        entries.extend(current_entries)
    payload = {"schema_version": schema_version, "entries": entries}
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return destination


def _resolve_catalog(catalogs: list[str], run_dir: Path | None) -> Path | None:
    if not catalogs:
        return None
    paths = [Path(c).expanduser() for c in catalogs]
    missing = [str(p) for p in paths if not p.exists()]
    if missing:
        raise ValueError("exposure catalog path does not exist: " + ", ".join(missing))
    dirs = [p for p in paths if p.is_dir()]
    files = [p for p in paths if p.is_file()]
    if dirs and (files or len(dirs) > 1):
        raise ValueError("catalogs must be one directory or one-or-more files")
    if dirs:
        return dirs[0]
    if len(files) == 1:
        return files[0]
    if run_dir is None:
        raise ValueError("multiple catalog files are supported only for scan")
    return _merge_catalog_files(files, run_dir / "exposure_catalog_merged.json")


def _base_args(binary: Path, profile: str, roots: list[str], ecosystems: list[str]) -> list[str]:
    argv = [str(binary), "--profile", profile]
    for root in roots:
        argv.extend(["--root", root])
    for ecosystem in ecosystems:
        argv.extend(["--ecosystem", ecosystem])
    return argv


def _action_version(binary: Path) -> str:
    result = _run_command([str(binary), "version"], timeout=30)
    return _json_result(
        {
            "ok": result.returncode == 0,
            "action": "version",
            "binary": str(binary),
            "exit_code": result.returncode,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }
    )


def _action_selftest(binary: Path) -> str:
    result = _run_command([str(binary), "selftest"], timeout=60)
    return _json_result(
        {
            "ok": result.returncode == 0,
            "action": "selftest",
            "binary": str(binary),
            "exit_code": result.returncode,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }
    )


def _action_roots(binary: Path, args: dict[str, Any]) -> str:
    profile = _normalize_profile(args.get("profile"))
    roots = _string_list(args.get("roots"), "roots")
    argv = [str(binary), "roots", "--profile", profile]
    for root in roots:
        argv.extend(["--root", root])
    result = _run_command(argv, timeout=60)
    return _json_result(
        {
            "ok": result.returncode == 0,
            "action": "roots",
            "profile": profile,
            "binary": str(binary),
            "command": argv,
            "exit_code": result.returncode,
            "roots": _parse_roots(result.stdout),
            "stderr": result.stderr.strip(),
        }
    )


def _action_scan(binary: Path, args: dict[str, Any]) -> str:
    profile = _normalize_profile(args.get("profile"))
    roots = _string_list(args.get("roots"), "roots")
    ecosystems = _ecosystems(args.get("ecosystems"))
    catalogs = _string_list(args.get("catalogs"), "catalogs")
    findings_only = bool(args.get("findings_only", False))
    max_duration = _max_duration(args.get("max_duration_seconds"))

    if profile == "deep" and not roots:
        return _error("profile=deep requires at least one root")
    if findings_only and not catalogs:
        return _error("findings_only requires at least one exposure catalog")

    run_dir = _runs_dir() / _run_name()
    run_dir.mkdir(parents=True, exist_ok=False)
    records_path = run_dir / "records.ndjson"
    diagnostics_path = run_dir / "diagnostics.ndjson"
    metadata_path = run_dir / "metadata.json"
    catalog_path = _resolve_catalog(catalogs, run_dir)

    argv = [str(binary), "scan"] + _base_args(binary, profile, roots, ecosystems)[1:]
    argv.extend(
        [
            "--max-duration",
            f"{max_duration}s",
            "--output",
            "file",
            "--output-file",
            str(records_path),
        ]
    )
    if catalog_path is not None:
        argv.extend(["--exposure-catalog", str(catalog_path)])
    if findings_only:
        argv.append("--findings-only")

    timeout = max(DEFAULT_SUBPROCESS_TIMEOUT_SECONDS, max_duration + 60)
    result = _run_command(argv, timeout=timeout)
    diagnostics_path.write_text(result.stderr, encoding="utf-8")
    summary = _scan_summary(records_path)
    findings = _finding_records(records_path)
    findings_count = len(findings)
    if summary and isinstance(summary.get("findings_emitted"), int):
        findings_count = summary["findings_emitted"]
    metadata = {
        "ok": result.returncode == 0 and (summary or {}).get("status") == "complete",
        "action": "scan",
        "binary": str(binary),
        "command": argv,
        "exit_code": result.returncode,
        "profile": profile,
        "roots": roots,
        "ecosystems": ecosystems,
        "catalog": str(catalog_path) if catalog_path is not None else "",
        "records_path": str(records_path),
        "diagnostics_path": str(diagnostics_path),
        "metadata_path": str(metadata_path),
        "run_dir": str(run_dir),
        "summary": summary,
        "findings_count": findings_count,
        "findings_preview": findings,
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return _json_result(metadata)


def _action_latest(args: dict[str, Any]) -> str:
    try:
        limit = int(args.get("limit") or 1)
    except (TypeError, ValueError):
        return _error("limit must be an integer")
    limit = max(1, min(20, limit))
    run_dirs = sorted((p for p in _runs_dir().glob("*") if p.is_dir()), reverse=True)
    runs = []
    for run_dir in run_dirs[:limit]:
        metadata_path = run_dir / "metadata.json"
        if metadata_path.is_file():
            try:
                runs.append(json.loads(metadata_path.read_text(encoding="utf-8")))
            except json.JSONDecodeError:
                runs.append({"ok": False, "run_dir": str(run_dir), "error": "invalid metadata.json"})
        else:
            runs.append({"ok": False, "run_dir": str(run_dir), "error": "missing metadata.json"})
    return _json_result({"ok": True, "action": "latest", "runs": runs})


def handle_bumblebee_inventory(args: dict[str, Any], **_: Any) -> str:
    try:
        action = str(args.get("action", "")).strip().lower()
        if action not in {"version", "selftest", "roots", "scan", "latest"}:
            return _error("action must be one of: version, selftest, roots, scan, latest")

        if action == "latest":
            return _action_latest(args)

        binary = _binary_path()
        if binary is None:
            return _error(
                "bumblebee binary not found",
                searched=[str(path) for path in _candidate_binary_paths()],
            )

        if action == "version":
            return _action_version(binary)
        if action == "selftest":
            return _action_selftest(binary)
        if action == "roots":
            return _action_roots(binary, args)
        if action == "scan":
            return _action_scan(binary, args)
    except subprocess.TimeoutExpired as exc:
        return _error("bumblebee command timed out", timeout_seconds=exc.timeout)
    except ValueError as exc:
        return _error(str(exc))
    except Exception as exc:
        return _error(f"unexpected bumblebee wrapper error: {type(exc).__name__}: {exc}")
    return _error("unreachable action state")


def register(ctx) -> None:
    ctx.register_tool(
        name=PLUGIN_NAME,
        toolset=PLUGIN_NAME,
        schema=BUMBLEBEE_INVENTORY_SCHEMA,
        handler=handle_bumblebee_inventory,
        check_fn=check_bumblebee_requirements,
        description=BUMBLEBEE_INVENTORY_SCHEMA["description"],
    )
