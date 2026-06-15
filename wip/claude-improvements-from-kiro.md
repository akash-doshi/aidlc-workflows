# Claude Code Improvements: Adding Kiro's Flexibility While Keeping Claude Code's Robustness

> Goal: Make Claude Code composable, flexible, and multi-intent without undermining its deterministic engine, state integrity, or audit trail.

---

## The Core Tension

Claude Code's engine philosophy (from its own source):

> "routing string-building to an LLM would invert the whole thesis"

The engine exists *because* the authors believe routing should not be LLM-decided. Kiro's flexibility comes from doing exactly that — the LLM reads markdown and decides order. These are architecturally opposed philosophies.

**This means:** You cannot make Claude Code "feel like Kiro" without replacing its engine. But you CAN add the *outcomes* of Kiro's flexibility (negotiable plans, many front doors, multi-intent, custom formats) through carefully scoped changes that work *with* the engine rather than against it.

---

## What Kiro Does Better (Target Properties)

1. **Conversational workflow composition** — the human shapes the plan through dialogue
2. **Many front doors** — designer starts with wireframes, PM starts with requirements, developer starts with code
3. **Flexible ordering** — "do wireframes before requirements" is a conversation, not a config edit
4. **Multi-intent coexistence** — multiple intents live in the same workspace without conflict
5. **Custom output formats** — swap a template file = change what the stage produces
6. **Lean document output** — human-readable summaries separate from machine-readable detail
7. **Low setup ceremony** — no bun, no AWS credentials, no 10 hooks to understand

---

## Recommended Changes (Least Invasive → Most Invasive)

### 1. Add a Composition Phase (Option C) — LOW effort, HIGH impact

**Problem:** Today, scope resolves → engine locks the stage plan → execution starts. No human negotiation of the plan.

**Solution:** Add conversational plan negotiation as part of the existing Ideation phase. The engine produces a *proposal*; the human amends it; the engine locks the amended plan.

**How it works:**

1. After `scope-definition` (stage 1.4) resolves the scope, a new interaction fires
2. The engine emits a new directive kind: `propose-plan`
3. The conductor presents the plan conversationally:

```
Based on your scope (feature), here's what I'm thinking:

1. Intent Capture → 2. Feasibility → 3. Scope Definition → 4. Requirements Analysis 
→ 5. User Stories → 6. Application Design → 7. Units Generation → 8. Delivery Planning 
→ 9. Functional Design → 10. Code Generation → 11. Build & Test

You can:
- Reorder: "Do wireframes before requirements"
- Skip: "Skip market research"
- Add: "Add refined mockups"
- Accept: "Looks good"
```

4. Human responds with amendments
5. Engine validates (are dependencies satisfied?) and writes `aidlc-docs/workflow-override.json`
6. From that point, `nextInScopeStage()` reads the override instead of the default scope ordering
7. Execution proceeds deterministically on the amended plan

**Files to change:**
- `aidlc-orchestrate.ts` — new `propose-plan` directive kind + override resolution
- `aidlc-directive.ts` — type definition for the new directive
- `skills/aidlc/SKILL.md` — handle the new directive in the forwarding loop
- New: `aidlc-docs/workflow-override.json` schema

**What this preserves:** Deterministic execution after lock. All hooks, sensors, state, swarm, audit.

**What this adds:** Human can negotiate plan upfront. Different people get different orderings.

---

### 2. Multi-Intent Coexistence (Option D) — MEDIUM effort, HIGH impact

**Problem:** Only one active workflow per workspace. Starting a second intent requires `--init --force` (wipes the first).

**Solution:** Namespace `aidlc-docs/` per intent.

**Current structure:**
```
aidlc-docs/
├── aidlc-state.md
├── audit.md
├── initialization/
├── ideation/
├── inception/
├── construction/
└── operation/
```

**Proposed structure:**
```
aidlc-docs/
├── .active-intent          ← pointer to current intent
├── intent-001-quiz-game/
│   ├── aidlc-state.md
│   ├── audit.md
│   ├── initialization/
│   ├── ideation/
│   └── ...
├── intent-002-auth-service/
│   ├── aidlc-state.md
│   ├── audit.md
│   └── ...
└── knowledge/              ← shared across intents (unchanged)
```

**Changes:**
- `resolveProjectDir()` in `aidlc-lib.ts` reads `.active-intent` to find the current intent directory
- `--init` creates a new numbered intent directory (auto-increment) without wiping
- `--list` (new utility) shows all intents with their status
- `--switch <intent-name>` changes the `.active-intent` pointer
- All tools that reference `aidlc-docs/aidlc-state.md` go through the resolver (already mostly true)
- `knowledge/` stays shared at the top level (team knowledge applies to all intents)

**What this preserves:** Everything internal to a single workflow. State, audit, hooks, sensors all work per-intent unchanged.

**What this adds:** Multiple intents coexist. Previous work is always accessible. `--switch` lets you context-switch.

---

### 3. Template/Format Customization Layer (Option E) — LOW effort, MEDIUM impact

**Problem:** Stage output formats are hardcoded in stage file `## Steps` sections. Teams can't easily say "we want requirements in Gherkin" without editing framework files.

**Solution:** A team-templates directory that stages check before using their hardcoded formats.

**How it works:**

1. Add `aidlc-docs/knowledge/templates/` (lives alongside team knowledge, committed to git)
2. Stage files get one paragraph added to their Steps section:

```markdown
### Step N: Check Team Templates
Before generating artifacts, check if `aidlc-docs/knowledge/templates/<this-stage-slug>/` 
exists. If it contains template files, use them as the output format instead of the 
default format described below. If no team templates exist, proceed with the default.
```

3. Practices-discovery stage gets a new question: "Do you have preferred formats for design documents? (e.g., Gherkin for requirements, C4 for architecture)"
4. If yes, the stage writes starter templates to `aidlc-docs/knowledge/templates/<stage-slug>/`

**What this preserves:** Default behavior unchanged for teams that don't customize.

**What this adds:** Teams swap formats by dropping files. Survives framework updates (lives in `aidlc-docs/knowledge/`, not `.claude/`).

---

### 4. Lean Document Output Mode — LOW effort, MEDIUM impact

**Problem:** Stages produce comprehensive prose documents. Teams don't read them.

**Solution:** Add a "summary-first" output convention. Each stage produces TWO tiers:

1. **Summary file** (`<artifact>-summary.md`) — one-page digest: tables, diagrams, key decisions. This is what humans read.
2. **Full file** (`<artifact>.md`) — comprehensive document as today. This is what downstream stages and the audit trail consume.

**Implementation:**
- Add a depth-sensitive instruction to stage files: "At Minimal and Standard depth, ALWAYS produce a `-summary.md` companion file alongside the full artifact. The summary must fit on one screen: key table, one mermaid diagram, 3-5 bullet decisions."
- The approval gate presents the summary first: "Review summary: `aidlc-docs/.../requirements-summary.md`. Full document at `requirements.md`."
- Sensors validate the full document; humans review the summary.

**What this adds:** A clear "start reading here" entry point for every stage output.

---

### 5. DAG-Aware Flexible Ordering (Option B) — HIGH effort, HIGH impact

**Problem:** `nextInScopeStage()` walks stages in numeric order (1.1, 1.2, ..., 4.7). This is the deepest source of rigidity.

**Solution:** Replace numeric sequencing with dependency-based sequencing.

**Current flow:**
```
nextInScopeStage("intent-capture", "feature") → "market-research" (always next numerically)
```

**Proposed flow:**
```
nextValidStages("intent-capture", "feature") → ["market-research", "feasibility", "scope-definition"]
// All three have their requires_stage satisfied. Engine picks one or asks.
```

**Changes:**
- `nextInScopeStage()` → `nextValidStages()`: returns all stages whose `requires_stage` dependencies are completed
- When exactly one valid stage → emit `run-stage` as today
- When multiple valid stages → emit `ask` directive: "Multiple stages are ready. Which next?" with options
- When zero valid stages + workflow not complete → error (should never happen if graph is valid)
- The `--stage` jump validates against `requires_stage` (can't jump to a stage whose dependencies aren't met)

**What this preserves:** Compiled graph, scope membership, sensors, state integrity, audit.

**What this adds:** True flexible ordering. The "wireframes before requirements" problem is solved at the engine level.

**Risk:** High. Many tools assume numeric ordering. Jump system, resume logic, status display all need updating. The `for_each: unit-of-work` per-unit fan-out assumes a specific Construction sequence.

---

## What You'll Never Get Without a Fundamental Rewrite

| Kiro Property | Why It Can't Be Added to Claude Code |
|---|---|
| **Mid-workflow adaptive recomposition** ("reassess before every stage") | The engine's thesis is that the plan is locked. Reassessment means the LLM overrides the engine mid-run — that's "inverting the thesis." |
| **Truly incremental plan-building** (approve one stage at a time, add the next after) | The scope system pre-commits the full stage list. Incremental building means the scope is unknown, which breaks the engine's read-the-state-emit-a-directive contract. |
| **LLM as orchestrator feel** (natural conversation driving execution) | The forwarding loop (`next → act → report → repeat`) is mechanical by design. Making it feel conversational means the LLM decides when to call `next`, which means the LLM owns routing. |
| **Zero-setup experience** | Bun + AWS Bedrock + 10 hooks + 25 tools + compiled graph is structural. Removing any of it reduces capability. |

---

## Implementation Priority

| Priority | Change | Effort | Impact | Risk to Robustness |
|----------|--------|--------|--------|-------------------|
| **P0** | Composition Phase (negotiate plan at start) | Low-Medium | High — solves "many front doors" + ordering | None (additive) |
| **P0** | Multi-Intent Coexistence | Medium | High — solves "second intent" problem | Low (path refactoring) |
| **P1** | Template Customization Layer | Low | Medium — solves "we format things differently" | None (additive) |
| **P1** | Lean Document Output (summary files) | Low | Medium — solves "nobody reads the docs" | None (additive) |
| **P2** | DAG-Aware Ordering | High | High — solves flexible ordering at the engine level | Medium (ordering assumptions everywhere) |

---

## Comparison: Effort to Make Each Flexible vs Robust

| Direction | Core Difficulty | Minimum Viable Change | Result Quality |
|-----------|----------------|----------------------|----------------|
| **Kiro + Robustness** (previous doc) | Easy. Tools enforce what LLM already decides. Add a state-manager.js (~250 lines) and you're 80% there. | 1 file + 1 hook upgrade | High — gets most of Claude Code's integrity guarantees |
| **Claude Code + Flexibility** (this doc) | Hard. Flexibility requires the engine to become negotiable, which fights its core thesis. Even the easiest option (Composition Phase) adds a new directive kind + override resolution. | New directive + override file + stage modification | Medium — gets plan negotiation but not mid-run adaptivity |

**The asymmetry is real:** Adding guardrails to a flexible system is easier than adding flexibility to a rigid system. Kiro's architecture accommodates robustness as an additive layer. Claude Code's architecture resists flexibility because flexibility is the thing it was built to prevent.

---

## Summary

The recommended path (P0 + P1) gives Claude Code:
- **Conversational plan negotiation** at workflow start (Composition Phase)
- **Multi-intent coexistence** without wiping previous work
- **Custom output formats** via team templates
- **Leaner documents** via summary-first convention

All without touching the deterministic engine's core loop, the swarm, the sensors, or the state machine. The engine stays authoritative — it just becomes negotiable at the *planning* stage rather than imposing a fixed plan from compile-time scope grids.
