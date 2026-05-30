# AudioReactor MiloTalks Consumer

## Purpose

Describe how `AudioReactor` consumes local-first task requests emitted by
`Knowledge` through the `MiloTalks` Codex connector.

## Upstream dependency

- producer project: `knowledge`
- upstream interface: `milotalks-codex-connector`
- integration mode: file-based inbox/outbox bridge

## Canonical paths

- task inbox: `MiloTalks/tasks/inbox`
- result outbox: `MiloTalks/tasks/outbox`
- local schemas: `MiloTalks/contracts`

## Request contract

AudioReactor accepts task requests aligned with the `Knowledge` connector and
adds:

- `sourceProject`
- `replyChannel`
- `correlationId`

Typical goals for this project:

- feature implementation
- recorder/export improvements
- UI refactors
- visual shell experiments
- drummer/detection calibration work

## Result contract

AudioReactor emits status/result payloads with:

- `accepted`
- `in_progress`
- `blocked`
- `needs_clarification`
- `completed`

Each result payload should include:

- short summary
- optional details
- artifact paths when relevant
- blocking reasons when relevant
- references to repo files, docs, or generated outputs

## Current status

- draft
- local-first
- compatible with future GitHub Issues bus mirroring
