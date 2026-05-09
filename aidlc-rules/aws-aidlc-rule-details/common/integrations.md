# Integrations (Dispatch Rules)

**Purpose**: Define how every stage uses external tool integrations (MCP servers, CLIs, service APIs) that the user activated during Integration Selection. This file is loaded at workflow start and provides the stage-agnostic decision rule that routes each stage's information needs to the right Active integration, without modifying individual stage files.

## Core Principles

1. **Capability-driven, not stage-driven**. Integrations declare *what information needs they serve*, not *which stages they belong to*. Stages describe *what information they need*; the model matches needs to capabilities at runtime.
2. **Non-blocking**. An integration failure or unavailability MUST NEVER prevent a stage from completing. Fall back to the default path and continue.
3. **No direct coupling**. Stage files MUST NOT reference specific integrations by name. Integration-specific logic lives only in `integrations/<name>/`.
4. **Active-only**. A stage may only use an integration whose status is `Active` in `aidlc-docs/aidlc-state.md`. Any other status means "not available for this session".

## Active Integrations

At the start of every stage, read `aidlc-docs/aidlc-state.md` → `## Integrations` to determine which integrations are `Active`. For each Active integration, load `integrations/<name>/<name>.md` if not already loaded. Review each file's `## Capabilities` section.

## Decision Rule

When a stage needs information to proceed (examples: "what components exist in this codebase?", "what is the design spec for screen X?", "what is the acceptance criterion for ticket Y?"), apply this decision rule:

1. **Identify the information need** in neutral terms.
2. **Match the need against the `## Capabilities` of each Active integration.**
3. **If a single integration's capabilities clearly cover the need**, use it as the primary source. Log the choice briefly in `audit.md` under the stage's interaction entry (e.g., "Used <integration> to satisfy need: <description>").
4. **If multiple integrations match**, prefer the one whose `## Authoritative For` list most specifically names the need.
5. **If no integration matches**, use the default path defined by the stage (filesystem scans, user prompts, workspace reads, etc.).
6. **If the chosen integration fails or returns empty**, fall back to the default path per the non-blocking rule.

## Applicability

Not every stage will have needs that integrations can serve. That is expected. The decision rule is a *check*, not a *requirement to use something*. If default-path behavior is sufficient for a step, no integration lookup is needed.

## Integration File Contract

Every file in `integrations/<name>/<name>.md` MUST contain these sections so the decision rule can function:

- `## Overview` — one paragraph summary of what the integration binds to.
- `## Preconditions` — what must be true for the integration to be usable (tool reachable, workspace matches, etc.).
- `## Capabilities` — bullet list of information needs this integration can serve, stated in neutral language (not in terms of AI-DLC stages). This is the list the decision rule matches against.
- `## Authoritative For` — optional subset of `## Capabilities` where this integration should be strongly preferred over defaults, even if the default path would also work.
- `## Tools` — the actual tool names, parameters, and invocation patterns the model should use.
- `## Usage Guidance` — anti-patterns and best practices (e.g., query ordering, narrowing).
- `## Failure Handling` — how errors are mapped to fallback behavior.

Integration files MUST NOT contain stage-specific hooks (e.g., "in Reverse Engineering Step 1.1, call tool X"). All stage-to-tool coupling happens at runtime via the decision rule above.

## Probes and Activation

Probes live in `integrations/<name>/<name>.opt-in.md` and run only during the Integration Selection stage. Stages other than Integration Selection MUST NOT probe, MUST NOT change integration status, and MUST NOT re-prompt the user about integrations. They only consume the status recorded in `aidlc-state.md`.

## Failure Handling

On any integration tool failure during a stage:

1. Log the failure in `audit.md` with the tool name, the information need that was being served, and the error.
2. Fall back to the default path.
3. If failures are persistent within the same stage or call pattern, update the integration's status in `aidlc-state.md` from `Active` to `Unavailable` and log the transition. Subsequent steps in the same session will skip that integration per the Active-only rule.

## Audit Trail

Every use of an integration MUST be reflected in `audit.md`:

- When an integration is consulted and used, log the information need and the integration's name.
- When an integration is consulted and rejected (capability match but result empty or error), log the fallback.

This is the only observable record of stage-agnostic integration usage and is what makes the system auditable despite the lack of per-stage hooks.
