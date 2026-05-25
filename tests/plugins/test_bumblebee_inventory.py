from __future__ import annotations

import json
import os
import stat
import textwrap
from pathlib import Path

import pytest


@pytest.fixture()
def isolated_bumblebee(tmp_path, monkeypatch):
    hermes_home = tmp_path / "hermes"
    hermes_home.mkdir()
    fake_bin = tmp_path / "bumblebee"
    fake_bin.write_text(
        textwrap.dedent(
            """\
            #!/usr/bin/env python3
            import json
            import pathlib
            import sys

            args = sys.argv[1:]
            if args == ["version"]:
                print("bumblebee v0.1.1")
                sys.exit(0)
            if args == ["selftest"]:
                print("selftest OK (2 findings in 1ms)")
                sys.exit(0)
            if args and args[0] == "roots":
                print("project_root\\t/tmp/project")
                print("mcp_config_root\\t/tmp/project/.codex")
                sys.exit(0)
            if args and args[0] == "scan":
                output_file = pathlib.Path(args[args.index("--output-file") + 1])
                output_file.parent.mkdir(parents=True, exist_ok=True)
                records = [
                    {
                        "record_type": "package",
                        "record_id": "package:1",
                        "run_id": "run-test",
                        "profile": "project",
                        "ecosystem": "npm",
                        "package_name": "left-pad",
                        "normalized_name": "left-pad",
                        "version": "1.3.0",
                    },
                    {
                        "record_type": "finding",
                        "record_id": "finding:1",
                        "run_id": "run-test",
                        "profile": "project",
                        "catalog_id": "catalog-test",
                        "severity": "high",
                        "ecosystem": "npm",
                        "package_name": "left-pad",
                        "normalized_name": "left-pad",
                        "version": "1.3.0",
                        "source_file": "/tmp/project/package-lock.json",
                        "confidence": "high",
                    },
                    {
                        "record_type": "scan_summary",
                        "record_id": "summary:1",
                        "run_id": "run-test",
                        "profile": "project",
                        "status": "complete",
                        "package_records_emitted": 1,
                        "findings_emitted": 1,
                    },
                ]
                output_file.write_text(
                    "".join(json.dumps(r) + "\\n" for r in records),
                    encoding="utf-8",
                )
                print('{"record_type":"diagnostic","level":"info","message":"fake"}', file=sys.stderr)
                sys.exit(0)
            print("unexpected args: " + repr(args), file=sys.stderr)
            sys.exit(2)
            """
        ),
        encoding="utf-8",
    )
    fake_bin.chmod(fake_bin.stat().st_mode | stat.S_IXUSR)
    monkeypatch.setenv("HERMES_HOME", str(hermes_home))
    monkeypatch.setenv("BUMBLEBEE_BIN", str(fake_bin))
    return hermes_home


def _call(args):
    from plugins.bumblebee_inventory import handle_bumblebee_inventory

    return json.loads(handle_bumblebee_inventory(args))


def test_version_and_selftest_use_configured_binary(isolated_bumblebee):
    version = _call({"action": "version"})
    selftest = _call({"action": "selftest"})

    assert version["ok"] is True
    assert "bumblebee v0.1.1" in version["stdout"]
    assert selftest["ok"] is True
    assert "selftest OK" in selftest["stdout"]


def test_roots_parses_tab_delimited_output(isolated_bumblebee):
    result = _call({"action": "roots", "profile": "project", "roots": ["/tmp/project"]})

    assert result["ok"] is True
    assert result["profile"] == "project"
    assert result["roots"] == [
        {"kind": "project_root", "path": "/tmp/project"},
        {"kind": "mcp_config_root", "path": "/tmp/project/.codex"},
    ]


def test_scan_writes_profile_local_records_and_latest(isolated_bumblebee):
    project_root = Path(os.environ["HERMES_HOME"]) / "project"
    project_root.mkdir()

    result = _call(
        {
            "action": "scan",
            "profile": "project",
            "roots": [str(project_root)],
            "ecosystems": ["npm"],
            "max_duration_seconds": 10,
        }
    )

    assert result["ok"] is True
    assert result["summary"]["status"] == "complete"
    assert result["findings_count"] == 1
    assert result["findings_preview"][0]["catalog_id"] == "catalog-test"
    assert Path(result["records_path"]).is_file()
    assert Path(result["diagnostics_path"]).is_file()
    assert Path(result["metadata_path"]).is_file()
    assert str(result["records_path"]).startswith(str(isolated_bumblebee / "bumblebee" / "runs"))

    latest = _call({"action": "latest", "limit": 1})
    assert latest["ok"] is True
    assert len(latest["runs"]) == 1
    assert latest["runs"][0]["summary"]["run_id"] == "run-test"


def test_findings_only_requires_catalog(isolated_bumblebee):
    result = _call({"action": "scan", "profile": "project", "findings_only": True})

    assert result["ok"] is False
    assert "findings_only requires" in result["error"]


def test_multiple_catalog_files_are_merged_for_scan(isolated_bumblebee, tmp_path):
    project_root = Path(os.environ["HERMES_HOME"]) / "project"
    project_root.mkdir()
    catalog_a = tmp_path / "a.json"
    catalog_b = tmp_path / "b.json"
    catalog_a.write_text(
        json.dumps(
            {
                "schema_version": "0.1.0",
                "entries": [
                    {"id": "a", "ecosystem": "npm", "package": "a", "versions": ["1.0.0"]}
                ],
            }
        ),
        encoding="utf-8",
    )
    catalog_b.write_text(
        json.dumps(
            {
                "schema_version": "0.1.0",
                "entries": [
                    {"id": "b", "ecosystem": "npm", "package": "b", "versions": ["2.0.0"]}
                ],
            }
        ),
        encoding="utf-8",
    )

    result = _call(
        {
            "action": "scan",
            "profile": "project",
            "roots": [str(project_root)],
            "catalogs": [str(catalog_a), str(catalog_b)],
        }
    )

    assert result["ok"] is True
    merged = Path(result["catalog"])
    assert merged.name == "exposure_catalog_merged.json"
    payload = json.loads(merged.read_text(encoding="utf-8"))
    assert [entry["id"] for entry in payload["entries"]] == ["a", "b"]
