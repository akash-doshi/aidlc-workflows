# Recommendations — Next Iteration

## 1. Hook-based State & Audit Management

Move state transitions and audit logging out of LLM instructions into deterministic hooks.

- Create a `state-manager.js` tool that validates and applies state transitions per the state-schema
- Trigger via `postToolUse` hook on write operations — when artifacts are written, state updates automatically
- Audit entries written by the hook, not the LLM — tamper-proof, consistent format, no fabrication risk
- Remove all "update state.json" and "write audit entry" instructions from persona skills — shorter prompts, fewer tokens
- State transition validation becomes programmatic — impossible to skip states or advance illegally
- Estimated token savings: reduced prompt size across all personas + eliminated state/audit reasoning and generation tokens on every transition

## 2. Adaptive Contributor Cycle

Make the contributor/reviewer cycle a composition-time decision based on intent complexity, not a fixed part of every stage.

- During workflow composition, the orchestrator assesses complexity and proposes a cycle mode:
  - **Full** — contributors + reviewer + iteration loop (enterprise, high-risk, regulated)
  - **Lean** — owner + reviewer only, no contributors (standard feature work)
  - **Solo** — owner only, human reviews directly (POC, spike, bugfix)
- The human can override in either direction ("add security review" / "skip reviews, this is a prototype")
- Default heuristic: greenfield multi-unit system → full, single-unit feature → lean, bugfix/POC → solo
- No new machinery — uses existing `autonomy` field in workflow.json, extended with cycle mode
- Reduces cost and time for simple intents without sacrificing rigour for complex ones

## 3. Skills to Port from Claude Code Implementation

Skills that add value without changing Kiro's architecture (stages remain stages, skills remain skills):

- **Practices discovery** — learn how the team/org works: coding standards, branching strategy, deployment patterns, testing conventions. Attached to systems-architect for brownfield reverse-engineering. Prevents the LLM from introducing patterns that clash with existing codebase conventions.
- **Delivery planning** — sequencing units, identifying critical path, estimating relative effort. Attached to app-architect at units-generation. Makes unit ordering deliberate rather than arbitrary.
- **Session cost awareness** — track token usage, know when context is getting large, summarise proactively. Common skill (auto-included). Keeps long workflows from hitting context limits silently.
- **Replay / session continuity** — reconstruct context from artifacts on resume. Formalise what's currently a one-liner in stage-execution into a proper skill the orchestrator uses when re-entering a workflow mid-flight.
- **Scope classification** — explicit patterns for bugfix vs feature vs POC vs enterprise intent. Attached to orchestrator. Makes right-sizing rules more reliable than the current prose heuristics in workflow-composition.
