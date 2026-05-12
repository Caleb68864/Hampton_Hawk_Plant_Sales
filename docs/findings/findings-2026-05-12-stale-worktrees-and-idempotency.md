# Findings: Stale Worktrees, Idempotency Gate, and Fresh-Worktree Setup

**Date:** 2026-05-12
**Repo:** Hampton_Hawk_Plant_Sales
**Spec under test:** `docs/specs/2026-05-07-camera-scanner-foundation.md`
**Forge plugin:** `C:\Users\CalebBennett\Documents\GitHub\logic-tool-plugins\forge` (CLI at `forge-factory/dist/cli.cjs`)
**Context:** All five sub-specs of the camera-scanner foundation had already shipped to `main` (commits `b7cd433` + `e447dff`). The operator pointed the dark-factory at the spec anyway and the factory failed to recognise this — surfacing a chain of environmental and design issues worth capturing.

## TL;DR for future users

If `/forge:forge-dark-factory` keeps deferring SS-01 with `npm ls @zxing/...` (or any `npm ls`/dependency-style check) failing in a fresh worktree, the cause is **not** the spec or the dependencies. It is the factory's fresh-worktree-per-run model leaving `node_modules` empty while the idempotency-proof gate prevents the worker from running `npm install`. Workarounds at the bottom of this doc.

---

## F-1: Stale-worktree registration blocks branch reuse

### Symptom

CLI exits non-zero almost immediately with:

```
handleRun: [forge-factory] preflight: cannot reuse branch <name> — already checked out at C:/Users/CalebBennett/.claude/forge/worktrees/<old-id>.
Remove that worktree first:
  git worktree remove --force "C:/Users/CalebBennett/.claude/forge/worktrees/<old-id>"
```

### Root cause

Two failure paths converged:

1. **Old plugin location had registered worktrees that no longer exist on disk.** The directory `C:\Users\CalebBennett\.claude\forge\worktrees\` no longer existed but `git worktree list` still showed entries because git's worktree registry is in `.git/worktrees/`, not on the filesystem where the working tree was. Git refuses to reuse a branch that any registry entry — even one pointing to a missing directory — claims.
2. **Current plugin location preserves worktrees on failure.** When a run exits non-zero, the CLI logs `worktree forge/<id> preserved` and leaves the worktree intact for inspection. The next invocation of `/forge:forge-dark-factory` then re-encounters the same branch already checked out and refuses.

### What works

```bash
# For stale registry entries (working dir gone):
git worktree prune

# For preserved worktrees from a prior failed run (working dir still there):
git worktree list                                   # find the offending worktree
git -C <worktree-path> status --short               # check for uncommitted work
git -C <worktree-path> log --oneline <main>..HEAD   # check for unpushed commits
git worktree remove --force "<worktree-path>"
```

`git worktree remove` only removes the working-directory checkout — the branch itself is preserved in the bare repo so any factory commits the worker already made are intact. The next factory run will fork a new worktree off that branch.

### What doesn't work

- Re-running the CLI hoping it will recover. It won't; preflight is the very first step.
- `git branch -D <branch>` while the worktree still exists — git refuses with `branch is used by worktree at <path>`. You must remove the worktree first.

### Recommendation for plugin

The CLI already prints the exact remediation command in its error. That message is good. A small improvement: a `--force-preflight-cleanup` flag (or auto-prune when the worktree directory is missing on disk, distinct from "directory exists with content").

---

## F-2: Idempotency-proof gate skips worker but check phase still runs

### Symptom

SS-01 result is `deferred_manual` with `reason=checks-failed: cd web && npm ls @zxing/... [real_failure]` even though `package.json` correctly declares the dependencies and the worker's expected files all exist on the branch.

Diagnostic log line:

```
[forge-factory] gate=idempotency-proof SS-01 → all 4 expected file(s) in action-correct state + check passed; skipping worker dispatch
...
[forge-factory] checks SS-01 → ✗ cd web && npm ls @zxing/browser @zxing/library (fail, exit=1)
```

### Root cause

Two execution stages run in sequence and don't share assumptions:

1. **`idempotency-proof` gate** checks whether the sub-spec's expected files already exist on the branch with the right shape (file presence + a structural grep). If yes, it skips the worker dispatch entirely.
2. **`checks` phase** runs the sub-spec's `[MECHANICAL]` acceptance criteria against the current working tree.

When the worker is skipped, `npm install` is also skipped. But the checks include `npm ls` which requires `node_modules`. The worktree was freshly created; `node_modules` is empty; the check fails; SS-01 defers.

The idempotency gate is implicitly assuming "files in git == environment is set up", which is false for any project that has a separate install step (`npm install`, `pip install`, `cargo fetch`, `nuget restore`, `dotnet restore`, etc.).

### What works (operator workarounds)

In rough order of effort:

1. **Pre-install in the preserved worktree, then accept the run is over.** After a failed run, do `cd <preserved-worktree>/web && npm install` and use the worktree directly for any further inspection — but the next factory run will still fork a fresh worktree without `node_modules`.
2. **Symlink `node_modules` from main into the worktree.** Brittle on Windows without admin rights; only useful if you'll do many runs.
3. **Restructure the spec's acceptance criteria so the check is structural, not mechanical.** Replace `[MECHANICAL] cd web && npm ls @zxing/browser` with `[STRUCTURAL] web/package.json lists @zxing/browser under "dependencies"`. The checker treats STRUCTURAL as a file-grep instead of a shell command, so an empty `node_modules` doesn't break it. We did this for SS-01 during this session (see `2026-05-07-camera-scanner-foundation.md` line ~101).
4. **Just don't run the factory on already-merged work.** If the work has already shipped, run `/forge-verify` instead (see `docs/factory/verification-2026-05-12-camera-scanner-foundation.md` for a worked example).

### What doesn't work

- Re-running with the same spec. Same outcome every time; this is deterministic.
- `--resume <runId>` on the `run` subcommand. **The `run` subcommand has no `--resume` flag.** Attempting `node cli.cjs run --resume <id>` produces `error: missing required argument 'design'`. The only `--resume` form is the top-level `node cli.cjs --resume --factory-dir <dir>` which is specific to the red-team user-input gate, not general runs. The skill description's mention of a general `--resume <runId>` is inaccurate as of plugin version checked 2026-05-12.

### Recommendation for plugin

Three options, increasing in ambition:

1. **Document the fresh-worktree setup expectation.** Add a section to the dark-factory skill telling operators that runtime dependencies (`npm install`, etc.) are their responsibility for fresh worktrees, with a one-line workaround per stack.
2. **Add a `setup_command` to `forge-project.json`** that the CLI invokes immediately after creating a worktree (before any gate or worker). Example:
   ```json
   "setup_command": "cd web && npm install --no-audit --no-fund"
   ```
   Trivial change, removes the entire failure mode.
3. **Teach the idempotency-proof gate to fall through to the worker if a `[MECHANICAL]` check would fail on a fresh checkout.** More work but the right long-term answer — the gate's contract should be "skip iff the worker would be a no-op", not just "skip iff files exist".

---

## F-3: Haiku check-extractor truncation produces malformed grep chains

### Symptom

`checks` phase reports a `real_failure` with a command suffix that looks half-typed:

```
[forge-factory] checks SS-01 → ✗ cd web && npm ls @zxing/browser @zxing/library | grep -q '@zxing/browser' && gre (fail, exit=1)
```

Note `&& gre` — that is not a typo in the log; the actual executed command was truncated/malformed by the haiku-extracted check.

### Root cause

The `checks` phase uses a haiku model to translate human-readable `[MECHANICAL]` acceptance criteria into shell commands. When the source criterion is prose-heavy (e.g. `[MECHANICAL] cd web && npm install completes with @zxing/browser and @zxing/library listed in dependencies (not devDependencies).`) haiku attempts to compose a multi-pipe check and either truncates mid-token or produces an invalid second `grep` with no input. The downstream classifier then treats this as `real_failure` because the exit was non-zero — even though the failure was the check command itself, not the implementation.

### What works

Write acceptance criteria as **literal, copy-pasteable shell commands** wherever possible. Haiku-friendly form:

```
- `[MECHANICAL]` `cd web && npm ls @zxing/browser @zxing/library` exits 0.
```

Anti-pattern (avoid):

```
- `[MECHANICAL]` `cd web && npm install` completes with `@zxing/browser` and `@zxing/library` listed in `dependencies` (not `devDependencies`).
```

The prose in the second form forces haiku to invent a verification command; the first form is unambiguous.

Inline `node -e "..."` is also a poor choice — see F-4.

### Recommendation for plugin

Document the haiku-extractor contract in the dark-factory skill or in a spec-authoring guide: `[MECHANICAL]` checks should be self-contained shell commands, not prose that implies a command.

---

## F-4: Env preflight tokenises inline JavaScript as binary names

### Symptom

`env` gate halts SS-01 with critical findings like:

```
[forge-factory] env SS-01 → critical: const not on PATH.
[forge-factory] env SS-01 → critical: {} not on PATH.
[forge-factory] env SS-01 → critical: process.exit((d['@zxing/browser'] not on PATH.
```

These appear after the operator added an inline `node -e "..."` check to the spec to work around F-3.

### Root cause

The env-preflight gate appears to whitespace-tokenise mechanical check commands and PATH-resolve each token. Inline JavaScript code fragments like `const`, `{}`, `process.exit(...)` are each treated as candidate executables, fail the PATH lookup, and produce CRITICAL findings.

### What works

Don't use inline `node -e "..."` (or `python -c "..."`, `bash -c "..."`) in `[MECHANICAL]` checks. Either:

1. Write a tiny standalone script under the repo (e.g. `scripts/check-zxing-deps.mjs`) and reference it: `[MECHANICAL] cd web && node scripts/check-zxing-deps.mjs`.
2. Demote to `[STRUCTURAL]` and let the verifier grep the file directly.

### Recommendation for plugin

The env-preflight tokeniser should respect quoted arguments — `node -e "const x = ..."` is one shell argument, not five binary names. A more robust implementation: only PATH-resolve the first token of each `&&`-separated clause.

---

## F-5: Spec auto-patcher modifies the user's spec mid-run

### Symptom

After a run, the spec file at `docs/specs/2026-05-07-camera-scanner-foundation.md` has been changed in-place. A `.audit-backup-<timestamp>` sibling is left next to it.

Log line:

```
[forge-factory] spec-audit → auto-patched [advisory/missing-dependency] SS-04 depends_on omits SS-02
[forge-factory] spec-audit → backed up original to <path>.audit-backup-<timestamp> before patching
[forge-factory] spec-audit → wrote 2 patch(es) to <path>
```

### Behaviour observed

During this session the auto-patcher made three classes of edits across runs:

1. Added a missing REQ-001 acceptance line to SS-01.
2. Added `SS-02` to SS-04's `depends_on` list.
3. Concretised vague-criterion language (e.g. timing values).

The CLI prints a `git diff --no-index` command for review but does not require operator approval before patching. In one run, a 429 rate-limit error on the sonnet-resolver left 3-4 findings unresolved while the patcher still proceeded with the resolvable ones.

### Recommendation for operators

After any factory run, even a failed one:

```bash
ls docs/specs/*.audit-backup-*
```

If backups exist, review what changed and either keep the patch or restore the backup. The patches were sensible in this session but the auto-patch policy is opaque from the operator's side.

### Recommendation for plugin

Either (a) require explicit `--allow-spec-patching` to enable in-place edits, or (b) write patches to a sibling `<spec>.proposed.md` and surface them as a user-input gate the same way redteam findings are gated. The current behaviour quietly mutates spec source-of-truth.

---

## F-6: Factory cannot detect "already done" work

### Symptom

Repeated runs against a spec whose work has already been merged to `main` produce `deferred_manual` rather than `PASS`. The factory creates a fresh worktree off `main`, sees all expected files exist (`new-target-already-exists` flagged 8 times in path-validation), the idempotency-proof gate skips the worker, and then the mechanical check fails for environmental reasons (F-2) — looking like a failure when in fact the work is complete.

In this session the dark-factory was pointed at a spec where commits `b7cd433` and `e447dff` on `main` already satisfied every requirement. The factory still failed.

### Root cause

Path-validation surfaces "new-target-already-exists" as **advisory** rather than escalating it. There is no "the entire spec is already implemented" detection — only per-file detection. When all `Files (new):` paths exist and all `Files (modify):` paths contain the expected content, the right answer is "PASS, nothing to do" not "defer because checks failed."

### Recommendation for plugin

Promote "all expected files exist and all idempotency-proof checks pass for every sub-spec before dispatch" to a top-level `[forge-factory] already-implemented` early-exit that reports PASS and runs the verifier directly, skipping the dispatch chain entirely.

---

## F-7: Operator-side checklist before invoking `/forge:forge-dark-factory`

Distilled from this session. Run these before re-pointing the factory at any non-trivial spec:

1. **Check if the work already exists.** `grep` for the spec's key new filenames in the repo. If every expected `Files (new):` path is already present, run `/forge-verify` instead of `/forge:forge-dark-factory`.
2. **Check for stale worktrees.** `git worktree list` — if there are entries under `.claude/forge/worktrees/` or `.forge/.../worktrees/` from prior runs, inspect each for uncommitted work, then `git worktree remove --force <path>`. Run `git worktree prune` to clear any registry-only ghosts.
3. **Check for an existing factory branch on the same spec.** `git branch | grep -i <slug>`. If the branch exists from a prior run, decide whether to reuse (rare, only if the factory commits there are still useful) or delete (`git branch -D <branch>` after removing any worktree pointing at it).
4. **Check `forge-project.json`.** Confirm `build_command` and `test_command` match the project's current scripts. There is no `setup_command` field yet (see F-2 recommendation); the operator is responsible for ensuring fresh worktrees can run the project's verification commands.
5. **Read the spec's acceptance criteria.** Anywhere a `[MECHANICAL]` check is written as prose ("must complete with X listed in Y") rather than as a literal shell command, rewrite it to a literal command or demote it to `[STRUCTURAL]` (see F-3, F-4).
6. **Back up the spec file** if you don't want the auto-patcher rewriting it (see F-5). `cp <spec>.md <spec>.md.pre-factory` so you can compare after.

---

## F-8: Working operator-side fix — scoped `post-checkout` git hook

### What unblocked the run

After the failure modes above, the run that finally completed (`runId 0b227fc6-5ee7-4a9e-b739-6e61bb3b5bac`, exit 0, 9/9 sub-specs pass, auto-merged to main) was unblocked by installing a single scoped `post-checkout` git hook at `.git/hooks/post-checkout`:

```sh
#!/bin/sh
# Fire only on branch checkouts and only inside forge worktree paths
[ "$3" = "1" ] || exit 0
case "$PWD" in
  */forge/worktrees/*|*/.forge/*/worktrees/*) ;;
  *) exit 0 ;;
esac
[ -f web/package.json ] || exit 0
echo "[post-checkout] forge worktree detected, installing web/ deps"
cd web && npm install --no-audit --no-fund --silent 2>&1 | tail -3
```

Worktree-shared `.git/hooks/` means this fires automatically when `git worktree add` creates a new working dir for the factory. The path-scoping case statement is essential — without it, every `git checkout` in main would re-run `npm install`.

This hook was removed at the end of this session (it was a one-shot workaround, not a permanent fixture). If a future user wants to make it permanent, drop it back in and `chmod +x`.

### Run results with the hook

```
[forge-factory] dispatch SS-01 → idempotency:all-files-present (2 files) already confirmed action-correct
[forge-factory] result SS-01 → complete (took 9s)
[forge-factory] result SS-02 → complete (took 19s)
[forge-factory] result SS-03 → complete (took 11m1s)   # built useBarcodeScanner.test.tsx (was missing per verification report)
[forge-factory] result SS-04 → complete (took 1m12s)
[forge-factory] result SS-05 → complete (took 4m12s)   # built MobileScannerDemoPage.test.tsx (was missing per verification report)
[forge-factory] result PHASE-CLOSER → complete (6m4s)
[forge-factory] result PHASE-COMPLETENESS → complete (54s)
[forge-factory] result PHASE-GOLDEN-PRINCIPLES → complete (2s)
[forge-factory] result PHASE-OUTCOMES → complete (4m9s)
[forge-factory] run ... → complete (exit 0): 9/9 complete, 0 deferred, 0 failed
[forge-factory] gate=auto-merge 2026/05/12-1322-caleb-feat-camera-scanner-foundation → main ✓
```

Total run time: ~32 minutes. Total post-merge commits on main: 6 (one per sub-spec trailer/work + the merge commit). The two test files the verification report flagged as missing (`useBarcodeScanner.test.tsx`, `MobileScannerDemoPage.test.tsx`) were authored by the SS-03 and SS-05 workers; both now pass — 10 new tests, all green.

### F-8 surprise: auto-merge fires without operator confirmation

Once all sub-specs and phase reviewers pass, the CLI runs `gate=auto-merge` which (a) merges the feature branch into the base branch (default `main`) and (b) deletes the worktree + feature branch. There was no prompt and no opt-out flag passed; default behaviour is to merge.

For solo work on a private repo this is acceptable. For team work or shared `main`, it is not. The skill mentions `config.auto_pr !== false` controlling PR-vs-direct-merge, but the actual switch lives in the dark-factory CLI and the default is "merge".

**Recommendation for operators:** before invoking `/forge:forge-dark-factory` on a shared repo, confirm what `gate=auto-merge` will do (search the CLI's output of a prior run, or invoke with `--help` if a flag is documented). For Hampton Hawks this session it was the desired outcome; for production-critical repos this needs an opt-in flag.

**Recommendation for plugin:** make auto-merge opt-in (a `--auto-merge` flag) rather than opt-out, or at minimum require an interactive y/n at the gate boundary the same way the redteam gate requires `user-input-response.json`.

---

## Summary: what works, what doesn't

**What works (with the F-8 hook installed):**
- Re-running the factory against an already-merged spec — the strong-idempotency gate correctly classifies existing files and the workers fill in any gaps the prior implementation missed (in this session: two missing test files).
- Mechanical checks: `npm ls`, `npm run build`, `npx vitest run` all succeed because `node_modules` is populated by the hook.
- Auto-merge to main if and only if all 9 stages pass.

**What still needs a plugin-side fix:**
- F-2 (idempotency-proof gate skipping `npm install`) — should be a `setup_command` in `forge-project.json` per the recommendation above, not a custom git hook.
- F-3 (haiku-extracted commands truncating) — needs a documented "write `[MECHANICAL]` as a literal command" convention.
- F-4 (env preflight tokenising inline JS as binaries) — preflight should respect quoting.
- F-5 (silent spec patching) — should be a user-input gate, not silent.
- F-8 (auto-merge default) — should be opt-in for shared repos.

**One-line for the next operator who hits this:** if the dark-factory keeps deferring on a Node project, drop a scoped `post-checkout` hook (see F-8 above) and re-run — it gets `node_modules` into every fresh worktree the CLI creates.
