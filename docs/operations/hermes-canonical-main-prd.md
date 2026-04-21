# PRD: Hermes Canonical Main, Baseline Snapshot, And Automation Guard

## Summary

The Rotem Hermes fork must have one clear canonical source of truth:

- `main` is the canonical repo branch.
- GitHub default branch is `main`.
- The local runtime checkout works from `main`.
- The runtime-safe baseline snapshot is the recovery baseline.
- The legacy `codex/hermes-rotem-laptop-2026-04-20` branch is a temporary fallback only.

This removes ambiguity between "what runs", "what opens by default in GitHub", and "what can be restored if the live runtime breaks".

## Goals

- Make new agents, humans, and GitHub PRs land on `main` by default.
- Keep the old Codex branch available briefly as a fallback, without treating it as canonical.
- Keep the Hermes runtime and the recovery snapshot aligned to the same commit.
- Add a guard automation that reports drift without mutating code, restarting services, or changing GitHub state.

## Non-Goals

- Do not merge `upstream/main` from NousResearch.
- Do not run a second live Hermes gateway from the snapshot.
- Do not delete the legacy Codex branch immediately.
- Do not restore auth, sessions, credentials, memories, logs, or cache content from the snapshot.

## Definitions

- **Canonical branch**: `main` in `rotemgrosman44/hermes-agent-rotem`.
- **GitHub default branch**: Repository metadata that decides what branch opens by default.
- **Legacy Codex branch**: `codex/hermes-rotem-laptop-2026-04-20`; fallback only.
- **Upstream branch**: `upstream/main` from NousResearch; update source only after release review.
- **Runtime-safe baseline snapshot**: Safe recovery baseline under `/home/rotemg/.hermes/_sos`, excluding secrets and live session state.

## Desired State

- `git status --short --branch` reports `main...origin/main` with no local changes.
- `git remote show origin` reports `HEAD branch: main`.
- `git rev-parse HEAD` equals `git ls-remote origin refs/heads/main`.
- `/home/rotemg/.hermes/_sos/manifests/latest-summary.md` reports `repo_branch: main`.
- Snapshot `repo_head` equals `origin/main`.
- `hermes-gateway-madhatter.service` and `hermes-dashboard.service` are healthy.
- WhatsApp health reports `status=connected` and `queueLength=0`.

## Implementation Plan

1. Set GitHub default branch to `main`.
2. Document canonical branch rules in README and operator runbook.
3. Create this PRD as the governance source for future agents.
4. Land documentation through a GitHub PR into `main`.
5. Refresh the runtime-safe baseline snapshot after `main` is final.
6. Add a reporting-only guard automation as the last step.

## Guard Automation Requirements

The guard automation must:

- Run after the weekly snapshot automation.
- Check repo, GitHub default branch, snapshot manifest, and runtime health.
- Open an inbox item every run with one verdict: `completed`, `completed_with_caveat`, or `blocked`.
- Never commit, push, merge, restart services, or change GitHub settings.

## Acceptance Criteria

- GitHub default branch is `main`.
- PRD, README note, and runbook update are merged into `main`.
- Runtime-safe baseline snapshot is refreshed from `main`.
- There are four active Codex automations, with the two deprecated X automations remaining paused.
- A future operator can identify the canonical branch and recovery baseline without reading chat history.
