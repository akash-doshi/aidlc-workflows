# Kiro Improvements: Adding Claude Code's Robustness While Keeping Kiro's Flexibility

> Goal: Combine Kiro's composability, flexibility, and low ceremony with Claude Code's robustness, state integrity, and self-learning — without importing the complexity.

---

## Design Principle: LLM Owns Composition, Tools Own State

```
┌─────────────────────────────────────────────────────────┐
│  COMPOSITION LAYER (keep Kiro's flexibility)            │
│  - LLM reads stage-graph.md + converses with human      │
│  - Stages are reorderable, skippable, addable           │
│  - Personas invoked as sub-agents                       │
│  - Templates swappable by end-user                      │
└────────────────────────┬────────────────────────────────┘
                         │ writes to
┌────────────────────────▼────────────────────────────────┐
│  STATE LAYER (add Claude Code's robustness)             │
│  - Tool-owned state transitions (never LLM-written)     │
│  - Schema validation on every write                     │
│  - Hooks for verification after each stage              │
│  - Learnings persistence between intents                │
└─────────────────────────────────────────────────────────┘
```

---

## Concrete Changes

### 1. Replace LLM-Written State with a State-Management Tool

**Problem:** Today, personas write directly to `state.json` ("set status to X"). The LLM can write invalid states, skip transitions, or corrupt JSON.

**Solution:** A single `state-manager.js` tool that the orchestrator and personas call instead of writing JSON directly.

```bash
# Instead of persona writing state.json directly:
node .kiro/tools/state-manager.js transition \
  --intent <dir> \
  --stage requirements-analysis \
  --to artifact-generated

# The tool:
# 1. Validates the transition is legal (from current → to requested)
# 2. Validates preconditions (e.g., outputs declared before "artifact-generated")
# 3. Writes the state atomically
# 4. Appends an audit entry automatically
# 5. Returns success/failure with reason
```

Additional subcommands:

```bash
# Register an output artifact
node .kiro/tools/state-manager.js register-output \
  --intent <dir> \
  --stage requirements-analysis \
  --name requirements.md \
  --location stages/inception/requirements-analysis/

# Check for resume on session start
node .kiro/tools/state-manager.js check-resume --workspace <root>
# Returns: { "activeIntent": "intent-003-quiz-game", "lastCompletedStage": "domain-design", "nextStage": "units-generation" }
```

This preserves flexibility (the LLM still decides *when* to transition) but makes the *act of transitioning* deterministic and validated. The state machine table from `aidlc-stage-execution/SKILL.md` becomes enforced code, not LLM-honor-system.

**Transition validation rules (encoded in the tool):**

| From State | Allowed Transitions |
|---|---|
| pending | plan-and-clarify |
| plan-and-clarify | clarification-asked |
| clarification-asked | clarification-provided |
| clarification-provided | further-clarification, artifact-generated |
| further-clarification | clarification-provided |
| artifact-generated | contribution-needed, final-review-needed, presented |
| contribution-needed | contributed |
| contributed | refined |
| refined | final-review-needed, presented |
| final-review-needed | final-review-complete |
| final-review-complete | final-review-needed, presented |
| presented | complete, changes-requested |
| changes-requested | finalised |
| finalised | presented |

Any transition not in this table → rejected with error message.

**Precondition checks:**

- `→ artifact-generated`: At least one output must be registered AND exist on disk
- `→ presented`: All registered outputs must exist on disk and be non-empty
- `→ contributed`: The contributor's contribution file must exist on disk
- `→ complete`: Human decision must be passed as argument (`--decision "approved"`)

---

### 2. Add Lightweight Validation Hooks (2-3, Not 10)

**Problem:** Only `process-checker.js` runs today, and only after sub-agent calls. No validation of state consistency or output quality.

**Solution:** Keep Kiro's minimal hook philosophy but make the hooks smarter:

| Hook | Trigger | What it does |
|------|---------|-------------|
| `state-validator` | `postToolUse` on `invoke_sub_agent` | Validates state.json against schema, checks transition legality, verifies outputs exist. Reports issues to orchestrator. |
| `artifact-validator` | `postToolUse` on `invoke_sub_agent` | Checks that stage outputs match what the stage definition declares. Validates cross-references (e.g., "does components.yaml reference valid requirement IDs from requirements.md?"). |
| `learnings-prompt` | `postToolUse` on `invoke_sub_agent` (when stage status = "presented") | Asks: "Before presenting to human, capture any deviations or interpretations worth remembering for future intents." |

**Hook file: `.kiro/hooks/state-validator.kiro.hook`**

```json
{
  "version": "1.0.0",
  "enabled": true,
  "name": "aidlc-state-validator",
  "description": "After each sub-agent completes, validates state integrity and output existence.",
  "when": {
    "type": "postToolUse",
    "toolTypes": ["invoke_sub_agent"]
  },
  "then": {
    "type": "runCommand",
    "command": "node .kiro/tools/state-manager.js validate --intent $(cat .kiro/.active-intent 2>/dev/null || echo '')"
  }
}
```

**Hook file: `.kiro/hooks/learnings-prompt.kiro.hook`**

```json
{
  "version": "1.0.0",
  "enabled": true,
  "name": "aidlc-learnings-prompt",
  "description": "After stage completes, prompts orchestrator to capture learnings for team memory.",
  "when": {
    "type": "postToolUse",
    "toolTypes": ["invoke_sub_agent"]
  },
  "then": {
    "type": "askAgent",
    "prompt": "A stage just completed. If the human approved the artifact, check if there were any deviations, corrections, or preferences expressed during this stage that should be remembered for future intents. If so, append them to team-memory/corrections.md or team-memory/preferences.md. If nothing notable, proceed."
  }
}
```

---

### 3. Add a Learnings/Rules Persistence Layer

**Problem:** Kiro resets every intent. Custom formats, team preferences, and corrections don't carry forward.

**Solution:** A `team-memory/` directory at workspace level (peer of `org-ai-kb/`):

```
<workspace-root>/
├── org-ai-kb/              ← per-intent artifacts (existing)
├── team-memory/            ← persists across intents (new)
│   ├── preferences.md      ← "We write requirements as Gherkin"
│   ├── corrections.md      ← "NEVER split auth into separate unit"
│   ├── decisions.md        ← "DECIDED: use PostgreSQL for all persistence (intent-002)"
│   └── templates/          ← custom templates that override defaults
│       ├── requirements.md
│       └── functional-spec.md
└── .kiro/                  ← framework installation (existing)
```

**How it works:**

1. **Reading:** The orchestration skill gets one extra instruction: "Before composing a workflow, read `team-memory/preferences.md` and `team-memory/corrections.md`. Apply those preferences to all stage outputs. Use templates from `team-memory/templates/` when they exist, falling back to `.kiro/stages/<stage>/templates/`."

2. **Writing:** The learnings-prompt hook asks the orchestrator to capture notable preferences/corrections after each stage. Append-only, timestamped entries:

```markdown
# Team Preferences

- 2026-06-10 — We write requirements using Gherkin format with Given/When/Then scenarios (intent-001)
- 2026-06-12 — Domain design should include sequence diagrams, not just ER diagrams (intent-002)
- 2026-06-13 — Always include a "Security Considerations" section in functional specs (intent-003)
```

3. **Template override resolution:** `team-memory/templates/<file>` takes precedence over `.kiro/stages/<stage>/templates/<file>`. The work-method skill gets one additional line:

```markdown
- Check `team-memory/templates/` first for a matching template filename. If found, use it instead of the stage's default template. This ensures team customizations survive framework updates.
```

4. **Survives rebuilds:** `team-memory/` is outside `.kiro/` so the build script's `rmrf` of `dist/` never touches it. It's user-owned, committed to git, shared across the team.

**Steering file: `.kiro/steering/team-memory.md`**

```markdown
---
inclusion: auto
---

# Team Memory

Before starting any stage, check if `team-memory/` exists at the workspace root. If it does:

1. Read `team-memory/preferences.md` — these are standing instructions that apply to all stages.
2. Read `team-memory/corrections.md` — these are things the team has learned NOT to do.
3. Read `team-memory/decisions.md` — these are decisions already made; do not re-ask them.
4. When looking for output templates, check `team-memory/templates/<filename>` first. If found, use it instead of the default from `.kiro/stages/<stage>/templates/`.

These files are append-only and accumulate team knowledge over time. They are committed to git and shared across the team.
```

---

### 4. Output-Registered-Before-Complete Guard

**Problem:** Personas can claim "artifact-generated" without actually writing files.

**Solution:** Built into `state-manager.js` (see §1 precondition checks). The tool enforces:

```javascript
// Before allowing transition to "artifact-generated":
function validateArtifactGenerated(intentDir, stageName) {
  // 1. Read the stage definition's ## Outputs section
  // 2. Check that at least one output is registered in state.json for this stage
  // 3. For each registered output, verify the file exists on disk and is non-empty
  // 4. If any check fails → return { allowed: false, reason: "..." }
}
```

This is what Claude Code's sensors do (required-sections, upstream-coverage) but implemented as a gate in the state tool rather than as a PostToolUse hook that fires after every file write. Lighter, targeted, same effect.

---

### 5. Workflow Lock After Human Approval

**Problem:** Flexibility is great during composition, but once the human approves a stage, the contract should be firm.

**Solution:** After the human approves a stage addition to `workflow.json`, the state-manager marks that stage as "locked." A conversational guard in the orchestration skill:

Add to `aidlc-workflow-composition/SKILL.md`:

```markdown
## Locked Stages

Once a stage is approved by the human and added to workflow.json, it is "locked." You may:
- Reassess and propose changes to FUTURE (not-yet-approved) stages
- Add stages after the locked ones
- Propose skipping a locked stage — but only with explicit human approval ("I think we can skip X because Y — ok?")

You may NOT:
- Silently drop a locked stage
- Reorder locked stages without asking
- Change a locked stage's owner/contributors without asking

This ensures the human's approved plan is respected while keeping future stages flexible.
```

This is a conversational guard, not a tool guard — it respects Kiro's LLM-driven philosophy while adding the discipline.

---

### 6. Session Resume Capability

**Problem:** If a session is interrupted, Kiro has no resume path.

**Solution:** The `state-manager.js` tool's `check-resume` subcommand (see §1), plus one addition to the orchestration skill:

Add to `aidlc-orchestration/SKILL.md`:

```markdown
## Session Resume

On activation, run:
```bash
node .kiro/tools/state-manager.js check-resume --workspace .
```

If the tool reports an active intent with incomplete stages, present to the human:

> "I found an in-progress intent: **[intent-name]** — last completed stage was **[stage]**, next up is **[next-stage]**. Want to resume, or start something new?"

If resume: read workflow.json and state.json for that intent, pick up from the next pending stage.
If new: proceed with normal kickoff (workspace-setup creates a new intent-NNN directory).
```

---

## What This Preserves from Kiro

- ✅ Conversational workflow composition (LLM decides order)
- ✅ Many front doors (any starting point)
- ✅ Swappable templates (edit a file = change output)
- ✅ Minimal hook count (2-3, not 10)
- ✅ Low token consumption (small context per turn)
- ✅ Multi-intent coexistence
- ✅ Multi-repo workspace architecture
- ✅ No compilation step at runtime
- ✅ Node.js only (no bun dependency)
- ✅ IDE-native experience
- ✅ Human-readable summary / machine-readable source-of-truth separation
- ✅ Diagram-first, terse templates

## What This Adds from Claude Code

- ✅ Tool-owned state transitions (no LLM-corrupted state)
- ✅ Transition validation (illegal transitions rejected)
- ✅ Output existence verification (can't claim done without files)
- ✅ Audit trail written atomically by tools (not LLM-honor-system)
- ✅ Session resume capability
- ✅ Learnings persistence across intents (team-memory/)
- ✅ Template override layer that survives rebuilds
- ✅ Cross-reference validation between artifacts

## What This Deliberately Does NOT Import

- ❌ Deterministic engine binary (routing stays with the LLM — that's the flexibility source)
- ❌ 10 hooks (keeps it at 2-3)
- ❌ Compiled stage graph (stays markdown-readable, no `compile` step)
- ❌ Scope system (the LLM right-sizes conversationally instead)
- ❌ 5-layer rule chain (single `team-memory/` directory instead)
- ❌ Bun dependency (stays Node.js)
- ❌ Sensors as a separate concept (validation lives in the state tool)
- ❌ Swarm/parallel execution (future addition, not needed for MVP)
- ❌ StatusLine / session-cost tracking (IDE provides visibility natively)
- ❌ MCP server declarations (users add their own as needed)

---

## Implementation Priority

| Priority | Change | Effort | Impact | Files Touched |
|----------|--------|--------|--------|---------------|
| **P0** | `state-manager.js` with transition validation | Medium (~250 lines) | Eliminates #1 fragility (LLM-corrupted state) | New: `src/tools/state-manager.js` |
| **P0** | State-validator hook (replaces process-checker) | Small (upgrade existing) | Catches drift immediately | Modify: `process-checker.js` → `state-validator.js` + hook file |
| **P1** | `team-memory/` directory + steering file | Small (convention + 1 file) | Enables persistence between intents | New: `src/steering/team-memory.md`, docs |
| **P1** | Template override resolution | Small (one paragraph in work-method skill) | Templates survive rebuilds | Modify: `skills/common/aidlc-work-method/SKILL.md` |
| **P1** | Workflow lock guard | Small (one section in composition skill) | Prevents silent plan changes | Modify: `skills/aidlc-workflow-composition/SKILL.md` |
| **P2** | Session resume (`check-resume` subcommand) | Small (one subcommand + skill update) | Quality-of-life for interrupted sessions | Modify: `state-manager.js`, `skills/aidlc-orchestration/SKILL.md` |
| **P2** | Learnings-prompt hook | Small (1 hook file) | Starts accumulating team knowledge | New: hook file |
| **P3** | Cross-reference validation in artifact-validator | Medium (~150 lines) | Catches broken traceability | New: `src/tools/artifact-validator.js` + hook file |

---

## Summary

The P0 items are a single `state-manager.js` file and one hook upgrade. That alone closes the biggest robustness gap (LLM-corrupted state, missing outputs, invalid transitions) while touching nothing about how composition, ordering, or execution works. The LLM remains the flexible orchestrator; the tool becomes the reliable state keeper.

The full set (P0–P3) gives Kiro:
- Claude Code's state integrity without its complexity
- Claude Code's self-learning without its 5-layer rule chain
- Claude Code's session resilience without its engine binary
- All while remaining a ~3 file, Node.js-only, no-compilation, conversationally-flexible system
