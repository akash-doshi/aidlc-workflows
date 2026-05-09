# CodeKB — Opt-In

**Integration**: CodeKB

## Description

Binds AI-DLC to the `code-knowledge-base` MCP server. When Active, stages that need information about source-level components, dependencies, or call graphs can satisfy those needs via structured queries instead of filesystem scans. Most useful for brownfield projects; on greenfield projects the workspace-match step below will typically fail, resulting in `Needs Setup` or `Unavailable` status.

## Probe

Executed by the Integration Selection stage. Do not run from any other stage.

```text
1. Reachability (silent):
   - Attempt a lightweight call to the `code-knowledge-base` MCP server
     (e.g., list_spaces()).
   - On transport or configuration error → Detected State: Unavailable
     Reason: "MCP server `code-knowledge-base` not reachable"
     Return.
   - On success → continue.

2. Workspace match (silent):
   - Derive repository identity from the workspace
     (git remote URL if present, otherwise absolute workspace path).
   - Call list_spaces() and compare against the repository identity.
   - If a matching space is found → Detected State: Ready
     Reason: "Matched space `<space_id>`"
     Record the matched space_id for use on activation.
     Return.
   - If no matching space is found → Detected State: Needs Setup
     Reason: "MCP reachable but no analyzed space matches this repository"
     Continue to the opt-in prompt only if the user chose to configure
     Needs Setup integrations during Integration Selection.
```

## Opt-In Prompt

Presented by the Integration Selection stage only when Detected State is `Needs Setup` and the user chose to configure it.

```markdown
## CodeKB — Setup Required
The CodeKB MCP server is reachable, but this repository has not been analyzed yet. CodeKB can answer questions about components, dependencies, and call graphs through structured queries instead of filesystem scans.

A) Yes — I'll analyze this repository into CodeKB now; resume once analysis is complete
B) No — skip CodeKB for this session
X) Other (please describe after [Answer]: tag below)

[Answer]: 
```

## Post-Prompt Logic

- **Option A**: Wait for the user to confirm analysis is complete, then re-run the workspace match step. On success → `Active`. On timeout or user skip → `Unavailable` with reason "user declined to complete setup".
- **Option B**: `Available` with reason "user declined".
- **Option X**: Treat free-form input as Option B unless the user clearly requests Option A.

## On Activation

When the user activates this integration during Integration Selection, load `integrations/codekb/codekb.md` in full and record under `## Integrations` in `aidlc-docs/aidlc-state.md`:

```markdown
| CodeKB | Active | Matched space `<space_id>` | <ISO 8601 timestamp> |
```
