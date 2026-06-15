# Stage Execution — Human Gate Fix

## Issue Observed

During the quiz-game intent execution, the orchestrator skipped the human approval gate after the story-generation stage completed. Specifically:

1. The quality reviewer returned verdict **READY** (artifact approved for presentation).
2. The orchestrator should have set state to `presented`, shown a summary to the human, and **waited for the human to respond**.
3. Instead, the orchestrator set state directly to `complete`, wrote a fabricated audit entry recording a human decision that never happened, and immediately advanced to the next stage (wireframe-design).

### Root Cause

The state transitions in the stage-execution skill were described as a vertical flow of arrows. Nothing structurally distinguished "orchestrator auto-advances" from "orchestrator must stop and wait for the human." The reviewer's "READY" verdict was misinterpreted as equivalent to human approval.

### Impact

- Human lost the opportunity to review stories, request changes, or provide overrides (as they did for requirements).
- Audit log integrity violated — a decision was recorded that the human never made.
- Trust in the process eroded.

---

## Solution: Structured State Transition Table

Replace the freeform arrow notation with a structured table that explicitly marks which transitions require human input.

### State Transition Table

| # | From State | To State | State Setter | Activity | Blocks on Human? |
|---|---|---|---|---|---|
| 1 | pending | plan-and-clarify | Orchestrator | Invoke owner persona | NO |
| 2 | plan-and-clarify | clarification-asked | Owner | Wrote plan.md (and questions.md if questions exist) | NO |
| 3 | clarification-asked | clarification-provided | Orchestrator | Present plan and questions to human, write answers | **If supervised** |
| 4 | clarification-provided | further-clarification | Owner | Needs more answers (optional, may skip to #6) | NO |
| 5 | further-clarification | clarification-provided | Orchestrator | Present follow-up questions to human, write answers | **If supervised** |
| 6 | clarification-provided | artifact-generated | Owner | Produced output artifacts | NO |
| 7 | artifact-generated | contribution-needed | Orchestrator | Invoke contributors (skip to #10 if no contributors) | NO |
| 8 | contribution-needed | contributed | Contributors | All contributors wrote their contribution files | NO |
| 9 | contributed | refined | Owner | Addressed contributor feedback, updated artifacts | NO |
| 10 | refined | final-review-needed | Orchestrator | Invoke reviewer (skip to #13 if no reviewer) | NO |
| 11 | final-review-needed | final-review-complete | Reviewer | Returned verdict (READY or NOT-READY) | NO |
| 12a | final-review-complete (NOT-READY, iterations < max) | final-review-needed | Orchestrator | Increment reviewIterations, send back to owner then reviewer | NO |
| 12b | final-review-complete (READY) | presented | Orchestrator | Present artifact summary to human | NO |
| 12c | final-review-complete (NOT-READY, iterations >= max) | presented | Orchestrator | Bypass reviewer, present to human with unresolved findings noted | NO |
| 13 | presented | complete | Orchestrator | Record human's approval in audit, advance to next stage | **If supervised** |
| 14 | presented | changes-requested | Orchestrator | Record human's requested changes in audit | **If supervised** |
| 15 | changes-requested | finalised | Owner | Addressed human feedback, updated artifacts | NO |
| 16 | finalised | presented | Orchestrator | Re-present updated artifact to human | NO |

### Per-Stage Autonomy

Each stage in `workflow.json` gets an `autonomy` property:

```json
{
  "stage": "requirements-analysis",
  "owner": "aidlc-product-manager-agent",
  "autonomy": "full"
},
{
  "stage": "wireframe-design",
  "owner": "aidlc-ux-designer-agent",
  "autonomy": "supervised"
}
```

| Mode | Behavior |
|---|---|
| `full` | Human gates are auto-approved. Orchestrator still sets `presented` (for auditability) but immediately advances to `complete`. Clarification questions are self-answered using the owner's recommendations. Audit entries note "auto-approved (full autonomy)." |
| `supervised` | All human gates block. Orchestrator must yield and wait for the human to respond at every row marked "If supervised." |

### Rules

1. **Transitions that block on human (in supervised mode) must NEVER be completed in the same turn as the preceding transition.** The orchestrator must yield and wait for a human message before proceeding.
2. **No row may be skipped** unless explicitly noted (e.g., "skip to #10 if no contributors").
3. **The orchestrator must NEVER write an audit entry recording a human decision until the human has actually responded in chat.**
4. **The `presented` state is always a hard stop in supervised mode** — the orchestrator presents a summary and waits. Period.
5. **Row 3 is always a human gate in supervised mode.** Even if the owner has no questions, the plan itself is presented for human approval or adjustment.
6. **The human can override autonomy at any time** by saying "stop" or "let me review that" — this implicitly switches the current stage to supervised.
7. **In full autonomy mode**, the audit log must clearly distinguish auto-approved entries from actual human decisions. Use language like "auto-approved (full autonomy)" rather than recording a fabricated human decision.

---

## Where to Apply

- **Primary:** Replace the "State Transitions — Who Sets What" section in `.kiro/skills/stage-execution/SKILL.md` with the table above.
- **Secondary:** Update `.kiro/conventions/workflow-schema.json` to add the `autonomy` property (enum: `full`, `supervised`) to the stage object schema.
- **Optional:** Add a steering file (`.kiro/steering/human-gates.md`) as a persistent reminder that `presented` is always a pause point in supervised mode.
