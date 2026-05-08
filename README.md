# rntme

![rntme](hero.png)

[![CI](https://github.com/vladprrs/rntme/actions/workflows/ci.yml/badge.svg)](https://github.com/vladprrs/rntme/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

**An open runtime for AI-generated business apps.**

rntme turns project blueprints into running business applications. An agent
authors a blueprint: domain model, queries, commands, HTTP bindings, UI,
workflows, and vendor modules. rntme validates that blueprint in layers and
runs it through a standard runtime, so the second, third, and tenth iteration
stay consistent instead of becoming one-off generated code.

Star the repo if you want AI-generated apps that are inspectable, repeatable,
and built on open contracts instead of closed platform magic.

## Why rntme

- **Blueprints, not app spaghetti.** The project blueprint is the unit of
  authoring, review, versioning, and deploy.
- **Agents author; humans decide.** JSON artifacts, fail-fast validation, and
  stable error codes make generated work correctable.
- **Business workflows are first-class.** Cross-service orchestration uses
  BPMN; the current worker targets provisioned Operaton.
- **Integrations stay behind contracts.** Vendor modules implement canonical
  contracts for identity, AI/LLM, CRM, storage, and other capabilities.
- **Files use a standard storage path.** The first storage vendor is an
  S3-compatible module with per-service `storage.json` routes, direct browser
  uploads, and conditional bucket provisioning.
- **Open by default.** Runtime, validators, modules, apps, and demos are
  Apache 2.0. There is no separately licensed commercial layer.

## Try the CLI

```bash
npm install -g @rntme/cli
mkdir my-app && cd my-app
rntme init my-app
rntme skills install --agent claude-code
```

Then invoke `Skill: using-rntme` in your agent and let it design the first
service. The CLI also publishes and deploys project blueprints through the
rntme platform:

```bash
rntme login
rntme project publish --dry-run --org my-org --project my-app .
```

See [`apps/cli/README.md`](apps/cli/README.md) for the full CLI surface.

Agents: read [`AGENTS.md`](AGENTS.md) before touching the codebase.

## License

rntme is released under the [Apache License 2.0](LICENSE).
