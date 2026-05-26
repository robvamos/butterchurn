# Project Agent Instructions

This project is part of the shared AI workspace.

Default shared skill:

- use `sviluppo-conoscenza` for workspace-aware development and knowledge coordination

Shared knowledge root:

- [../codex-knowledge-hub](/F:/_CODEX/AI-WORKSPACE/codex-knowledge-hub)

Before implementing new features:

1. read shared registries
2. check reusable skills
3. check interfaces exposed by other projects
4. avoid duplicating existing logic
5. update `project-manifest.json` when version, capabilities, interfaces, or status change
6. sync the manifest back to the knowledge hub

Useful shared resources:

- [projects-index.yaml](/F:/_CODEX/AI-WORKSPACE/codex-knowledge-hub/registry/projects-index.yaml)
- [skills-index.yaml](/F:/_CODEX/AI-WORKSPACE/codex-knowledge-hub/registry/skills-index.yaml)
- [interfaces](/F:/_CODEX/AI-WORKSPACE/codex-knowledge-hub/interfaces)

If a capability already exists elsewhere, reuse or expose it through APIs or modules.
