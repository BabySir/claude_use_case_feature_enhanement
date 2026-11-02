# Spec-driven SDLC with Claude Code: step-by-step procedure

**Who this is for:** anyone, including non-technical people, who wants to take a feature from a GitHub issue to finished, reviewed code using Claude Code, without writing code themselves.

**How to use it:** work top to bottom. Every grey box is a prompt you can copy and paste into Claude Code exactly as written. Text in `<angle brackets>` is a placeholder; replace it, including the brackets. After each step, check the **"What you should see"** notes before moving on.

**Where this came from:** this is the exact sequence used in the 31 Oct 2026 session that set up this repository and delivered two features: request comments (issue #5) and approve/reject (issue #2). Prompts are copied from that session, with only small typo fixes. Wherever the session later changed a decision, such as where feature folders live, the step says which version to use today.

---

## The idea in one minute

Every feature moves through four written documents, each approved by a named person before the next one starts:

| Step | Document | What it says | Who writes it | Who approves it |
|---|---|---|---|---|
| 1 | `intent.md` | What problem, for whom, and what's in or out of scope | Originator (often drafted from a GitHub issue) | Product owner |
| 2 | `spec.md` | Exact behavior, as numbered examples, plus the design | Engineer | Technical lead |
| 3 | `plan.md` | Ordered build steps, and how each example will be proven | Engineer | Technical reviewer |
| 4 | `review.md` | What was actually checked, and the reviewer's decision | Engineer | Technical reviewer |

Three ground rules make this safe:

- **Claude never approves anything.** It only writes down an approval when you say it, for example "accept spec.md".
- **Nothing moves forward without approval.** Claude won't draft the next document until the previous one is accepted.
- **Problems go backwards.** A bug goes back to the code, a bad approach goes back to `plan.md`, and unclear behavior goes back to `spec.md`.

The full rules are in `constitution.md` at the repository root. Folder conventions are in `training/work/README.md`.

---

## Before you start

- [ ] Claude Code is installed and open in this repository's folder.
- [ ] Node.js 22.13 or later and npm 10 or later are installed. Check with `node -v` and `npm -v`.
- [ ] The GitHub CLI is installed and signed in. Check by typing `! gh auth status` in Claude Code. If it isn't signed in, type `! gh auth login` and follow the prompts.
- [ ] You know the GitHub repository your issues live in. Here that's `mjinto/internal-request-hub`.

> **Tip:** a line starting with `!` runs a terminal command inside Claude Code. A line starting with `/` runs a skill, which is a saved procedure.

---

# Part 1: One-time setup

You only do this once per repository. If `constitution.md`, `docs/domain.md`, `docs/architecture.md`, `.claude/skills/` and `.claude/agents/` already exist, **skip to Part 2**.

### Step 1.1: Learn how to run the project

```text
how can I run the project
```

**What you should see:** install and run commands, and the local web address (here, http://localhost:5173).

### Step 1.2: Install dependencies

```text
npm ci
```

**What you should see:** "added N packages". Warnings about audits or deprecations are normal.

### Step 1.3: Create the project guide for Claude (CLAUDE.md)

```text
/init
```

(In the session this was asked as just `claude.md`, which Claude handled by running `/init`.)

**What you should see:** a new `CLAUDE.md` with the commands and a short architecture summary.

### Step 1.4: Write the business guide (docs/domain.md)

```text
Inspect the current application code, schema, seed data and tests, but
write for a product-owner audience, not an engineer. Propose a domain
guide describing the problem this application solves and the business
area it covers, based on implemented behavior only, not desired features.
Cover: the purpose of the app, roles and simulated identity, entities and
their meaning in plain business terms, request visibility rules, status
values and what currently happens at each one, access/error cases in
plain language (not HTTP codes), and workflows that are not yet
implemented.
Write every rule as a plain statement of behavior - do not cite files,
functions, or line numbers in the body. Label each statement as
Confirmed, Inference, or Open question so a non-technical reviewer knows
which claims are solid and which need a decision. Do not invent business
rules, and do not treat a database status value as proof that a
status-transition workflow exists.
Do not implement features or edit application code.
If docs/domain.md exists, propose changes for review without overwriting
it. Otherwise write a draft at docs/domain.md for review.
```

**What you should see:** `docs/domain.md`, with every statement labelled Confirmed, Inference or Open question.

### Step 1.5: Write the technical guide (docs/architecture.md)

```text
Inspect package.json, the client/server source, startup code, database code,
existing tests and CI configuration. Use the reviewed domain guide as
context, but verify architecture claims against the implementation.
Propose docs/architecture.md covering the stack, repository structure,
request flow from React through Express to SQLite, responsibility boundaries,
identity and access enforcement, database lifecycle, development versus
production serving, and actual verification commands.
Trace one request-list or request-detail call through the real files.
Cite file/function evidence for each claim. Label each claim as Confirmed,
Inference, or Open question, the same convention used in the domain guide,
so uncertainty and gaps are explicit rather than implied. A simple Mermaid
flow diagram is useful if it accurately describes the code.
Describe current architecture separately from recommendations.
Do not change application code, dependencies or deployment configuration.
If the document exists, propose edits for review rather than overwriting it.
```

### Step 1.6: Approve both guides

Read both documents first. When you're happy with them:

```text
accept domain.md and accept architecture.md
```

### Step 1.7: Create the "fetch a GitHub issue" skill

```text
Create .claude/skills/fetch-github-issue/SKILL.md as a manually-invoked
skill (disable-model-invocation: true). Given an issue reference as its
argument (a bare number for the current repo, owner/repo#number, or a
full GitHub issue URL), it should: confirm gh is installed and
authenticated (gh auth status), stop with the real error if not; fetch
the issue with gh issue view <reference> --json
number,title,state,url,labels,body; and report the number, title,
state, URL, labels and full body verbatim, not paraphrased. It must not
fetch comments, must not modify the issue in any way, and must not
write any file - this skill only reports. Create only this one file.
```

Then let a bare issue number default to your repository. In the session this was needed because the folder isn't a git repository:

```text
add --repo <owner>/<repo> when only a number is given
```

(The session used `add --repo mjinto/internal-request-hub when only a number is given`.)

> **Important:** after creating or changing a skill, **restart Claude Code** or start a new session before using it. Otherwise the old version of the skill is still loaded.

### Step 1.8: Create the "draft an intent from an issue" skill

```text
Create .claude/skills/draft-intent-from-issue/SKILL.md as a
manually-invoked skill (disable-model-invocation: true). It takes two
arguments - an issue reference and a change folder. It should: invoke
the fetch-github-issue skill with the issue reference and stop if that
fails; read training/work/_templates/intent.md plus CLAUDE.md,
docs/domain.md and docs/architecture.md for project context; create the
change folder if needed; and draft intent.md there using the template's
sections - problem and desired outcome from the issue, scope and
constraints cross-checked against the real repository, open questions
for anything the issue leaves ambiguous, and the acceptance decision
left pending for the product owner. Record the issue's number and URL
as intent.md's source. Propose changes instead of overwriting if
intent.md already exists. It must not draft spec.md or plan.md, and
must not edit application code. Create only this one file.
```

### Step 1.9: Create the authorization reviewer (a read-only checking agent)

```text
Create .claude/agents/authorization-reviewer.md as a custom subagent.
Its only job: audit a diff against this repo's authorization boundary -
identity resolved via getCurrentUser, explicit ownership/role/status
checks before any read beyond what's allowed or any mutation, denials
using the existing HttpError/errorResponse shape and codes, and
parameterized SQL only. Base the rule on CLAUDE.md, docs/domain.md and
docs/architecture.md section 5 - cite them in the agent's instructions,
don't invent new rules. Give it read-only tools (no Edit or Write) since
it reviews, it does not implement. Write its description so it is only
used when explicitly named, not inferred from a general "review my
code" request. Create only this one file.
```

### Step 1.10: Create the verification skill

```text
Create .claude/skills/verify-checkpoint/SKILL.md as a manually-invoked
skill (disable-model-invocation: true). Given a change folder as its
argument, it should: read that folder's plan.md Acceptance-to-evidence
map; run npm test, npm run lint and npm run build and report real
pass/fail, not an assumption; invoke the authorization-reviewer agent
on the current diff and include its findings; check that every
acceptance example in the map has real, existing evidence, flagging any
that don't; and end with one summary table plus a plain pass/fail
recommendation for engineer review. It must not edit application code
or mark anything verified that it did not actually check. Create only
this one file.
```

### Step 1.11: Write the team rules (constitution.md)

This is the final wording used in the session. It is "revision 2", which replaced an earlier draft.

```text
update constitution.md at the repository root for team review, and document
a lightweight spec-driven SDLC convention for how we develop every feature
in this repo going forward.

Use the newly reviewed docs/domain.md and docs/architecture.md as project
context. Separate existing facts from the rules the team agrees.

Include these proposed team rules in constitution.md:
Keep the existing JavaScript, React, Express and SQLite stack.
Keep HTTP handlers thin and database behavior in focused modules.
Use parameterized SQL and enforce access/state rules on the server.
Preserve the existing API error shape and visibility behavior.
Keep each change within its assigned exercise.
Map acceptance examples to verification, including denied actions.
Run tests, lint and build and inspect the diff before completion.
Record who reviews changes and exceptions; never invent approval.
Keep simulated identity; no real authentication, notifications or
  external services are part of this exercise.

Also document this spec-driven workflow as a team rule, in place of a
single "agree intent and specification" line:
Each feature gets its own folder under training/work/<feature-name>/,
  containing three artifacts in strict order: intent.md, then spec.md,
  then plan.md. training/work is the single home for all feature work in
  this repo; there is no separate specs/ folder.
intent.md records the problem, outcome and scope. The originator
  drafts it; the product owner accepts it. When the feature comes from a
  GitHub issue, the originator may use the draft-intent-from-issue
  skill to fetch the issue and produce a draft intent.md. Its output is
  always a draft: it must not mark the intent accepted, and the issue
  link must be recorded in intent.md as its source.
spec.md records behavior, design and constraints. The engineer drafts
  it; the technical lead approves it.
plan.md records implementation steps and checks. The engineer owns it;
  the technical reviewer accepts it. Once accepted, the engineer may
  draft plan.md with the forthcoming plan-feature skill instead of by
  hand - the output and approval requirement are identical either way.
An artifact for a phase is only drafted once the previous phase's
  artifact in that same folder has been explicitly approved by its named
  approver. Do not draft the next phase's artifact, and do not invent or
  assume an approval that was not actually given.
Once plan.md is approved, implementation proceeds to a diff, then a
  review of that diff. Every diff gets an authorization review and, once
  plan.md has an Acceptance-to-evidence map, a verification check against
  it, rather than an ad hoc read-through. State this requirement in
  constitution.md and name the tools once (the authorization-reviewer
  agent and the verify-checkpoint skill). Put invocation details
  (paths, when to run, arguments) in CLAUDE.md, not the constitution.
  /code-review and /security-review remain available for concerns
  outside the authorization boundary.
Review findings return to whichever earlier decision needs correction,
  not forward to a new artifact: a defect in the implementation returns
  to the diff for a fix; an unsuitable approach returns to plan.md for
  revision; unclear behavior returns to spec.md for clarification.
  Record which stage a finding was routed back to.
Record the actual approval decision and approver for each phase
  transition inside the artifact itself (or a short note beside it);
  never mark a phase approved on the agent's own authority.
These saved records are what carry decisions forward between sessions.
  Do not rely on replaying prior chat history to reconstruct a decision;
  read the artifact instead.
Write training/work/README.md describing this convention (the three
  artifacts, their owners/approvers, the gate rule, the optional
  draft-intent-from-issue entry point, and the diff/review feedback
  loop). Point it at the templates in training/work/_templates/ as the
  canonical starting point for intent.md, spec.md and plan.md —
  training/inputs/templates/ has been retired in favor of this single
  location.
Confirm training/work/_templates covers what the convention requires
  (named owner and approver per artifact, an approval record section
  with decision, approver and date, a source-issue field in intent.md,
  an Acceptance-to-evidence map in plan.md, a place to record which
  stage a review finding was routed back to). Keep the templates blank:
  no example approvals or filled-in names.
Add the CLAUDE.md pointers for the review tools and the
  draft-intent-from-issue skill as a proposed diff for review; do not
  rewrite unrelated parts of CLAUDE.md.

State plainly, under a short "Status" note, which features this repository
has implemented so far using this convention and which remain open.

Do not implement features or claim these rules already have technical
approval enforcement. Do not create a feature folder for any new feature.
Do not build or modify the draft-intent-from-issue skill in this step;
if it does not exist under .claude/skills/, report that as a gap.
Report any conflict with the current repository, without changing the
affected files.
```

Then approve it:

```text
accept constitution.md
```

### Step 1.12: Make CLAUDE.md load the rules and guides automatically

```text
Update CLAUDE.md to import @constitution.md at the repository root.
Keep verified commands and useful project context. Remove duplicated
rules now maintained in the constitution, preserving any relevant guidance
that is not duplicated. Import docs/domain.md and docs/architecture.md.
Only edit CLAUDE.md. Show the resulting diff.
```

Read the diff, then:

```text
accept CLAUDE.md
```

**Setup is complete.** Restart Claude Code once, so the new skills and agent are loaded.

---

# Part 2: Delivering a feature (repeat for every feature)

This is the procedure the approve/reject feature (issue #2) followed end to end. Replace:
- `<issue-number>` with the GitHub issue number, for example `2`
- `<feature-name>` with a short kebab-case name from the issue title, for example `approve-or-reject`
- `<your name>` with the person giving the approval

## Phase 1: Intent (product owner approves)

### Step 2.1: Read the issue (optional but useful)

```text
/fetch-github-issue <issue-number>
```

**What you should see:** the issue's number, title, state, URL, labels and full text, copied exactly. If you see "not a git repository", the skill is missing its repository default (see Step 1.7). Use the full issue URL instead.

### Step 2.2: Draft intent.md from the issue

```text
Using the spec-driven workflow in constitution.md and training/work/README.md,
run /draft-intent-from-issue <issue-number> training/work/<feature-name> to
produce a draft intent.md from https://github.com/<owner>/<repo>/issues/<issue-number>.

If intent.md already exists, propose changes instead of overwriting it.
Then STOP. I (product owner) must explicitly accept it before you draft
spec.md. Do not mark the Approval record as accepted on your own authority,
and do not edit application code.
```

Alternatively, type the skill directly: `/draft-intent-from-issue <issue-number> training/work/<feature-name>`.

**What you should see:** `training/work/<feature-name>/intent.md`, with:
- the issue recorded as its source
- the problem, outcome and scope
- a numbered list of **open questions**
- the decision **pending**

### Step 2.3: Answer questions and approve the intent

You can approve now and answer the open questions later, in the spec. Or answer some first. Example answers from the session:

```text
Reviewer role is needed
```

When ready:

```text
accept intent.md
```

## Phase 2: Spec (technical lead approves)

### Step 2.4: Draft spec.md, with Claude recommending answers to open questions

```text
draft spec.md with Q<first>-Q<last> response you can recommend
```

(The session used `draft spec.md with Q3-Q8 response you can recommend`.)

**What you should see:**
- `spec.md` with confirmed rules
- numbered acceptance examples, including **refusals**, meaning who is refused and what stays unchanged
- a design section
- a table of open questions with Claude's recommendation for each

### Step 2.5: Give your decisions on the questions

Answer by question number. Claude will ask you to clarify anything ambiguous before recording it. Example from the session:

```text
1. <name of engineer and technical lead>
3. stop the requester deciding their own request
4. Yes
5. No
6. ignore
7. it is needed for confirming the responsibility of the reviewer and approver
8. Cannot assign to inactive user
10. Not needed
```

If Claude raises new questions, answer them the same way, for example:

```text
11. Not recorded is okay
12. Opening, cancelling or commenting on a request you can't view keeps today's messages
```

### Step 2.6: Approve the spec

```text
accept spec.md
```

## Phase 3: Plan (technical reviewer approves)

### Step 2.7: Draft plan.md

```text
draft plan.md, technical reviewer is <your name>

Read the accepted training/work/<feature-name>/intent.md and spec.md,
along with CLAUDE.md, docs/domain.md and docs/architecture.md. Inspect
repository behavior and cite files. Using the
training/work/_templates/plan.md template, draft the smallest
implementation approach consistent with the accepted spec. Map every
acceptance example to a checkpoint and verification method. Flag risks
and open questions. Do not edit application code — stop once the plan
is written for review.
```

**What you should see:**
- ordered checkpoints, small build steps each ending with tests, lint and build
- an **Acceptance-to-evidence map** with every example, its checkpoint, and the test or check that proves it
- risks, and open questions with recommendations

### Step 2.8: (Optional) Let Claude fill in its recommendations

```text
please fill the open questions based on your recommendation
```

### Step 2.9: Approve the plan

```text
accept plan.md
```

## Phase 4: Build and review

### Step 2.10: Implement, one checkpoint at a time

```text
Implement training/work/<feature-name>/plan.md's accepted approach, one
ordered checkpoint at a time. Follow the plan exactly; if you find a
reason to deviate, stop and report it instead of silently changing the
approach. After each checkpoint, run npm test, npm run lint and npm run
build and report real results. Do not mark a checkpoint done without
running its verification.
```

**What you should see:** after each checkpoint, the real test counts and "exit 0" for lint and build. If Claude stops to report a problem, it will offer choices. Pick one, for example:

```text
use option 2
```

Near the end, Claude usually:
- starts a temporary copy of the app on a throwaway database, so your own data isn't touched
- writes `training/work/<feature-name>/review.md` with everything it actually checked
- runs the authorization reviewer

### Step 2.11: Look at the screen yourself

Claude can't see the browser. Open the address it gives you, for example http://localhost:3102, and follow its check list: which user to pick in "Viewing as", which request to open, and what you should see.

If something looks wrong, describe it in plain words. Examples from the session:

```text
while verifying the comment is coming out of the text box, there is no alignment - check it
```

```text
cancel button should be in centre aligned
```

### Step 2.12: Run the verification check

```text
/verify-checkpoint training/work/<feature-name>
```

**What you should see:**
- a summary table with test, lint and build results and authorization findings
- one row per acceptance example, marked EVIDENCED, MISSING, FAILING or MANUAL
- a final line, either **PASS — ready for engineer review** or **FAIL — not ready**, with the reasons

### Step 2.13: Run the authorization review on its own (whenever you want)

```text
run authorization-reviewer on <file or list of changed files>
```

### Step 2.14: Approve the review

```text
accept review.md
```

### Step 2.15: Update the team status and tidy up

```text
update the constitution status
```

```text
stop the temporary server
```

**The feature is done.** Its whole history (why, what, how, and the proof) is in `training/work/<feature-name>/`.

---

# Part 3: Optional extras used in the session

### Keep API documentation generated automatically (OpenAPI)

```text
Add OpenAPI documentation generation for this Express API, kept in sync
automatically:

1. Add swagger-jsdoc as a devDependency in server/package.json - it is
   a build-time generator, not something the running server imports.
2. Add an @openapi JSDoc block above every route in server/src/app.js
   (summary, parameters, response descriptions) that matches what the
   route actually does. Do not invent parameters or responses it
   doesn't have.
3. Create server/scripts/generate-openapi.js that builds the spec from
   those annotations with swagger-jsdoc and writes docs/openapi.json.
4. Add a "docs:openapi" script to server/package.json that runs it.
5. Add a PostToolUse hook in .claude/settings.json that reruns
   "cd server && npm run docs:openapi" whenever Edit or Write touches
   server/src/app.js. Scope it with the hook's "if" field to that one
   path rather than firing on every edit anywhere in the repo.

Run the generator once yourself to confirm docs/openapi.json is valid
before reporting done.
```

Then check it:

```text
run authorization-reviewer on server/src/app.js
```

### Move or rename feature folders consistently

```text
update all the reference for add-comment to training/work
```

---

# Part 4: Full session log (what was typed, in order)

Use this to see exactly how the reference session went, including corrections along the way. Steps marked ↻ were later superseded; use the Part 1 or Part 2 version instead.

| # | You typed | What it did |
|---|---|---|
| 1 | `how can I run the project` | Explained the run commands; found the VS Code launch config pointed at the wrong port |
| 2 | `npm ci` | Installed dependencies |
| 3 | `claude.md` → `/init` | Created `CLAUDE.md` |
| 4 | Domain guide prompt (Step 1.4) | Wrote `docs/domain.md` |
| 5 | Architecture prompt (Step 1.5) | Wrote `docs/architecture.md` |
| 6 | `accept domain.md and accept architecture.md` | Marked both accepted; linked them from `CLAUDE.md` |
| 7 | fetch-github-issue prompt (Step 1.7) | Created the skill |
| 8 | draft-intent-from-issue prompt (Step 1.8) | Created the skill. The template wasn't found at first; the template path was later set in the skill |
| 9 | `/fetch-github-issue 42` | Failed: the folder isn't a git repository, so there was no repo to look in |
| 10 | `add --repo mjinto/internal-request-hub when only a number is given` | Bare numbers now default to that repository |
| 11 | `/fetch-github-issue 42` | The repo default worked, but there is no issue 42 there |
| 12 | `/fetch-github-issue https://github.com/mjinto/internal-request-hub/issues/5` | Showed issue #5 (comments) |
| 13 | `/fetch-github-issue 5` | Showed issue #5 via the repo default |
| 14 ↻ | `/draft-intent-from-issue https://github.com/mjinto/internal-request-hub/issues/5 training/add-comment` | Drafted the comments intent (in the old folder; later moved to `training/work/add-comment/`) |
| 15 | `accept intent.md` | Recorded the product owner's acceptance |
| 16 ↻ | Spec prompt: "Using the accepted … intent.md, draft … spec.md from its template, covering who may comment, empty or whitespace-only comments, comment visibility, chronological order with author and timestamp, and leaving status, priority and reviewer comment unchanged. Separate confirmed rules from questions. Keep the acceptance decision pending for a reviewer. Do not modify application code." | Drafted the comments spec |
| 17 | `accept spec.md` | Recorded acceptance, including the proposed answers to open questions |
| 18 | Plan prompt (Step 2.7 wording) | Drafted the comments plan |
| 19 | `please fill the open questions based on your recommendation` | Added recommendations |
| 20 | `accept plan.md` | Recorded acceptance |
| 21 | Implement prompt (Step 2.10) | Built checkpoints 1–5; stopped at 6 because the local data had no Submitted request |
| 22 | `use option 2` | Ran the walkthrough on a temporary server with throwaway data |
| 23 | `while verifying the comment is coming out of the text box…` | Fixed comment wrapping and text-box alignment |
| 24 | `cancel button should be in centre aligned` | Centered the Cancel button (outside the feature's scope; noted as such) |
| 25 | authorization-reviewer prompt (Step 1.9) | Created the agent |
| 26 | verify-checkpoint prompt (Step 1.10) | Created the skill |
| 27 ↻ | First constitution prompt | Wrote constitution revision 1 and the README |
| 28 | `accept constitution.md` | Accepted revision 1 |
| 29 | `accept README.md and apply the CLAUDE.md pointers` | Accepted the README; added tool pointers to `CLAUDE.md` |
| 30 | `/verify-checkpoint training/add-comment` | PASS recommendation for comments |
| 31 | CLAUDE.md import prompt (Step 1.12) | `CLAUDE.md` now imports the constitution and both guides |
| 32 | `accept CLAUDE.md` | Noted |
| 33 | Draft-intent prompt for issue #2 (Step 2.2) | Drafted the approve/reject intent |
| 34 | `accept intent.md` | Recorded acceptance |
| 35 | Folder rule follow-up; `Reviewer role is needed` | Constitution amended: folders are named from the issue title; the reviewer-role decision recorded |
| 36 | `draft spec.md with Q3-Q8 response you can recommend` | Drafted the spec with recommendations |
| 37 | Answers to questions 1, 3–8 and 10 (Step 2.5) | Claude asked to clarify ambiguous answers, then recorded them |
| 38 | Answers to questions 11–12, plus a folder-name request | Recorded; placeholder renamed |
| 39 | `accept spec.md` | Recorded the technical lead's acceptance |
| 40 | `draft plan.md, technical reviewer is Sagar Sharma` + plan prompt | Drafted the plan |
| 41 | `2` / `accept plan` | Recorded acceptance (Q2 confirmed, others at their recommendations) |
| 42 | Implement prompt (Step 2.10) | Built all checkpoints, ran the API walkthrough, wrote `review.md`, ran the authorization review |
| 43 | Constitution revision 2 prompt (Step 1.11) | Revised the constitution; moved comments to `training/work/add-comment/`; added `training/work/_templates/` |
| 44 | `Accept,` + CLAUDE.md import prompt | Accepted revision 2; refreshed `CLAUDE.md` |
| 45 | `accept CLAUDE.md` | Noted |
| 46 | `/verify-checkpoint training/work/approve-or-reject` | PASS recommendation |
| 47 | `accept review.md` | Recorded the technical reviewer's acceptance |
| 48 | `update the constitution status` | Approve/reject listed as implemented |
| 49 | `stop the temporary server` | Stopped it |
| 50 | OpenAPI prompt (Part 3) | Added generated API docs and an auto-regenerating hook |
| 51 | `run authorization-reviewer on server/src/app.js` | No code findings; two minor wording issues in the API docs |

---

## Things that commonly go wrong (and the fix)

| Symptom | Why | What to do |
|---|---|---|
| A skill behaves like an older version | Skills load when the session starts | Restart Claude Code after creating or editing a skill |
| `/fetch-github-issue 5` says "not a git repository" | A bare number needs a repository default | Use the full issue URL, or do the repo-default step in Step 1.7 |
| Claude says it "can't run" a skill itself | `/verify-checkpoint` and `/draft-intent-from-issue` are manual-only on purpose | Type the `/` command yourself |
| Claude asks you to check the screen | It can't see the browser | Open the address it gives you and report what you see in plain words |
| A document isn't moving forward | The previous document hasn't been accepted | Type `accept <file>.md` once you've read it |
| An answer you gave was recorded differently than you meant | Short answers can be ambiguous | Tell Claude the correct meaning. It updates the record, and it never assumes an approval |
| Your local data has no request in the state a check needs | Earlier testing changed it | Choose the "temporary server with throwaway data" option. Only use `npm run db:reset` if you're happy to lose local data |
