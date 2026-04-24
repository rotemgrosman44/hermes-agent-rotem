# Hermes Laptop Operator Runbook

This runbook captures safe commands and naming rules for the Rotem laptop Hermes runtime.

## Naming Rules

- Repo `main`: the canonical GitHub/code branch.
- WhatsApp main: `Hermes Main / Mad Hatter`, implemented by profile `madhatter`.
- Telegram/X agent: `Twitter Operator`, isolated from the WhatsApp main.

Do not rename the `madhatter` runtime profile just because the repo branch is named `main`.

## Runtime Truth

- Runtime root: `/home/rotemg/.hermes`
- Project repo: `/home/rotemg/.hermes/hermes-agent`
- Canonical branch: `main`
- WhatsApp main profile: `/home/rotemg/.hermes/profiles/madhatter`
- WhatsApp main service: `hermes-gateway-madhatter.service`
- Dashboard service: `hermes-dashboard.service`
- Telegram/X operator home: `/home/rotemg/.hermes-twitter-operator`
- Telegram/X operator service: `hermes-twitter-operator-gateway.service`

`upstream/main` from NousResearch is an update source only. It is not the live Rotem runtime branch unless a separate staged release review promotes it.

## Health Checks

```bash
systemctl --user status hermes-gateway-madhatter.service hermes-dashboard.service hermes-twitter-operator-gateway.service --no-pager -l
curl -sS http://127.0.0.1:3000/health
curl -sS http://127.0.0.1:9119/api/status
curl -sS http://127.0.0.1:9119/api/dashboard/plugins
```

Expected state:

- WhatsApp main remains connected through `madhatter`.
- Telegram/X operator remains connected without a new pairing prompt.
- Dashboard is reachable on localhost.
- `Mad Hatter`, `Twitter Operator`, and `TUI` dashboard tabs are visible.

## Repo Status And Push

Use explicit staging. Do not stage secrets, sessions, browser state, logs, or unrelated local files.

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

## Start Or Restart

Start services only when they are not already running:

```bash
systemctl --user start hermes-gateway-madhatter.service hermes-dashboard.service hermes-twitter-operator-gateway.service
```

Restart only after a code/config update, a failed health check, or an actual gateway fault:

```bash
systemctl --user restart hermes-dashboard.service
systemctl --user restart hermes-gateway-madhatter.service
systemctl --user restart hermes-twitter-operator-gateway.service
```

Do not restart messaging services just to inspect state.

## Before A Demo

- Do not merge unreleased `upstream/main`.
- Do not stop healthy services.
- Confirm GitHub default branch is `main`.
- Confirm `origin/main` equals local `HEAD`.
- Confirm the latest SOS snapshot points to `main`.
- Confirm WhatsApp main and Telegram/X operator are still isolated.
