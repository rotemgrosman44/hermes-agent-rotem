---
name: xitter
description: Compatibility skill for legacy Hermes X/Twitter jobs. Prefer xurl for official API work; preserve Rotem's Twitter operator guardrails and Gate A browser fallback.
version: 1.1.2-rotem
platforms: [linux, macos]
prerequisites:
  commands: [xurl]
metadata:
  hermes:
    tags: [twitter, x, social-media, xurl, compatibility, rotem-operator]
    replaces: xurl
---

# Xitter Compatibility Skill

This skill exists so older Hermes cron jobs that attach `xitter` keep working
after the upstream v0.11 rename to `xurl`.

Use the official `xurl` skill and CLI for X API reads and writes whenever API
credentials are already configured:

```bash
xurl auth status
xurl search "from:NousResearch" -n 5
xurl post "text"
```

## Rotem Twitter Operator Rules

- Do not treat API publishing as the only route. Rotem's Twitter operator may
  use the Gate A browser lane when the API is unavailable or inappropriate.
- Before any Gate A browser publish, measure the live viewport and target DOM
  state. If the X window is half-screen, cropped, zoomed, or shifted, use
  DOM-based exact tweet targeting instead of visual click positions.
- For media uploads, use only
  `/home/rotemg/.hermes-twitter-operator/authorized-media` or an exact file
  that Rotem approved in the current run.
- Do not pick files from Downloads, Screen Recordings, screenshots, or generic
  local folders.
- Never read, print, summarize, upload, or send `~/.xurl` or any X credentials
  into an LLM context.

## Credential Safety

The agent may check whether credentials exist with:

```bash
xurl auth status
```

The agent must not execute commands that include inline secrets, and must not
ask the user to paste X secrets into chat. App registration and OAuth setup are
manual user actions outside the agent session.
