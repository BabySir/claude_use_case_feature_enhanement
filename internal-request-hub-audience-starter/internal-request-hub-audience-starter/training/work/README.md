# Feature work convention

**State:** Accepted with `constitution.md` revision 2 (31 Oct 2026, Sagar Sharma). This describes the spec-driven workflow in [`constitution.md`](../../constitution.md), rules W1–W7.

`training/work/` is the single home for all feature work in this repository. There is no separate `specs/` folder. Each feature gets its own folder here, `training/work/<feature-name>/`, holding three artifacts.

**Folder name:** a short kebab-case name. For a GitHub issue, it is taken from the issue's title, without the "Feature:" prefix. For example, issue #2 "Approve or reject an assigned request" becomes `training/work/approve-or-reject/`. A feature without an issue takes its name from the intent's title.

**Current feature folders:**
- `add-comment/`: request comments. Written before this convention, so it doesn't fully conform.
- `approve-or-reject/`: approval/rejection.

## The three artifacts

They are created in strict order:

| Order | Artifact | What it records | Drafted / owned by | Approved by |
|---|---|---|---|---|
| 1 | `intent.md` | Problem, desired outcome, scope | Originator | Product owner |
| 2 | `spec.md` | Behavior (acceptance examples), design, constraints | Engineer | Technical lead |
| 3 | `plan.md` | Ordered implementation checkpoints, Acceptance-to-evidence map, risks | Engineer | Technical reviewer |

Each artifact names its owner and approver at the top. It records the actual decision, the approver and the date in its **Approval record** section.

## Templates

Start every artifact from the canonical blank templates in **`training/work/_templates/`**: `intent.md`, `spec.md` and `plan.md`. Copy one into the feature folder and fill it in. Don't edit the template itself.

That folder also has `review.md`, for recording a diff review with its verification evidence and findings, and `release.md`, for a local release check.

The old `training/inputs/templates/` location is retired. Use only `training/work/_templates/`.

## The gate rule

Draft an artifact only after the previous one in **the same folder** has been explicitly approved by its named approver:

1. `intent.md` is accepted by the product owner. Only then is `spec.md` drafted.
2. `spec.md` is accepted by the technical lead. Only then is `plan.md` drafted.
3. `plan.md` is accepted by the technical reviewer. Only then does implementation start.

Never assume, invent or backfill an approval. An agent records an approval only when a named person actually gave it. If an artifact doesn't record a decision, the decision hasn't been made.

## Optional entry points

- **From a GitHub issue:** the originator may run the `draft-intent-from-issue` skill to fetch the issue and draft `intent.md`.
  - The result is always a **draft**, with its decision pending for the product owner.
  - The issue's number and URL are recorded as the intent's source.
- **Drafting the plan:** once `spec.md` is accepted, the engineer may draft `plan.md` with the forthcoming `plan-feature` skill instead of by hand. The output and approval requirement are the same either way.

How to invoke the skills and the review tools is documented in `CLAUDE.md`.

## Diff, review and the feedback loop

After `plan.md` is approved:

1. **Implement.** Work through `plan.md`'s checkpoints, producing a diff. Run `npm test`, `npm run lint` and `npm run build` after each checkpoint, and report the real results.
2. **Review the diff.** Every diff gets:
   - an **authorization review**, using the `authorization-reviewer` agent
   - a **verification check** against `plan.md`'s Acceptance-to-evidence map, using the `verify-checkpoint` skill

   `/code-review` and `/security-review` are available for concerns outside the authorization boundary.
3. **Route findings back, not forward.**

   | Finding | Goes back to |
   |---|---|
   | Defect in the implementation | The diff: fix it there |
   | Unsuitable approach | `plan.md`: revise and re-approve |
   | Unclear or unsuitable behavior | `spec.md`: clarify and re-approve |

   Log each finding (date, source review, what changed) under **"Findings routed back here"** in the artifact it returned to. Implementation defects are fixed in the diff and recorded in the feature's `review.md` (from the `review.md` template), so every finding's routing is written down.

The saved artifacts are what carry decisions between sessions. Read them, rather than relying on earlier chat history.
