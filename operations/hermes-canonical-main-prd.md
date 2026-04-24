# PRD: Hermes Canonical Main, Runtime Identity, And Drift Guard

## Summary

The Rotem Hermes fork has one canonical code branch and two separate runtime identities:

- `main` is the canonical GitHub/code branch in `rotemgrosman44/hermes-agent-rotem`.
- The WhatsApp main runtime is `Hermes Main / Mad Hatter`, implemented by the `madhatter` profile.
- The Telegram/X runtime is `Twitter Operator`, isolated from the WhatsApp main runtime.

This document prevents a recurring ambiguity: repo `main` is not a request to rename the live WhatsApp profile. The live WhatsApp main can stay technically named `madhatter` while the repo branch is canonicalized to `main`.

## Current Target State

- GitHub default branch: `main`.
- Local live checkout: `/home/rotemg/.hermes/hermes-agent` on `main`.
- Canonical live code: Hermes Agent `v0.11.0` / `v2026.4.23` plus Rotem's verified local runtime customizations.
- WhatsApp main profile: `/home/rotemg/.hermes/profiles/madhatter`.
- WhatsApp main service: `hermes-gateway-madhatter.service`.
- Telegram/X operator runtime: `/home/rotemg/.hermes-twitter-operator`.
- Telegram/X operator service: `hermes-twitter-operator-gateway.service`.
- Runtime-safe baseline snapshot: `/home/rotemg/.hermes/_sos`.

## Non-Goals

- Do not rename the `madhatter` profile as part of repo branch canonization.
- Do not change WhatsApp session data, Telegram pairing, browser profiles, auth state, or secrets.
- Do not merge unreleased `upstream/main` without a separate release-review flow.
- Do not run a second live gateway from a snapshot or staging checkout.

## Desired Checks

The canonical aligned state is:

- `git status --short --branch` reports `main...origin/main` with no local changes.
- `git rev-parse HEAD` equals `git ls-remote origin refs/heads/main`.
- `git remote show origin` reports `HEAD branch: main`.
- The latest SOS manifest reports `repo_branch: main`.
- The SOS manifest `repo_head` equals `origin/main`.
- `hermes-gateway-madhatter.service`, `hermes-dashboard.service`, and `hermes-twitter-operator-gateway.service` are healthy.
- WhatsApp remains connected through the `madhatter` profile.
- Telegram operator remains connected without a new pairing prompt.

## Guard Automation Requirements

The canonical baseline guard is reporting-only. It must:

- Check repo branch, remote default branch, snapshot manifest, and runtime health.
- Treat `main` as the repo branch only.
- Treat `madhatter` as the WhatsApp main runtime profile.
- Report drift without committing, pushing, merging, restarting services, editing sessions, or changing GitHub settings.

## Acceptance Criteria

- `origin/main` contains the verified live v0.11 cutover commit history.
- Local live checkout is on `main`, not on a temporary live branch.
- Runtime identities remain unchanged: WhatsApp main is `madhatter`, Telegram/X is `twitter-operator`.
- Latest SOS snapshot points to `main` at the same SHA as `origin/main`.
- Future operators can identify the code branch and runtime identities without reading chat history.
