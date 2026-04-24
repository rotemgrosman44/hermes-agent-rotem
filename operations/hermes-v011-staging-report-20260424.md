# Hermes v0.11.0 Staging Report - 2026-04-24

## Target

- Upstream release: `v2026.4.23`
- Hermes version: `Hermes Agent v0.11.0 (2026.4.23)`
- Staging branch: `upgrade/hermes-v011-staging-20260424-134007-IDT`
- Previous live rollback point: `a25b42e2a63e6b71e2ef3f8bcd40cc3f9f4daa44`

## Scope

- Live Telegram pairing was not changed.
- Live WhatsApp pairing was not changed.
- Live cron jobs were not duplicated in staging.
- Local sensitive backups were kept outside OneDrive and outside Git.
- GitHub-safe branch/tag backup was created for code only.

## Staging Runtime

- Staging repo: `/home/rotemg/.hermes-staging/hermes-agent-v0.11`
- Staging main home: `/home/rotemg/.hermes-staging/profiles/madhatter-v011`
- Staging operator home: `/home/rotemg/.hermes-staging/twitter-operator-v011`
- Staging dashboard: `127.0.0.1:9129`
- Live dashboard remains on `127.0.0.1:9119`

## Reconciled Local Behavior

- Restored WhatsApp group-user free-response gating, including LID alias resolution.
- Preserved explicit outbound voice consent policy for gateway replies.
- Preserved WhatsApp bridge outbound echo suppression.
- Added `xitter` compatibility skill for legacy Twitter operator cron jobs while pointing new work at upstream `xurl`.
- Added read-only dashboard plugin `twitter-operator-status`.
- Fixed quiet-mode logging so plugin manifest safety warnings are not suppressed after Codex cron/gateway runs.

## Twitter Operator Validation

- Live operator remains isolated from main Hermes.
- Live operator gateway reports running.
- Telegram state reports connected.
- Expected cron jobs are present:
  - `twitter-0900` at `0 9 * * *`
  - `twitter-1300` at `0 13 * * *`
  - `twitter-1700` at `0 17 * * *`
  - `twitter-2100` at `0 21 * * *`
- Staging operator cron copy is paused to prevent duplicate execution.
- Gate A watchdog status is visible through the read-only dashboard plugin.

## Verification

- `python -m compileall -q gateway tools run_agent.py plugins/twitter-operator-status/dashboard/plugin_api.py`
- Gateway/service focused tests: `381 passed`
- Cron/web/plugin focused tests: `541 passed`
- File-permission tests pass on the Linux filesystem: `8 passed`
- Web build completed successfully.
- TUI build completed successfully.
- Staging dashboard binds to `127.0.0.1`, not `0.0.0.0`.
- Dashboard plugin API loads and reports operator status read-only.

## Known Notes

- Running Unix permission tests from a Windows-mounted temp path reports `0777`; the same tests pass from Linux `/tmp`.
- `hermes doctor --fix` was intentionally not run in staging because it would repoint the global `hermes` symlink to staging before cutover.
- npm audit reported upstream dependency vulnerabilities during install; no lockfile mutation was applied during staging.

## Sanitization

This report intentionally excludes `.env`, auth files, sessions, state databases,
logs, browser profiles, WhatsApp sessions, Telegram pairing data, chat IDs, and
other runtime secrets.
