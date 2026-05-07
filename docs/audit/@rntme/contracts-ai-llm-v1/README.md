# Architecture audit — `@rntme/contracts-ai-llm-v1`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-215` (`f1d0c8cb-59dc-40d8-9105-c48354dc44ab`) |
| **Issue title** | Audit: package architecture — @rntme/contracts-ai-llm-v1 |
| **Package / scope** | `@rntme/contracts-ai-llm-v1` |
| **Verdict (summary)** | needs cleanup - the package is structurally sound, but there are type-safety gaps, test holes and cross-package inconsistencies, which |
| **Audit comment id** | `079963bc-1073-4622-8d42-5585d6a3c82f` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Architectural audit @rntme/contracts-ai-llm-v1

**Verdict:** needs cleanup - the package is structurally sound, but there are type-safety gaps, test holes and cross-package inconsistencies that need to be closed before the first vendor module.

---

### Problems

#### 1. HIGH — Plain-string fields in places where enum is needed
**Evidence:** proto/ai_llm.proto:133, 280, 310, 470, 514 - tool_choice, Message.role, ThreadItem.role, response_format are declared as string.
**Impact:** Each vendor module will invent its own constants. Violates the purpose of the canonical contract - to be a single typed surface. There is currently no single source of truth for values ​​like "auto"|"required"|"none".
**Recommendation:** Enter enum ToolChoice, MessageRole, ResponseFormat in proto. Update fixtures and tests.

#### 2. HIGH — Empty conformance scripts
**Evidence:** modules/ai-llm/conformance/src/scenarios/*.scenarios.ts - all 14 files export []. test/suite-shape.test.ts:24-28 explicitly checks that arrays are empty.
**Impact:** Spec §12.2 requires specific per RPC scenarios. The Vendor module cannot start conformance without them. Right now skeleton doesn't provide any real value.
**Recommendation:** Either (a) fill the scenarios with minimal stubs with status: pending and seed/action/assertion structure, or (b) create a follow-up issue for completion after landing @rntme/conformance-framework. Do not leave empty - this is a disguised technical debt.

#### 3. MEDIUM - layerOf silently returns vendor for any unknown code
**Evidence:** src/error-codes.ts:29-34 - fallthrough without verification.
**Impact:** If external code makes layerOf of unknown code, it will get vendor instead of an error. Masks bugs when error-codes drift.
**Recommendation:** Change return type to ErrorLayer | null, return null for unknown codes. Add a test for invalid code.

#### 4. MEDIUM — Time_to_first_token field in v1 proto
**Evidence:** proto/ai_llm.proto:196 — Duration time_to_first_token on aggregate Completion.
**Impact:** Spec §Q3 explicitly excludes streaming from v1. The presence of this field misleads implementers into expecting streaming to be supported or coming soon.
**Recommendation:** Remove field from v1 (reserved = 10) or add comment. The second is a quick fix.

#### 5. MEDIUM — Mismatch of build scripts between contract packages
**Evidence:** AI-LLM and Identity use an inline shell. CRM uses scripts/build.mjs.
**Impact:** The discrepancy complicates workspace maintenance - the fix needs to be done in N places in different ways.
**Recommendation:** Unify: either everything on the inline shell (simple), or everything on build.mjs (if cross-platform is needed).

#### 6. MEDIUM - Lack of range validation in tests
**Evidence:** progress_percentage (0-100), TokenUsage.total_tokens (must be >= sum of parts), SamplingParams.temperature (0-2) - no tests for boundary values.
**Impact:** Vendor modules can receive or generate invalid values, and the contract does not signal them about valid ranges.
**Recommendation:** Add unit tests for boundary values. Consider proto validation rules if protoc-gen-validate appears in the workspace.

#### 7. LOW — Version 0.0.0 for all contract packages
**Evidence:** package.json:3 — version 0.0.0.
**Impact:** Unable to track breaking changes through semver. Workspace consumers cannot pin version.
**Recommendation:** Define a versioning strategy for contract packages. I suggest: 0.1.0 for v1 skeleton, 1.0.0 when the first vendor module passes live-conformance.

#### 8. LOW - JSON import assertion in error-codes.ts
**Evidence:** src/error-codes.ts:1 — import with type json.
**Impact:** Some consumer bundler configurations may not support import assertions.
**Recommendation:** Replace with readFileSync + JSON.parse or add fallback. Low priority - workspace target = Node 20.

---

### Quick wins (can be done without a product solution)
- Fix layerOf -> ErrorLayer | null + test
- Add a comment to time_to_first_token or make it reserved
- Unify the build script with CRM or Identity
- Add unit tests for invalid error code and enum sentinel values
- Add vitest.config.ts for consistency with other packages

### Requires decision from Vlad/architectural committee
- Do we need enum for tool_choice/role/response_format in v1, or string - a conscious trade-off?
- When and by whom are conformance scenarios filled out: now (skeleton with pending status) or after the landing framework?
- Semver strategy for contract packages

---

### What's done well
- Clean structure, completely repeats the Identity/CRM pattern.
- All 35 tests pass, build/lint/typecheck are green.
- 32 error codes cover all 4 layers (structural/references/consistency/vendor).
- Correct separation of ai_llm.proto (service) and ai_llm-events.proto (events).
- Drift tests guarantee 1:1 correspondence between RPC <-> scenario file.
- Binary fixtures are checked for magic bytes and size <= 100KB.
- Dependencies are minimal: only @rntme/contracts-common-v1 + protobufjs.

---

### DEV Ready
The plan is ready for DEV with a caveat: before starting the first vendor module, you need to close HIGH problems (#1 enum strings, #2 empty scenarios). The rest - MEDIUM/LOW - can be fixed in parallel. I recommend creating a follow-up issue to fill out conformance scripts with blocker priority.
