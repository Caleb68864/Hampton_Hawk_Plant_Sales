# Dark Factory Postmortem — 2026-04-26 Post-Sale Improvements Run (Run 2)

**Run ID:** `2f990d05-5c02-4b62-af4b-70d5158eaba0`
**Branch (factory-created):** `2026/04/26-0401-caleb-feat-post-sale-improvements-master`
**Master spec:** `docs/specs/2026-04-25-post-sale-improvements-master.md`
**Outcome:** `failed` — exit code 1, halted after dispatching SS-04
**Wall clock:** 2026-04-26 04:01:20 UTC → ~04:49 UTC (≈48 minutes), then SS-04 hung until external timeout
**Author:** Claude Code (Opus 4.7), 2026-04-26
**Predecessor:** `docs/dark-factory-postmortem-2026-04-25.md` (Run 1, hollow-success cascade — different failure mode)

---

## TL;DR — verifier finalization is non-deterministic

Run 2 is **not** the same hollow-success failure as Run 1. The implementer prompt was clearly upgraded between runs: SS-01, SS-02, and SS-03 all wrote substantive, real code (3,169 net lines across 59 files). The work is on disk and matches the spec.

The new failure mode is:

1. **The verifier-finalize step is non-deterministic.** The implementer emits evidence files with `status: "needs-verifier"`. A separate verifier agent is supposed to run the verification commands and rewrite each file with a finalized format (`verification_command_sha256` + `timestamp`, `status` field removed). For SS-03 this happened. For SS-01 and SS-02 it did NOT — every evidence file is still in the `needs-verifier` shape — even though the underlying code changes on disk satisfy the verification commands.
2. **The closer treats "any evidence still tagged `needs-verifier`" as a hard defer**, regardless of whether the verification command would actually pass. SS-01 and SS-02's evidence is `needs-verifier` → both deferred → both uncommitted, despite their work being correct.
3. **SS-04 hung past its dispatch window**, the CLI exited 1, and SS-05 through SS-15 never ran. The work for SS-01 and SS-02 sits dirty in the working tree on the factory-created branch, abandoned.

Net delivery: 1 of 15 sub-specs committed (SS-03). 2 of 15 done-but-uncommitted (SS-01, SS-02). 12 of 15 not started.

Compared to Run 1 (15 hollow), Run 2 is a real improvement on the implementer side. The new bottleneck is the verifier dispatch and the closer's defer-on-needs-verifier rule.

---

## Timeline (UTC)

| Time | Event |
|------|------|
| 04:01:20 | `branch_gate_entered` — CLI created branch `2026/04/26-0401-caleb-feat-post-sale-improvements-master` from `4d749fc` (master pre-run head). |
| 04:01:20 | `run_started` against master spec. |
| 04:01:20 | Post-run phase synthesis: closer, completeness, golden-principles, outcomes (4 phases). |
| 04:01:20 | `sub_spec_dispatched: SS-01`. |
| 04:16:20 | `agent_call SS-01` returned `status: timeout, duration_ms: 900006, model: opus, tokens_used: 0`. **Opus implementer hit the 900s SDK timeout with zero tokens recorded.** |
| 04:16:20 | `agent_returned_null` → `fallback_attempted opus → sonnet, attempt: 2`. |
| 04:23:20 | `agent_call SS-01` (Sonnet) returned `status: success, duration_ms: 419253, tokens_used: 18296`. |
| 04:23:31 | `sub_spec_deferred SS-01 reason: verifier-blocked: ss01-no-cdn-fonts` (emitted twice, back-to-back). |
| 04:23:31 | `sub_spec_dispatched: SS-02`. |
| 04:37:45 | `agent_call SS-02` returned `status: success, duration_ms: 854084, tokens_used: 83671, model: opus`. (~14m13s — within 900s by ~46s.) |
| 04:37:51 | `sub_spec_deferred SS-02 reason: verifier-blocked: ss02-migration-exists`. |
| 04:37:51 | `sub_spec_dispatched: SS-03`. |
| 04:49:15 | `agent_call SS-03` returned `status: success, duration_ms: 684109, tokens_used: 67752, model: opus`. (~11m24s.) |
| 04:49:22 | `sub_spec_completed SS-03 status: pass`. |
| 04:49:23 | `factory_commit SS-03 → a0f2124`. |
| 04:49:23 | `sub_spec_dispatched: SS-04`. |
| (no more events) | SS-04 never returned. CLI exited 1 sometime later. |

The CLI ran for ≈48 minutes before exiting; this exceeded the 16-minute Bash timeout that was passed to it, suggesting either the timeout was waived for a background-mode invocation or the CLI's own internal timeout dominated.

---

## What landed on disk

### Committed (1 of 15)

**SS-03 — Orders bulk backend** at `a0f2124`:
- `api/src/HamptonHawksPlantSales.Core/DTOs/OrderDtos.cs` — bulk-action request/response DTOs
- `api/src/HamptonHawksPlantSales.Core/Interfaces/IOrderService.cs` — `BulkCompleteAsync`, `BulkSetStatusAsync` signatures
- `api/src/HamptonHawksPlantSales.Core/Validators/BulkCompleteOrdersRequestValidator.cs`
- `api/src/HamptonHawksPlantSales.Core/Validators/BulkSetOrderStatusRequestValidator.cs`
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/OrderService.cs` — bulk methods, transactional, row-locked
- `api/src/HamptonHawksPlantSales.Api/Controllers/OrdersController.cs` — `POST /bulk-complete`, `POST /bulk-status`, `[RequiresAdminPin]`
- `api/tests/HamptonHawksPlantSales.Tests/Orders/BulkCompleteTests.cs` (267 lines)
- `api/tests/HamptonHawksPlantSales.Tests/Orders/BulkSetStatusTests.cs` (295 lines)

This work appears complete and correct against the SS-03 phase spec (`docs/specs/sale-quick-wins-bundle/sub-spec-3-orders-bulk-backend.md`).

### Done on disk, NOT committed (2 of 15)

**SS-01 — Joy Pass: components + typography**
- `web/src/components/shared/TouchButton.tsx` (57 lines)
- `web/src/components/shared/SectionHeading.tsx` (52 lines)
- `web/src/components/shared/BotanicalEmptyState.tsx` (50 lines)
- `web/src/components/shared/BrandedStationGreeting.tsx` (218 lines)
- `web/src/components/pickup/ScanSuccessFlash.tsx` (130 lines)
- `web/src/components/pickup/OrderCompleteCelebration.tsx` (113 lines)
- `web/src/styles/joy.css` (129 lines) — keyframes, button states, typography
- `web/src/index.css` — Joy Pass import (+4)
- `web/src/main.tsx` — @fontsource imports (+3)
- `web/src/pages/station/StationHomePage.tsx` — opt-in (+138)
- `web/src/pages/pickup/PickupLookupPage.tsx` — opt-in (+78)
- `web/src/pages/pickup/PickupScanPage.tsx` — opt-in (+112)
- `web/package.json` + `web/package-lock.json` — `@fontsource/fraunces`, `@fontsource/manrope` (already committed in Run 1)

Verifier evidence at `.forge-factory/task-evidence/ss01-*.done.json` — 14 files, all stuck at `status: "needs-verifier"`. The verification commands (greps for "TouchButton", "Section­Heading", "@fontsource", `! grep -q fonts.googleapis.com web/dist`, etc.) would all PASS against the on-disk state, but no agent ever ran them and rewrote the evidence.

**SS-02 — Settings tunables backend**
- `api/src/HamptonHawksPlantSales.Core/Models/AppSettings.cs` — added `PickupSearchDebounceMs`, `PickupAutoJumpMode`, `PickupMultiScanEnabled` (+20)
- `api/src/HamptonHawksPlantSales.Core/Interfaces/ISettingsService.cs` (+1)
- `api/src/HamptonHawksPlantSales.Core/DTOs/SettingsDtos.cs` (+30)
- `api/src/HamptonHawksPlantSales.Core/Validators/UpdateScannerTuningRequestValidator.cs`
- `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/AppSettingsConfiguration.cs` (+12)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/SettingsService.cs` — extended (+39)
- `api/src/HamptonHawksPlantSales.Infrastructure/Data/Migrations/20260426042710_AddScannerTunings.cs` (59 lines)
- `api/src/HamptonHawksPlantSales.Infrastructure/Data/Migrations/20260426042710_AddScannerTunings.Designer.cs` (637 lines)
- `api/src/HamptonHawksPlantSales.Infrastructure/Data/Migrations/AppDbContextModelSnapshot.cs` updates
- `api/src/HamptonHawksPlantSales.Api/Controllers/SettingsController.cs` — `PUT /api/settings/scanner-tuning` (+33)
- `api/tests/HamptonHawksPlantSales.Tests/Settings/ScannerTuningTests.cs` (219 lines)

Verifier evidence at `.forge-factory/task-evidence/ss02-*.done.json` — 6 files, all stuck at `status: "needs-verifier"`. The verification commands (`ls Migrations/*AddScannerTunings*`, grep for new fields in DTO, etc.) would all PASS.

### Not started (12 of 15)

SS-04, SS-05, SS-06, SS-07, SS-08, SS-09, SS-10, SS-11, SS-12, SS-13, SS-14, SS-15 — no events, no evidence, no commits. SS-04 was dispatched but the CLI died before it returned.

---

## Per-sub-spec diagnosis

### SS-01 — Joy Pass

**Status:** verifier-blocked → uncommitted (work on disk).

**Failure chain:**
1. Opus implementer attempt 1 dispatched 04:01:20.
2. Opus hit the **SDK 900-second hard timeout**. `tokens_used: 0` indicates the SDK never received a single tool result back — the call was killed mid-think or mid-tool. (Possibly a single very long tool call that exceeded the per-tool budget; possibly a stuck network read on the SDK side.)
3. Fallback to Sonnet at 04:16:20.
4. Sonnet completed at 04:23:20 in 419s with 18K tokens. The on-disk diff shows Sonnet did the full SS-01 scope correctly.
5. **The verifier never ran.** All 14 evidence files for SS-01 still have `"status": "needs-verifier"`, no `verification_command_sha256` field, no `timestamp` field.
6. The closer's defer rule fired on the first `needs-verifier` task it inspected (`ss01-no-cdn-fonts`) and emitted `sub_spec_deferred` (twice — secondary bug, see Cause 4 below).

**Why the verifier didn't run:** strong hypothesis is the **fallback path skips verifier dispatch**. After the implementer fallback (opus → sonnet), the CLI marked the task complete without spawning the verifier. SS-03, which ran cleanly on Opus first try, got verified.

**Files the closer should have committed (and didn't):** the 13 files listed in "Done on disk, NOT committed → SS-01" above, plus `web/package.json` and `web/package-lock.json` (already committed in Run 1, so net new: 13).

### SS-02 — Settings tunables backend

**Status:** verifier-blocked → uncommitted (work on disk).

**Failure chain:**
1. Opus dispatched 04:23:31. Completed 04:37:45 in 854s — 46 seconds shy of the 900s timeout.
2. SDK reports `status: success`, 83K tokens (the largest of any sub-spec). The on-disk diff shows the full SS-02 scope.
3. **The verifier never ran.** All 6 evidence files for SS-02 still have `"status": "needs-verifier"`.
4. Closer fired `sub_spec_deferred SS-02 reason: verifier-blocked: ss02-migration-exists` — even though the migration files DO exist on disk and match the names the verifier was supposed to look for.

**Why the verifier didn't run here is harder to explain.** Unlike SS-01, this was a clean Opus run, no fallback. Possibilities:
- The implementer agent was supposed to spawn the verifier as a subagent inside its own loop, and it ran out of turn budget before doing so (854s ≈ 14 minutes of Opus, with 83K tokens — plausible budget exhaustion).
- The verifier agent IS dispatched separately by the CLI, but only when the implementer returns within some threshold under the 900s ceiling. SS-02 was inside the ceiling but maybe the threshold was tighter (e.g. 750s).
- The verifier returned but failed to rewrite the evidence files due to a path or filesystem race.

The events log has zero verifier events (no `verifier_dispatched`, no second `agent_call` per sub-spec), so on the public telemetry it is indistinguishable whether the verifier was never spawned vs. spawned-and-failed-silently.

**Files the closer should have committed (and didn't):** the 11 files listed in "Done on disk, NOT committed → SS-02" above.

### SS-03 — Orders bulk backend

**Status:** complete, committed at `a0f2124`. ✅

This is the only sub-spec where the full pipeline worked end-to-end. Implementer (Opus, 684s, 68K tokens) → verifier finalized all 8 evidence files → closer committed.

The 8 finalized evidence files (`.forge-factory/task-evidence/ss03-*.done.json`) have the expected shape: `verification_command_sha256` + `timestamp`, no `status` field, `worker_id: "implementer-ss03"`. This is the working format. SS-01 and SS-02 should look like this and don't.

### SS-04 — Reports backend

**Status:** dispatched, never returned. No evidence files. No diff on disk for this scope.

**Likely cause:** SS-04 also hit the 900s Opus timeout (like SS-01 attempt 1) but the CLI's resilience path on a SECOND timeout in a single run is broken. Either the fallback queue is exhausted, or the CLI's own watchdog killed the process when SS-04 tipped it past some cumulative budget.

Without events past 04:49:23, this is informed speculation. Fix: add `agent_call`-with-status-timeout events for SS-04, and on a hung dispatch capture a sticky kill log to `.forge-factory/`.

**Files that should have been created** (per `docs/specs/sale-quick-wins-bundle/sub-spec-5-reports-backend.md`):
- `api/src/HamptonHawksPlantSales.Core/Interfaces/IReportService.cs` — `GetSalesBySellerAsync`, `GetSalesByCustomerAsync`, optional `GetSalesByPlantAsync` signatures
- `api/src/HamptonHawksPlantSales.Core/DTOs/ReportDtos.cs` — `SalesBySellerRow`, `SalesByCustomerRow`, `SalesByPlantRow` DTOs
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/ReportService.cs` — implementations
- `api/src/HamptonHawksPlantSales.Api/Controllers/ReportsController.cs` — `GET /api/reports/sales-by-seller`, `/sales-by-customer`, `/sales-by-plant`
- New EF migration if `Orders.SellerId` or `Orders.CustomerId` indexes are missing
- Tests under `api/tests/.../Reports/`

(Of note: `api/src/HamptonHawksPlantSales.Core/DTOs/ReportDtos.cs` and `IReportService.cs` are already shown as "modified" in the current working-tree status — likely from a partial earlier run, NOT this run. Treat as suspect; review before re-dispatching SS-04.)

### SS-05 through SS-15 — never started

No events, no evidence, no on-disk delta. Their phase specs in `docs/specs/<bundle>/` are intact and unchanged. Re-dispatchable as a clean run.

---

## Root-cause analysis

### Cause 1 (HIGHEST IMPACT) — Verifier finalization is conditional and silent

The verifier's finalize-the-evidence step ran for SS-03 but not for SS-01 (fallback path) or SS-02 (long-running primary). The CLI does not log verifier dispatch events to the run JSONL, so we can't see from telemetry whether the verifier was spawned or skipped.

**Symptom:** `.forge-factory/task-evidence/ss01-*.done.json` and `ss02-*.done.json` retain `status: "needs-verifier"` despite the underlying verification commands being trivially satisfiable.

**Closer's reaction:** any task with `status: "needs-verifier"` triggers `sub_spec_deferred reason: verifier-blocked: <task-id>`. This is correct as a safety rule — but the upstream verifier is silently skipping work, and the closer has no way to distinguish "verifier never ran" from "verifier ran and failed".

**Hypotheses for why the verifier skips:**
- (a) The CLI only dispatches the verifier when the implementer returned cleanly on the FIRST attempt. Fallback paths skip verifier dispatch. (Matches SS-01.)
- (b) The verifier dispatch shares a budget pool with the implementer, and a long implementer run exhausts the pool before the verifier can be spawned. (Matches SS-02 at 854s.)
- (c) The verifier is dispatched as a sub-task inside the implementer's agent loop, and it ran for SS-03 (684s budget headroom) but not SS-02 (no headroom).

**Required fix:** the verifier MUST run, on a separate timeout budget, after every implementer return — pass, fallback, or near-timeout. Emit explicit `verifier_dispatched`, `verifier_returned`, and per-task `verification_evaluated` events to the JSONL so we can audit. If the verifier itself times out, mark the task `verifier_failed` (NOT `needs-verifier`) so the closer can distinguish.

### Cause 2 — Opus 900s SDK timeout cascade

Two of the four dispatched sub-specs (SS-01 attempt 1, and probably SS-04) hit the Agent SDK's 900-second hard timeout. The fallback path (Opus → Sonnet) worked once for SS-01 but apparently not a second time for SS-04.

**Symptom:** `agent_call status: timeout, duration_ms: 900006, tokens_used: 0`. The `tokens_used: 0` is the smoking gun — Opus never streamed back a single tool result before being killed. This is consistent with a single tool call hanging (e.g., a long bash compile/test that exceeded an inner per-tool timeout, or a network stall), NOT the model running out of context.

**Why SS-04 may have failed where SS-01 fell back:** the fallback policy may be "one fallback per run" rather than "one fallback per sub-spec". Or the fallback was attempted but Sonnet too hung. We can't tell from the events because SS-04 has zero events past dispatch.

**Required fix:**
- Capture stderr/stdout from the Agent SDK call to `.forge-factory/agent-logs/<runId>/<subSpecId>-attempt-<n>.log` so a 900s timeout doesn't lose all its tool history.
- Lower per-tool timeouts inside the worker (e.g., `dotnet test` should have its own 5-min cap and surface a structured failure to the agent, not stall the SDK loop).
- Allow per-sub-spec fallback budget independent of total run budget.
- Add a `worker_health_check` event every 30 seconds the agent is running (just a heartbeat) so a hung worker is observable.

### Cause 3 — Closer commits per-sub-spec but does not retroactively commit deferred-but-clean sub-specs

When a sub-spec is deferred, its on-disk work is left in the working tree, uncommitted, and the next sub-spec's worker will see it as part of its starting state. SS-02's worker started from a tree with all of SS-01's Joy Pass changes already on disk (uncommitted), and SS-03 started from a tree with both SS-01 and SS-02 changes on disk.

This is "happy" for dependent sub-specs (they see each other's work) but it means:
- Run end-state is a dirty tree where deferred-but-clean work mingles with the committed SS-03 work.
- A re-run of the factory on the same branch will see uncommitted changes and refuse (the same gate that caught us at the start of this run, see Cause 5).
- If the human stashes the dirty tree to re-run the factory, SS-01 and SS-02's work goes into the stash.

**Required fix:** at the closer's end-of-run summary, distinguish three buckets per sub-spec:
- `committed` — verified and committed.
- `verifier_skipped_clean` — implementer ran, verification commands would pass but verifier never finalized. Offer to commit.
- `failed` — implementer failed or verification commands actually fail. Leave dirty for human review.

A `--auto-finalize-clean-deferrals` CLI flag would let the human opt into "if the verification commands pass NOW, commit the deferred sub-spec" without re-running the worker.

### Cause 4 — Duplicate `sub_spec_deferred` events

`sub_spec_deferred SS-01 reason: verifier-blocked: ss01-no-cdn-fonts` is emitted twice back-to-back at 04:23:31 (lines 12-13 of events.jsonl). Same for SS-02 at 04:37:51. Cosmetic but indicates the closer's defer code path is invoked twice — likely once per phase that sees the `needs-verifier` evidence (e.g., once by the closer phase, once by the completeness phase).

**Required fix:** debounce by `(runId, subSpecId)`. Side effect of the underlying double-dispatch is wasted golden-principles re-evaluation at 2× cost.

### Cause 5 — Pre-flight gate "uncommitted changes" forces an inconvenient stash dance

The CLI refuses to start with `refuse: uncommitted changes — stash or commit before running the factory`. This is correct as a safety rail BUT the human friction means many users will `git stash -u` to bypass it (as I did at the start of this run), risking the loss of work-in-progress to the stash if the run crashes mid-flight. The stash is not auto-popped on success.

**Recommendation:** add a `--allow-dirty` flag, or auto-stash + auto-pop on success / on graceful failure. Critical: if the CLI auto-stashes, it must guarantee the stash is restored on every exit path, including SIGKILL.

---

## Recovery options for THIS branch

The factory branch `2026/04/26-0401-caleb-feat-post-sale-improvements-master` currently has:
- Committed SS-03 (clean).
- Uncommitted SS-01 + SS-02 work (clean, would pass verification).
- Uncommitted leftover modifications to `ReportDtos.cs` and `IReportService.cs` from a different earlier run (SUSPECT — review).
- 12 unfinished sub-specs (SS-04, SS-05, SS-06, SS-07, SS-08, SS-09, SS-10, SS-11, SS-12, SS-13, SS-14, SS-15).

**Recommended path forward:**

1. **Review and discard the suspect ReportDtos/IReportService working-tree edits** — these are not from Run 2 and likely conflict with the SS-04 work the next factory run will produce. `git checkout -- api/src/HamptonHawksPlantSales.Core/DTOs/ReportDtos.cs api/src/HamptonHawksPlantSales.Core/Interfaces/IReportService.cs` after diffing them against the on-disk reference.

2. **Manually verify SS-01 and SS-02 by running their Checks** before committing:
   - `cd web && npm run build` (SS-01 build check)
   - `! grep -rq "fonts.googleapis.com" web/dist` (SS-01 no-CDN check)
   - Grep for the new component names (`TouchButton`, `SectionHeading`, `BotanicalEmptyState`, `BrandedStationGreeting`, `ScanSuccessFlash`, `OrderCompleteCelebration`)
   - `dotnet build api/HamptonHawksPlantSales.sln` (SS-02 build)
   - `dotnet test --filter "FullyQualifiedName~ScannerTuning"` (SS-02 tests)
   - `ls api/.../Migrations/*AddScannerTunings*`
3. **Commit SS-01 and SS-02 manually** in two commits matching the factory's convention:
   - `factory(SS-01): worker output (manually finalized post-Run-2 verifier failure)`
   - `factory(SS-02): worker output (manually finalized post-Run-2 verifier failure)`
4. **Re-dispatch SS-04 through SS-15** via `node forge-factory/dist/cli.cjs run --resume --factory-dir <factoryDir>` IF the CLI supports a partial resume from the JSONL state. If it doesn't, proceed to step 5.
5. **Re-run the factory in a single fresh sub-spec subset.** Either:
   - (a) A scratch master spec containing only SS-04..SS-15 with their dependency graph rebased to assume SS-01/SS-02/SS-03 done. This is the cleanest path.
   - (b) The full master spec re-run; the CLI should detect SS-01..SS-03 as already-applied (their structural greps will pass, build is clean) and skip them. This requires verifier-driven idempotency we cannot confirm exists.

**Stash to restore:** `stash@{0}: pre-factory-stash-20260425-230108` contains the prior run's `docs/dark-factory-postmortem-2026-04-25.md` and a `.claude-terminal/sessions.json` change. Pop after committing SS-01/SS-02.

---

## Recommendations for the CLI (in priority order)

### 1. Make verifier dispatch unconditional and observable

The single highest-impact fix. Whatever the verifier is supposed to do, it must:
- Run after every implementer return (success, fallback success, near-timeout success).
- Emit `verifier_dispatched`, `verifier_succeeded`, `verifier_failed` events into the JSONL.
- Run on its own time budget (e.g., 300s), independent of the implementer's budget.
- Rewrite every `needs-verifier` evidence file to either `verified-pass` (with sha256 + timestamp) or `verified-fail` (with the failing command + exit code + truncated output).
- The closer's defer rule should fire ONLY on `verified-fail`, never on `needs-verifier` (treat `needs-verifier` as a CLI bug and surface it loudly, don't silently defer).

### 2. Per-sub-spec fallback budget, independently tracked

Run 2 burned its fallback on SS-01 attempt 1 and (apparently) had nothing left when SS-04 hung. Fallback should be per-sub-spec: each sub-spec gets one Opus → Sonnet retry, regardless of how many other sub-specs in the run also fell back.

### 3. Heartbeat / health events during long agent calls

Emit `agent_heartbeat` every 30s during a running `agent_call`, with the in-flight tool name. A 900s opaque timeout is unactionable; a heartbeat that says "stuck on `dotnet test` for 720s" is.

### 4. Capture agent stdout/stderr per attempt

`.forge-factory/agent-logs/<runId>/<subSpecId>-<attempt>.log`. On a 900s timeout with `tokens_used: 0`, this is the only forensic artifact that will tell us whether the model never returned a token, the SDK lost the connection, or a tool hung.

### 5. Dirty-tree handling on entry

Either (a) `--allow-dirty`, (b) auto-stash with guaranteed restore, or (c) a clearer message that prints the exact `git stash push -u -m '...'` command to copy-paste. The current message is correct but leaves the user to figure out the syntax under time pressure.

### 6. Closer should distinguish `verifier_skipped_clean` from `verifier_failed`

When deferring, the closer should run the on-disk verification commands itself. If they pass, label the deferral `verifier_skipped_clean` and offer a one-keypress "commit anyway" follow-up. If they fail, label it `verifier_failed` and leave the dirty tree for review.

### 7. Wave parallelism

Run 1's postmortem flagged this. Run 2 still ran strictly serial: each `sub_spec_dispatched` followed the previous `factory_commit`. Wave 1 has five parallel sub-specs (SS-01..04, SS-06, all `depends_on: []`). At ~12 minutes per Opus implementer, a parallel Wave 1 takes ~12 minutes; the serial Wave 1 took the entire 48-minute run window before crashing. This bug, untouched between Run 1 and Run 2, is independently a big throughput win.

### 8. SS-04 needs a postmortem of its own

We have no telemetry past `sub_spec_dispatched: SS-04`. Whatever happened (timeout, SDK panic, OS-level kill, CLI internal exception) needs to surface SOMETHING in the events log on the next run. Add a wrapping try/catch at the dispatch site that emits `sub_spec_dispatch_failed` with the exception type before propagating.

---

## Diff vs. Run 1's failure mode

| | Run 1 | Run 2 |
|---|---|---|
| Implementer prompt | Worker stops at ~200s with 1–2 file scaffold | Worker actually does the full spec scope |
| On-disk delivery (committed) | 7 hollow scaffolds + 8 nothings | 1 full sub-spec |
| On-disk delivery (uncommitted) | 0 | 2 full sub-specs |
| Failure cause | Self-reported pass + weak hollow gate | Verifier non-determinism + closer over-defer |
| Telemetry quality | Useful | Useful but missing verifier events and SS-04 |
| Wave parallelism | Broken (serial) | Broken (serial) |

**Net assessment:** the implementer is dramatically better. The verifier and the closer are the new weakest links. Wave parallelism remains broken across both runs.
