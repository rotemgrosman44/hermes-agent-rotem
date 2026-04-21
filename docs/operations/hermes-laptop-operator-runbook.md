# Hermes Laptop Operator Runbook

This runbook captures the safe operator commands for the Rotem laptop Hermes runtime.

## Runtime Truth

- Runtime root: `/home/rotemg/.hermes`
- Project repo: `/home/rotemg/.hermes/hermes-agent`
- Canonical branch: `main`
- Gateway profile: `madhatter`

`main` is the Rotem fork canonical branch. GitHub's default branch must also be `main` so new checkouts, PRs, and agents land on the same source of truth.

Legacy branch `codex/hermes-rotem-laptop-2026-04-20` is a transitional fallback only. It must not be treated as canonical, and it should not receive new work unless a recovery procedure explicitly says so.

`upstream/main` is the NousResearch source repository. It is an update input for a separate release-review workflow, not the live Rotem runtime branch.

The runtime-safe baseline snapshot under `/home/rotemg/.hermes/_sos` is the recovery baseline. It is not a second live Hermes instance and must not be run in parallel with the primary gateway.

## Health Checks

Check the gateway and dashboard:

```bash
systemctl --user status hermes-gateway-madhatter.service hermes-dashboard.service --no-pager -l
curl -sS http://127.0.0.1:3000/health
curl -sS -o /tmp/hermes-dashboard-check.html -w 'dashboard_http=%{http_code}\n' http://127.0.0.1:9119/
```

Expected WhatsApp health is `status=connected` with `queueLength=0`. Expected dashboard HTTP status is `200`.

## Start Or Restart

Start services only when they are not already running:

```bash
systemctl --user start hermes-gateway-madhatter.service hermes-dashboard.service
```

Restart only after a code/config update, a failed health check, or an actual gateway fault:

```bash
systemctl --user restart hermes-gateway-madhatter.service hermes-dashboard.service
```

Do not restart just to inspect state. If health is already clean, leave the live session running.

## WhatsApp And Telegram Terminals

No dedicated terminal pane is required while the `systemd` services are active. WhatsApp uses its saved session under the `madhatter` profile. Telegram does not need a foreground terminal when configured through the gateway.

Open an interactive terminal only for recovery, logs, OAuth/pairing, or a deliberate version update.

## Repo Status And Push

Use explicit staging. Do not stage unrelated local files.

```bash
git status --short --branch
git diff --check
git diff --cached --check
git add <intended-files>
git commit -m "Short scoped message"
git push origin "$(git branch --show-current)"
git rev-parse HEAD
git ls-remote origin "refs/heads/$(git branch --show-current)"
```

The local and remote SHA values must match after push.

## Canonical Branch Checks

Use these checks when verifying that the repo is aligned:

```bash
git status --short --branch
git remote show origin
git rev-parse HEAD
git ls-remote origin refs/heads/main
sed -n '1,120p' /home/rotemg/.hermes/_sos/manifests/latest-summary.md
```

Expected:

- Local branch is `main`.
- `origin/main` equals local `HEAD`.
- GitHub remote reports `HEAD branch: main`.
- Latest runtime-safe baseline snapshot reports `repo_branch: main`.
- Snapshot `repo_head` equals `origin/main`.

## Before A Demo

- Do not merge unreleased `upstream/main`.
- Do not stop healthy services.
- Run the health checks above.
- Confirm GitHub has the intended branch SHA.
- Confirm GitHub default branch is `main`.
- Confirm the runtime-safe baseline snapshot points to `main`.
- Leave temporary reports and Drive artifacts untouched unless they are explicitly in scope.
