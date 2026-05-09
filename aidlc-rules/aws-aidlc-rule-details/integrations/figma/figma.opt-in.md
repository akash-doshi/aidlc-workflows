# Figma — Opt-In

**Integration**: Figma

## Description

Binds AI-DLC to a Figma MCP server (official remote server or a compatible local server). When Active, stages that need design specifications, design-system tokens, or Figma-to-code mappings can satisfy those needs by querying Figma directly instead of prompting the user for screenshots or prose descriptions.

Unlike repository-scoped integrations, Figma MCP has no "space" bound to the current workspace. Activation is session-based: if the MCP server is reachable and authenticated, the integration is usable whenever a stage needs design context.

## Probe

Executed by the Integration Selection stage. Do not run from any other stage.

```text
1. Reachability (silent):
   - Attempt a lightweight, read-only call to the configured Figma MCP server.
     Preferred: `whoami()` on remote servers (returns authenticated identity).
     Fallback: any tool the server advertises that does not require an active
     selection (e.g., a metadata/self-description call).
   - On transport or configuration error → Detected State: Unavailable
     Reason: "Figma MCP server not reachable"
     Return.
   - On authentication error → Detected State: Needs Setup
     Reason: "Figma MCP reachable but not authenticated"
     Continue to the opt-in prompt only if the user chose to configure
     Needs Setup integrations during Integration Selection.
   - On success → Detected State: Ready
     Reason: "Figma MCP reachable; authenticated as <user_or_identity>"
     Return.

2. No workspace match step.
   - Figma MCP is session-scoped, not repository-scoped. There is no space
     or file to pre-bind to the current workspace. The integration becomes
     useful when a stage has a design-related information need and the user
     supplies a selection or node ID at that time.
```

## Opt-In Prompt

Presented by the Integration Selection stage only when Detected State is `Needs Setup` and the user chose to configure it.

```markdown
## Figma — Authentication Required
The Figma MCP server is reachable but no authenticated session was detected. Figma MCP can answer questions about design specifications, design-system tokens, and Figma-to-code mappings when your agent is authenticated to Figma.

A) Yes — I'll authenticate now; resume once authentication is complete
B) No — skip Figma for this session
X) Other (please describe after [Answer]: tag below)

[Answer]: 
```

## Post-Prompt Logic

- **Option A**: Wait for the user to confirm authentication is complete, then re-run the reachability step. On success → `Active`. On timeout or user skip → `Unavailable` with reason "user declined to complete authentication".
- **Option B**: `Available` with reason "user declined".
- **Option X**: Treat free-form input as Option B unless the user clearly requests Option A.

## On Activation

When the user activates this integration during Integration Selection, load `integrations/figma/figma.md` in full and record under `## Integrations` in `aidlc-docs/aidlc-state.md`:

```markdown
| Figma | Active | Authenticated as <user_or_identity> | <ISO 8601 timestamp> |
```
