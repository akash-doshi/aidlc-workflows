# 2. Structure: Stages, Personas, Skills, Conventions, and Tools

## Overview

AI-DLC v2 has five building blocks:

```
┌─────────────────────────────────────────────────────────────────┐
│  SDLC: Made up of many stages                                   │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ Requirements     │  │ User Stories     │  ...  Code Gen      │
│  └──────────────────┘  └──────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stage Contains:                                                │
│                                                                 │
│  • Input Artifacts (what it needs to start)                     │
│  • Output Artifacts (what it produces)                          │
│  • Owner (persona responsible for producing)                    │
│  • Contributors (personas that review/challenge the owner)      │
│  • Reviewer (persona that quality-gates the output)             │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐     ┌─────────────────────────────┐
│  Owners, Contributors,       │     │  Conventions                │
│  Reviewers ARE Personas      │     │                             │
│  (agents)                    │     │  • Templates (output format)│
│                              │     │  • Folder structure         │
│  Personas HAVE Skills        │     │  • State schema             │
│  (to perform tasks using     │     │  • Audit schema             │
│   inference or tools)        │     │  • Workflow schema          │
└──────────────────────────────┘     └─────────────────────────────┘
```

## Stages

A stage is one step in the development workflow. It lives at `.kiro/stages/<stage-name>/`.

```
stages/
├── requirements-analysis/
│   ├── definition.md        ← what this stage does, inputs, outputs, owner, contributors, reviewer
│   └── templates/           ← starting format for output artifacts
│       └── requirements.md
├── domain-design/
│   ├── definition.md
│   └── templates/
│       ├── components.yaml
│       └── components.md
└── stage-graph.md           ← dependency graph (what can follow what)
```

A stage definition declares:
- **Description** — what this stage accomplishes
- **Inputs** — what artifacts it needs (flexible — "any of" not "all required")
- **Outputs** — what artifacts it produces
- **Owner** — which persona leads the work
- **Contributors** — which personas provide feedback (optional)
- **Reviewer** — which persona quality-gates (optional)
- **Validation Tools** — which tools the reviewer runs (optional)

## Personas

A persona is an AI agent with a specific expertise and behavioural stance. It lives at `src/personas/<name>.yaml` and gets compiled to `.kiro/agents/<name>.json`.

```yaml
name: aidlc-product-manager-agent
description: >
  Product Owner — the voice of the customer and the business.
behaviour: |
  - Every requirement must deliver user or business value
  - Ambiguity is the enemy
  - Scope discipline matters
associated-skills:
  - aidlc-requirements-analysis-skill
  - aidlc-user-empathy-skill
```

A persona:
- Has a **name** (identity)
- Has a **behaviour** (how it thinks, what it values)
- Has **associated skills** (domain expertise it carries into any stage)
- Can play three roles: **owner** (produces), **contributor** (challenges), **reviewer** (gates)

## Skills

A skill is reusable domain expertise attached to a persona. It lives at `.kiro/skills/<skill-name>/SKILL.md`.

```markdown
---
name: aidlc-feasibility-skill
description: |
  The skill of assessing technical feasibility...
---

# Feasibility Assessment

## When Applied
- During workflow composition when the orchestrator asks "is this feasible?"
- During requirements analysis when a requirement implies challenging work

## Assessment Dimensions
1. Technical Viability
2. Integration Risk
...
```

A skill:
- Is NOT tied to a stage — it's tied to a persona
- Can be applied in multiple stage contexts
- Teaches the persona **how to think** about a domain
- Contains methodology, not implementation

**Special skills:**
- `common/aidlc-work-method/` — how to work through any stage (plan, clarify, produce, refine)
- `common/aidlc-prioritization/` — how to prioritize decisions
- `aidlc-orchestration/` — how the orchestrator works
- `aidlc-workflow-composition/` — how to compose workflows
- `aidlc-stage-execution/` — how to drive stage execution

## Conventions

Conventions define formats and structure. They live at `.kiro/conventions/`.

| File | What it defines |
|------|----------------|
| `folder-structure.md` | Where everything lives on disk |
| `state-schema.json` | Format of `state/state.json` |
| `audit-schema.json` | Format of `audit/audit.json` |
| `workflow-schema.json` | Format of `workflow.json` |
| `transitions.json` | Legal state transitions (the state machine) |
| `question-format.md` | How clarification questions are formatted |

## Tools

Tools are deterministic Node.js scripts that handle operations the LLM shouldn't do by hand. They live at `.kiro/tools/`.

| Tool | Purpose | Called by |
|------|---------|-----------|
| `state-manager.js` | State transitions, output registration, validation | Orchestrator + personas |
| `workflow-manager.js` | Workflow plan management (add stage, set depth) | Orchestrator only |
| `workspace-setup.js` | Create intent directory skeleton | Orchestrator (kickoff) |
| `validate-domain-model.js` | Validate components.yaml | Reviewer persona |
| `validate-entities.js` | Validate entities.yaml | Reviewer persona |
| `validate-rules.js` | Validate rules.yaml | Reviewer persona |
| `validate-folder-structure.js` | Validate directory conventions | State-validator hook |

## How They Connect

1. The **orchestrator** reads `stage-graph.md` and composes a workflow with the human
2. For each approved stage, it calls `workflow-manager.js` + `state-manager.js`
3. It invokes the stage's **owner persona** as a sub-agent
4. The persona reads the stage `definition.md`, applies its **skills**, follows the **work-method**, writes outputs per **conventions**
5. The persona calls `state-manager.js` for transitions
6. If **contributors** are assigned, they're invoked in parallel
7. If a **reviewer** is assigned, it reviews (running **validation tools** if listed)
8. The orchestrator presents to the human (if supervised) or auto-advances (if guided/autonomous)
9. The **learnings hook** captures user choices to `team-memory/`
10. Back to composition for the next stage
