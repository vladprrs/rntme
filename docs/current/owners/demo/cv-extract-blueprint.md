# `demo/cv-extract-blueprint/` — Resume extraction demo

Minimal-surface blueprint that exercises `@rntme/ai-llm-openrouter`. A user uploads a PDF resume; the system feeds it to OpenRouter (default `openrouter/deepseek/deepseek-v4-flash`) with a JSON-schema-pinned prompt; the user sees the extracted work-experience JSON.

## File map

```
demo/cv-extract-blueprint/
├── project.json                       modules: openrouter
├── pdm/
│   ├── pdm.json                       version stamp
│   └── entities/Resume.json           single state, single transition
├── services/app/
│   ├── service.json                   { kind: "domain" }
│   ├── qsm/
│   │   ├── qsm.json
│   │   └── projections/ResumeView.json   entity-mirror of Resume
│   ├── graphs/
│   │   ├── extractResume.json         uuid → call openrouter.Complete → emit
│   │   └── getResume.json             findMany ResumeView, filter by id
│   ├── bindings/bindings.json         POST /resumes, GET /resumes/{id}
│   ├── seed/seed.json                 empty
│   └── ui/                            single screen: file picker + result
└── test/
    ├── fixtures/sample-resume.pdf     1-page fictional resume
    └── integration/extract.test.ts    blueprint smoke against mocked OR
```

## Quick start

Set the OpenRouter API key as a secret env var on the runtime workload:

```bash
export OPENROUTER_API_KEY="${OPENROUTER:-sk-or-...}"
```

Then deploy or run the blueprint via the standard rntme runtime tooling. The home screen at `/` accepts a PDF (≤10MB), POSTs to `/resumes`, and renders the extracted JSON on response.

## How it works

1. UI: file picker reads the PDF, base64-encodes in-browser, POSTs `{filename, mediaType, fileBase64}` to `/resumes`.
2. Runtime: `extractResume` graph fires.
   - `uuid` node → resume_id.
   - `call` node → OpenRouter module's `Complete` RPC with the PDF as a `FILE` content block, a fixed text prompt, `response_format=json_schema`, and an embedded JSON Schema for {full_name, experience, education, skills}.
   - `emit` node → `Resume.complete` transition with `extractedJson` populated from the OR response.
   - `result` returns `resumeId`.
3. Projection `ResumeView` mirrors the entity row.
4. UI receives `resumeId` and renders the response inline.

The POST is **synchronous** — the HTTP request blocks for the duration of the OR call (~10–30s for a typical 1MB PDF + gpt-4o). If proxy timeouts in production cut this short, switch to async polling (backlog item 12 in the design spec).

## Failure mode

If OpenRouter fails, the graph fails (graph node `policy.onError: "fail"`). The HTTP request returns a 5xx with the AI_LLM error code in the message. **No record is written to `ResumeView`.** Graceful failure with a `failed` transition + `error_code` column is a backlog item.

## Limits and trade-offs

- No authentication. Open demo, like notes-blueprint without identity.
- Model is hard-coded to `openrouter/deepseek/deepseek-v4-flash` in the graph. Changing it requires editing the literal in `extractResume.json`.
- `extractedJson` is a string (`TEXT` column). Parse on the client; we do not validate the JSON shape server-side.
- File payload is inline base64 in the `ResumeUploaded`-equivalent event payload (well, in `ResumeComplete` here). Up to ~10MB is fine; larger needs the future S3 file-storage module (separate brainstorm).

## Specs

- `docs/history/specs/historical/2026-05-06-ai-llm-openrouter-module-design.md` — design.

## Where to look first

- `services/app/graphs/extractResume.json` — the single graph that does the work.
- `pdm/entities/Resume.json` — the single state machine.
- `test/integration/extract.test.ts` — what the demo's success looks like.
