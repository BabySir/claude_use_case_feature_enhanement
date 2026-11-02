---
name: verify-checkpoint
description: Verify a change folder's implementation against its plan.md. Runs npm test, lint and build for real, runs the authorization-reviewer agent on the current diff, checks that every acceptance example in the Acceptance-to-evidence map has existing evidence, and ends with a summary table plus a pass/fail recommendation. Reports only; edits nothing.
argument-hint: <change-folder>
disable-model-invocation: true
---

# Verify checkpoint

Change folder: `$ARGUMENTS` (a path relative to the repository root, e.g. `training/work/approve-or-reject`)

## Hard limits

- **Report only.** Do not edit, create or delete any file. That covers application code, tests, docs, config, and the change folder's own `intent.md`, `spec.md` and `plan.md`. Don't update approval records or "Findings routed back here".
- **Never claim what you didn't check.** Every status comes from a command you ran or a file you read in this run. If a check couldn't run, or you didn't do it, its status is `NOT RUN` or `UNVERIFIED` with the reason. Never write `PASS` for it.
- Don't fix failures. Report them with the real output.

## Steps

### 1. Check the argument and read the plan

- If `$ARGUMENTS` is empty, stop and ask for a change folder. Usage: `/verify-checkpoint <change-folder>`.
- Read `$ARGUMENTS/plan.md`. If it doesn't exist, stop and say so.
- Note its `State` and approval `Decision`. If the plan isn't accepted, say so prominently, then continue: verification is still useful.
- Parse the **Acceptance-to-evidence map** table. For each row, keep:
  - the acceptance example ID
  - the checkpoint(s)
  - the evidence text
- Also read `$ARGUMENTS/spec.md`, if present, and list every acceptance example ID it defines. Any ID in the spec but missing from the map is a gap.

### 2. Run the project checks, for real

Run each command from the repository root, one at a time, and capture its exit code and output:

1. `npm test`
2. `npm run lint`
3. `npm run build`

For each one, record:

- PASS or FAIL, from the **exit code**
- for tests: the pass/fail counts as printed (server `ℹ tests / pass / fail`, client `Tests N passed`)
- on failure: the failing test names or error lines, quoted verbatim

Don't stop after a failure. Run all three, so the report is complete.

Note: `npm run build` overwrites `client/dist`. That's a build output, not application code, and is expected.

### 3. Run the authorization review on the current diff

Work out the current diff:

- If the folder is a git repository (`git rev-parse --is-inside-work-tree` succeeds), use `git diff HEAD` plus untracked files (`git status --porcelain`).
- If it isn't, there is no diff to compute. Use the list of files that `plan.md`'s **Ordered checkpoints** say they change or add, and keep only the ones that exist. Say clearly in the report that **the diff was approximated from plan.md**, and that changes outside those files weren't reviewed.

Run the `authorization-reviewer` agent with the Agent tool, `subagent_type: "authorization-reviewer"`. In the prompt, give it:

- the diff, or the changed file list from above
- the change folder's name
- a one-line description of the change, from plan.md's title

Include its findings **as returned**: severity, location, rule and failure scenario. Don't drop, soften or reinterpret them.

If the agent isn't available or fails, record the authorization review as `NOT RUN` with the error. Don't do the review yourself in its place.

### 4. Check the evidence for every acceptance example

Go through each row of the map and classify its evidence. Check that the evidence **exists**: read or grep for it. Don't assume it.

- **Automated test.** The row names a test, a test file, or an ID that should appear in a test name.
  - Search the test files (`server/test/**`, `client/src/**/*.test.jsx`) for a test whose name contains the acceptance ID. Alternatively, match the specific behavior the row describes in an existing test body.
  - Record the file and test name you found.
  - Then use step 2's output to say whether that test ran and passed. The test name must appear in the passing output, or its file must have passed as a whole, with no failures in it.
  - Status:
    - `EVIDENCED`: the test was found and passed.
    - `FAILING`: the test was found but failed, or its file failed.
    - `MISSING`: no matching test was found.
- **Manual observation.** The row says "manual", "walkthrough" or similar.
  - This skill can't watch a person use the UI.
  - Status is `MANUAL — UNVERIFIED`, unless a written record of that observation exists in the change folder or the repository. Look for one. If you find one, cite it and use `MANUAL — RECORDED (<where>)`.
- **Mixed rows** (automated plus manual): give each part its own status. The row is only `EVIDENCED` if every automated part is.

Also flag:

- any spec acceptance ID with no row in the map: `NOT MAPPED`
- any map row whose checkpoint number doesn't exist in **Ordered checkpoints**

### 5. Report

End with **exactly one** summary table, then the recommendation.

**Summary table:**

| Check | Status | Evidence |
|---|---|---|
| `npm test` | PASS / FAIL / NOT RUN | counts, plus failing names if any |
| `npm run lint` | PASS / FAIL / NOT RUN | first error lines if any |
| `npm run build` | PASS / FAIL / NOT RUN | error lines if any |
| Authorization review | NO FINDINGS / FINDINGS (n blocker, n major, n minor) / NOT RUN | how the diff was obtained |
| `<each acceptance ID>` | EVIDENCED / FAILING / MISSING / MANUAL — UNVERIFIED / MANUAL — RECORDED / NOT MAPPED | file and test name, or the reason |

Put the authorization findings in full **above** the table, under a heading "Authorization findings". Put any failure output above the table too, under "Failures".

**Recommendation**, on one line, then at most three short lines of reasons:

- **`PASS — ready for engineer review`** only if all of these hold:
  - test, lint and build all passed
  - the authorization review ran with no `blocker` or `major` findings
  - every automated acceptance row is `EVIDENCED`
  - no row is `MISSING`, `FAILING` or `NOT MAPPED`
  - `MANUAL — UNVERIFIED` rows don't block PASS, but list them as "needs a human to observe".
- **`FAIL — not ready for engineer review`** otherwise. Name the specific blocking items.

This is a recommendation to the engineer reviewer, not an approval. Don't mark the plan, spec or anything else as verified or accepted.
