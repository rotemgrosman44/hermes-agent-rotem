# Hermes Laptop Operator Runbook

This runbook captures the safe operator commands for the Rotem laptop Hermes runtime.

## Runtime Truth

- Runtime root: `/home/rotemg/.hermes`
- Project repo: `/home/rotemg/.hermes/hermes-agent`
- Working branch: `codex/hermes-rotem-laptop-2026-04-20`
- Gateway profile: `madhatter`

Do not use `upstream/main` as a pre-demo update source unless a separate release review explicitly approves it.

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

## Before A Demo

- Do not merge unreleased `upstream/main`.
- Do not stop healthy services.
- Run the health checks above.
- Confirm GitHub has the intended branch SHA.
- Leave temporary reports and Drive artifacts untouched unless they are explicitly in scope.
