# MiloTalks Bridge For AudioReactor

This folder makes `AudioReactor` a local-first consumer of the `Knowledge`
`MiloTalks` Codex task network.

The bridge is intentionally file-based so Milo or another orchestrator can:

- drop structured work requests into a stable inbox
- watch progress through status/result files
- keep machine-readable payloads without hiding human intent

## Canonical folders

- `tasks/inbox`
  Incoming task requests that target this project.
- `tasks/outbox`
  Status and result payloads emitted by this project.
- `contracts`
  Local JSON schema references for request and result payloads.

## Current contract

Request payloads follow the `Knowledge` MiloTalks Codex connector shape and add
an explicit reply channel:

- `taskId`
- `createdAt`
- `projectId`
- `repo`
- `branch`
- `requestedBy`
- `userUtterance`
- `goal`
- `constraints[]`
- `acceptanceCriteria[]`
- `riskLevel`
- `requiresConfirmation`
- `deliveryMode`
- `status`
- `sourceProject`
- `replyChannel`
- `correlationId`

Result payloads are local-first and future-proofed for a GitHub Issues bus:

- `taskId`
- `correlationId`
- `projectId`
- `status`
- `summary`
- `details`
- `artifacts[]`
- `blockingReasons[]`
- `references[]`
- `updatedAt`

Allowed statuses:

- `accepted`
- `in_progress`
- `blocked`
- `needs_clarification`
- `completed`

## Helper scripts

- `node scripts/create-milo-task.mjs`
  Create a task JSON in `MiloTalks/tasks/inbox`.
- `node scripts/write-milo-result.mjs`
  Emit a status/result JSON in `MiloTalks/tasks/outbox`.

These scripts are a local bridge for orchestration and do not replace normal
Git branches, commits, or pull requests.
