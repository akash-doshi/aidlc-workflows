# Change Summary: `feature/workflow-composition-rework` vs `v2`

> This document summarizes all changes made on this branch compared to the `v2` base.
> It serves as a handoff document — any Kiro session reading this should understand
> what was implemented, why, and what remains.

---

## Background

This branch addresses two goals:

1. **Workflow Composition Rework** — Replace the upfront "propose full workflow as a table" approach with an incremental, stage-by-stage composition model that adapts as it learns more.
2. **Import Claude Code's Robustness into Kiro** — After a comparative review of both implementations (`harness-comparison.md`), selectively bring Claude Code's state integrity, validation, persistence, and self-learning into Kiro without compromising its composability, flexibility, or low token cost.

---

## Changes Implemented (chronological)

### 1. Workflow Composition Rewrite
**Commit:** `6d2b686` — `refactor: rewrite workflow-composition skill`

**What changed:** Complete rewrite of `kiro/src/skills/aidlc-workflow-composition/SKILL.md`.

**Before (v2):** The orchestrator composed the entire workflow upfront as a table (all stages, owners, contributors, reviewers at once), then executed sequentially.

**After:** Five-step incremental composition:
1. Deduce the intent category internally (complex regulated, multi-component, single app, targeted fix, etc.)
2. Surface integrations and ask two questions: "Do you have existing implementations?" and "Production or prototype?"
3. State the high-level path casually ("Am thinking: Requirements → Stories → Domain Design → Code Gen")
4. Propose each stage one at a time with composable options (add/remove contributors, reviewer, iterations)
5. Reassess before every stage — adapt if complexity shifted

**Key principle:** `workflow.json` grows incrementally — each stage added as approved. Running record, not upfront commitment.

**Files:** `kiro/src/skills/aidlc-workflow-composition/SKILL.md`

---

### 2. Stage Execution Updates
**Commit:** `6d2b686` (same commit, bundled)

**What changed:** Two additions to `kiro/src/skills/aidlc-stage-execution/SKILL.md`:
- **Stage brief** — before starting work, compose a brief statement for the human explaining what will happen (inputs, outputs, what's needed from them)
- **Return to workflow composition** — after every stage completion, invoke workflow-composition to propose the next stage. Do NOT auto-advance mechanically.

**Files:** `kiro/src/skills/aidlc-stage-execution/SKILL.md`

---

### 3. Tool-Based Workspace Setup
**Commit:** `6d2b686` (same commit, bundled)

**What changed:** Replaced LLM-manual directory creation in kickoff with a deterministic Node.js tool.

**Before:** The orchestrator LLM created directories and wrote boilerplate files manually.
**After:** `node .kiro/tools/workspace-setup.js [team-name] <intent-slug>` does it in ~5ms.

**Files:** `kiro/src/tools/workspace-setup.js`, `kiro/src/skills/aidlc-kickoff/SKILL.md`

---

### 4. State-Manager Tool + Transition Table
**Commit:** `6bb4c4b` — `feat: add state-manager tool with transition table and validator hook`

**What changed:** Created the core robustness layer — a tool that enforces all state transitions.

**Architecture:**
- `kiro/src/conventions/transitions.json` — The state machine as data. 22 edges. Each edge has: `from`, `to`, `actor` (orchestrator/owner/reviewer), `condition` (single condition, never compound).
- `kiro/src/tools/state-manager.js` — Reads the transition table, validates actor + condition, checks file-existence preconditions, writes state atomically, appends audit entries.

**Key design decisions:**
- **Single-condition edges** — no compound AND/OR logic. Forks get their own intermediate states.
- **Intermediate states for explainability** — `contribution-not-needed`, `review-not-needed` make the state trail self-documenting. Reading `artifact-generated → contribution-not-needed → review-not-needed → presented` tells you exactly why the stage went straight to the human.
- **Actor enforcement** — owner can't make orchestrator's transitions and vice versa.
- **File-existence preconditions** — can't claim `artifact-generated` without outputs registered and existing on disk.
- **Transition table is editable JSON** — change the state machine without touching code.

**Subcommands:** `transition`, `register-output`, `register-contribution`, `add-stage`, `validate`, `check-resume`, `allowed`

**Also:** Replaced the old `process-checker.kiro.hook` with `state-validator.kiro.hook` that calls `state-manager.js validate`.

**Files:** `kiro/src/conventions/transitions.json`, `kiro/src/tools/state-manager.js`, `kiro/src/target-config/kiro-ide/hooks/state-validator.kiro.hook` (new), `kiro/src/target-config/kiro-ide/hooks/process-checker.kiro.hook` (deleted)

---

### 5. Domain-Specific Validation Tools
**Commit:** `e31dada` — `feat: add domain-specific validation tools for YAML artifacts`

**What changed:** Three purpose-built validators for machine-parseable artifacts:

| Tool | Validates | Cross-references |
|------|-----------|-----------------|
| `validate-domain-model.js` | `components.yaml` — unique IDs, valid dependencies, no circular refs, entity structure | Internal consistency |
| `validate-entities.js` | `entities.yaml` — unique IDs, required attribute fields, relationship refs | `--references components.yaml` |
| `validate-rules.js` | `rules.yaml` — unique IDs, required fields, valid category | `--references entities.yaml` |

**Design:** These are invoked by the **reviewer persona** during its review — not as hooks on every write. The reviewer interprets results with judgment (a failure might be acceptable with rationale). Stage definitions declare available tools in a `## Validation Tools` section.

**Also updated:**
- `stages/domain-design/definition.md` — added `## Validation Tools` section
- `stages/functional-design/definition.md` — added `## Validation Tools` section
- `personas/aidlc-architecture-reviewer-agent.yaml` — instructed to run validation tools when listed
- `skills/common/aidlc-work-method/SKILL.md` — instructed all reviewers to check for and run validation tools

**Files:** `kiro/src/tools/validate-domain-model.js`, `kiro/src/tools/validate-entities.js`, `kiro/src/tools/validate-rules.js`, plus stage definitions and persona updates

---

### 6. Parallel Contributor Invocation
**Commit:** `c952fab` — `feat: parallel contributor invocation`

**What changed:** One paragraph added to `kiro/src/skills/aidlc-stage-execution/SKILL.md`:

> "When a stage has multiple contributors, invoke ALL of them in a single turn (parallel sub-agent calls). Each contributor receives the same invocation format and writes independently to the stage directory. Wait for all to return before proceeding to the refinement step."

**Impact:** Multiple contributors run concurrently instead of sequentially. No code change — just a prompt instruction that leverages Kiro's ability to issue parallel `invoke_sub_agent` calls in one message.

**Files:** `kiro/src/skills/aidlc-stage-execution/SKILL.md`

---

### 7. Wire State-Manager into Work-Method Skill
**Commit:** `ccc5f6e` — `feat: wire state-manager into work-method skill`

**What changed:** Updated all state-write instructions in `aidlc-work-method/SKILL.md` from "set this stage's status in `state/state.json` to X" to explicit `node .kiro/tools/state-manager.js transition ...` commands.

**Covers:** plan-and-clarify, clarification-asked, further-clarification, artifact-generated (with register-output), contributed (with register-contribution), refined, finalised.

**Impact:** Personas no longer write state.json directly. All mutations go through the validated tool. Saves ~15,000 tokens per workflow on state bookkeeping and eliminates state corruption risk.

**Files:** `kiro/src/skills/common/aidlc-work-method/SKILL.md`

---

### 8. Feasibility + Practices Detection Skills
**Commit:** `023c1c6` — `feat: add feasibility and practices-detection skills`

**What changed:** Two new skills attached to `aidlc-systems-architect-agent`:

- **`aidlc-feasibility-skill`** — Assesses technical viability across 5 dimensions: technical viability, integration risk, data feasibility, scale/performance, dependency/ecosystem. Produces a verdict (feasible / feasible with constraints / not feasible) + recommendation.
- **`aidlc-practices-detection-skill`** — Extracts team conventions from codebase evidence during reverse-engineering: branching strategy, testing posture, code style, dependency management, CI/CD approach, architectural patterns. Outputs to `team-memory/preferences.md`.

**Files:** `kiro/src/skills/aidlc-feasibility-skill/SKILL.md`, `kiro/src/skills/aidlc-practices-detection-skill/SKILL.md`, `kiro/src/personas/aidlc-systems-architect-agent.yaml`

---

### 9. Depth Control
**Commit:** `0d0dcc3` — `feat: add depth control (Minimal/Standard/Comprehensive)`

**What changed:** Added depth instruction to workflow-composition and work-method skills.

- **Composition** proposes depth based on intent category (bug fix = Minimal, feature = Standard, regulated = Comprehensive)
- Human can override ("make it leaner" / "be more thorough")
- Recorded in `workflow.json` as `"depth": "standard"`
- **Personas** read depth and calibrate output: Minimal = bare minimum, Standard = practical thoroughness, Comprehensive = full ceremony

**Files:** `kiro/src/skills/aidlc-workflow-composition/SKILL.md`, `kiro/src/skills/common/aidlc-work-method/SKILL.md`

---

### 10. Team Memory Layer
**Commit:** `3ecfd87` — `feat: add team memory layer`

**What changed:** Implemented persistence across intents — team preferences, corrections, and template overrides survive between workflows and framework rebuilds.

**Structure:**
```
org-ai-kb/<team-name>/
├── memory/
│   ├── preferences.md      ← "We write requirements in Gherkin"
│   ├── corrections.md      ← "NEVER split auth into separate unit"
│   └── templates/          ← custom output templates (override framework defaults)
├── aidlc-docs/             ← intents
└── repo-docs/              ← RE artifacts
```

**Template resolution:** `org-ai-kb/<team>/memory/templates/<file>` → `.kiro/stages/<stage>/templates/<file>`

**Team discovery:** If one team folder exists → auto-select. If none → default to "default". If multiple → ask.

**Updated:** workspace-setup.js (creates memory/ on first run), folder-structure.md, orchestration skill (reads memory before composing), work-method skill (checks team templates first), state-manager check-resume (walks team folders).

**Files:** `kiro/src/tools/workspace-setup.js`, `kiro/src/conventions/folder-structure.md`, `kiro/src/skills/aidlc-orchestration/SKILL.md`, `kiro/src/skills/common/aidlc-work-method/SKILL.md`, `kiro/src/tools/state-manager.js`

---

### 11. Session Resume
**Commit:** `2133a8f` — `feat: wire session resume into orchestration skill`

**What changed:** On activation, the orchestrator runs `state-manager.js check-resume`. If an active intent is found, it offers to resume or start new.

**Files:** `kiro/src/skills/aidlc-orchestration/SKILL.md`

---

### 12. Solution Architecture Skill
**Commit:** `e83cfda` — `feat: add solution-architecture skill`

**What changed:** New skill covering NFR design holistically: performance/latency targets, scalability patterns, reliability/availability design, security posture, observability strategy, cost modeling, technology selection criteria, architectural pattern application, and risk register.

Named as a real architecture skill (not just "nfr-design") — thinks about quality attributes as a solution architect would.

**Files:** `kiro/src/skills/aidlc-solution-architecture-skill/SKILL.md`, `kiro/src/personas/aidlc-systems-architect-agent.yaml`

---

### 13. Learnings-Prompt Hook
**Commit:** `1503593` — `feat: add learnings-prompt hook`

**What changed:** A `postToolUse` hook on `invoke_sub_agent` that fires after every sub-agent return. Prompts the orchestrator to check if the human expressed preferences or corrections during the stage, and if so, append them to `memory/preferences.md` or `memory/corrections.md`.

**Impact:** Team knowledge accumulates automatically over time. Each intent contributes to the team's institutional memory.

**Files:** `kiro/src/target-config/kiro-ide/hooks/learnings-prompt.kiro.hook`

---

## What Remains To Do

| # | Item | Effort | Description |
|---|------|--------|-------------|
| 1 | **Workflow lock guard** | Small (1 paragraph in composition skill) | Prevent silently dropping approved stages. Once a stage is approved and in workflow.json, the orchestrator must ask before removing/reordering it. |
| 2 | **Full audit trail on all transitions** | Small (few lines in state-manager.js) | Currently only logs human decisions (complete/changes-requested). Extend to log every transition for full traceability. |
| 3 | **Infrastructure design skill** | Small (new SKILL.md) | Dedicated skill for mapping logical components to cloud services, IaC patterns, deployment topology, networking, data stores. |
| 4 | **Knowledge base per agent** | Medium (content creation) | Write methodology guides per agent (like Claude Code's `.claude/knowledge/aidlc-<agent>/`). The agent JSON `resources` field already supports loading them. |
| 5 | **Integration test stage** | Small (new stage definition + validator) | A post-code-gen stage for multi-unit builds: verify cross-unit contracts hold at runtime. |
| 6 | **Steering file for routing enforcement** | Small (exists on another branch) | `inclusion: always` steering file that ensures ALL code-change requests go through aidlc-orchestration, preventing Kiro's default context-gatherer from intercepting. Exists on branch `bugfix/steering-orchestration-enforcement`. |
| 7 | **org-ai-kb team structure migration in testing** | Medium | The workspace-setup.js now creates `org-ai-kb/<team>/aidlc-docs/` instead of `org-ai-kb/aidlc-docs/`. Existing test workspaces may need migration or fresh setup. |

---

## Architecture Principles Established

1. **LLM owns composition, tools own state** — The LLM decides what to do (flexible); tools enforce state transitions (robust).
2. **Single-condition edges** — State machine forks get intermediate states rather than compound conditions. Self-documenting.
3. **Actor-aware transitions** — The tool knows who can make which transition. Prevents personas from overstepping.
4. **Validators are reviewer-invoked, not hook-based** — The reviewer runs validation tools with judgment, not a hook that fires blindly on every write.
5. **Team memory at workspace level** — Preferences, corrections, and templates persist across intents and framework rebuilds.
6. **Templates override, not replace** — Team templates layer on top of framework defaults. Resolution: team → framework.
7. **Depth is conversational** — No rigid scope grid. The orchestrator proposes depth, the human can override.
8. **Parallel where possible** — Contributors invoke in parallel. Sequential only where order matters.
9. **Skills are expertise, not stages** — A skill is attached to a persona and usable in any stage context. Stages are workflow steps; skills are domain knowledge.

---

## File Inventory (new and modified)

### New Files
```
kiro/src/conventions/transitions.json
kiro/src/tools/state-manager.js
kiro/src/tools/validate-domain-model.js
kiro/src/tools/validate-entities.js
kiro/src/tools/validate-rules.js
kiro/src/skills/aidlc-feasibility-skill/SKILL.md
kiro/src/skills/aidlc-practices-detection-skill/SKILL.md
kiro/src/skills/aidlc-solution-architecture-skill/SKILL.md
kiro/src/target-config/kiro-ide/hooks/state-validator.kiro.hook
kiro/src/target-config/kiro-ide/hooks/learnings-prompt.kiro.hook
```

### Modified Files
```
kiro/src/skills/aidlc-workflow-composition/SKILL.md (full rewrite)
kiro/src/skills/aidlc-stage-execution/SKILL.md (stage brief + return to composition + parallel contributors)
kiro/src/skills/aidlc-kickoff/SKILL.md (tool-based setup + team name)
kiro/src/skills/aidlc-orchestration/SKILL.md (team memory + session resume)
kiro/src/skills/common/aidlc-work-method/SKILL.md (state-manager usage + depth + template override + validation tools)
kiro/src/tools/workspace-setup.js (team structure + memory creation)
kiro/src/conventions/folder-structure.md (team namespace + memory)
kiro/src/stages/domain-design/definition.md (validation tools section)
kiro/src/stages/functional-design/definition.md (validation tools section)
kiro/src/personas/aidlc-systems-architect-agent.yaml (new skills attached)
kiro/src/personas/aidlc-architecture-reviewer-agent.yaml (validation tool awareness)
```

### Deleted Files
```
kiro/src/target-config/kiro-ide/hooks/process-checker.kiro.hook (replaced by state-validator)
```
