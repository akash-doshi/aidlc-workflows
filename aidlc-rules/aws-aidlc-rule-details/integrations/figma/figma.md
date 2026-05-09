# Figma Integration

## Overview

Figma MCP binds AI-DLC to Figma design files. When Active, stages that need information about design specifications, component hierarchies, design system tokens, or design-to-code mappings can satisfy those needs by querying Figma directly instead of asking the user to paste screenshots or describe designs manually. The integration also supports reading code-to-design mappings (Code Connect) and, on supported remote servers, writing back to the Figma canvas.

Supported Figma MCP servers include the official remote server and local alternatives that expose a compatible tool surface.

This integration is **non-blocking**. On any failure, stages MUST fall back to the default path per `common/integrations.md`.

## Preconditions

- A Figma MCP server is reachable from the agent's runtime (remote HTTPS endpoint, stdio, or a compatible local server).
- The user is authenticated to Figma (remote server) or has a valid access token configured (local servers).
- A design context is available: either an active Figma selection, or a Figma URL / node ID the user or a prior step provided.
- The integration's status is `Active` in `aidlc-docs/aidlc-state.md`.

## Capabilities

This integration can answer the following information needs (expressed in neutral language; stage files do not reference these directly):

- What is the visual design and layout for a given Figma selection, frame, or node (component hierarchy, layer names, positions, sizes)?
- What design-system tokens (variables, styles, colors, typography) does a given selection use?
- What code component (if any) is mapped to a given Figma node, per Code Connect?
- What Figma nodes exist that are candidates for mapping to a given code component?
- What does a given selection look like as a screenshot?
- What rules should an agent follow to translate designs into frontend code consistent with this file's design system?
- What components, variables, or styles in a linked design library match a given text query (remote servers only)?
- What is the structured content of a FigJam diagram that captures system architecture, user flow, or process design?

## Authoritative For

These information needs are best served by Figma MCP over default paths, even when defaults would technically work:

- Design specifications for frontend components — hierarchy, props implied by design, sizing, spacing, typography.
- Design-system token resolution — colors, spacing scales, typography ramps, named styles.
- Code Connect mappings that link Figma nodes to already-existing code components.

For other information needs — backend behavior, data models, infrastructure, requirements traceability, build configuration — Figma MCP is NOT authoritative and stages should use their default paths.

## Tools

Tool names below follow the official Figma MCP surface. Local or third-party servers may expose a subset; call only tools your configured server advertises.

**Context extraction**:

- `get_design_context(...)` — primary tool. Returns the design context for the active selection or a specified node.
- `get_metadata(...)` — sparse XML of a selection: layer IDs, names, types, positions, sizes. Useful for quick hierarchy exploration before a deeper fetch.
- `get_variable_defs(...)` — variables and styles used by the current selection.
- `get_screenshot(...)` — raster image of the current selection.
- `get_figjam(...)` — XML representation of a FigJam diagram.

**Design-system and mappings**:

- `create_design_system_rules(...)` — emits a rule file giving the agent context for translating designs into frontend code.
- `get_code_connect_map(...)` — existing Figma-node-to-code mappings.
- `get_code_connect_suggestions(...)` — suggested mappings for a code component (Figma-prompted).
- `add_code_connect_map(...)` — record a Figma-node-to-code mapping.
- `send_code_connect_mappings(...)` — commit suggestions returned by `get_code_connect_suggestions`.
- `search_design_system(...)` *(remote only)* — search libraries for components, variables, or styles matching a query.

**Canvas operations (remote only, authoring)**:

- `use_figma(...)` — general-purpose create / edit / inspect across a Figma file.
- `create_new_file(...)` — new blank Design or FigJam file in the authenticated user's drafts.
- `generate_diagram(...)` — generate a FigJam diagram from Mermaid syntax.
- `generate_figma_design(...)` *(specific clients only)* — generate design layers from interfaces.

**Session**:

- `whoami()` *(remote only)* — returns the authenticated user identity. Useful as a lightweight reachability/auth probe.

Refer to the Figma MCP documentation for full parameter details. If the server exposes additional tools not listed here, they MAY be used following the same non-blocking rules.

## Usage Guidance

When satisfying an information need with Figma MCP:

1. Start narrow. For most frontend-design questions, call `get_design_context` on the active selection or a user-provided node ID first — it returns rich context that usually removes the need for follow-up calls.
2. Use `get_metadata` for cheap hierarchy exploration before pulling full context from large selections.
3. Resolve tokens through `get_variable_defs` rather than inferring colors or spacing from pixel measurements.
4. When the user asks to "use the existing component" for a design node, check `get_code_connect_map` first; fall through to `get_code_connect_suggestions` only when no mapping exists.
5. Prefer library search (`search_design_system`) over ad-hoc naming assumptions when matching a design intent to design-system primitives.
6. Screenshots (`get_screenshot`) are a last resort for communicating context to the user — they do not carry tokens or hierarchy and should not be the primary input to code generation.
7. Tool calls are rate-limited by Figma plan. Batch related questions and avoid redundant calls.

### Anti-patterns

- Asking the user to paste screenshots or describe designs in prose when Figma MCP is Active and a selection or node ID is available.
- Inventing design-token names; always resolve through `get_variable_defs` or `search_design_system`.
- Writing to the Figma canvas (`use_figma`, `create_new_file`, `generate_figma_design`, `generate_diagram`, `add_code_connect_map`, `send_code_connect_mappings`) without explicit user intent — these mutate user assets.
- Relying on `get_design_context` on a stale selection without confirming the user's current focus.
- Calling tools the configured server does not expose (the official local server lacks remote-only tools like `whoami`, `use_figma`, `search_design_system`).

## Failure Handling

All failures are non-blocking per `common/integrations.md`. Specific patterns:

- **Not authenticated / session expired** — ask the user to re-authenticate, or fall back to the default path (prompt the user for the design details directly).
- **No active selection and no node ID provided** — ask the user for a Figma URL or node ID; if they cannot provide one, fall back to the default path.
- **Rate-limit exceeded** — log the failure in `audit.md`, update `aidlc-state.md` status from `Active` to `Unavailable` for the remainder of the session, and fall back to the default path.
- **Transport or configuration errors on every call** — treat the integration as unavailable, update status, log, and fall back.
- **Tool not found on the configured server** — a remote-only tool was attempted against a local server (or vice versa). Do not retry; try an equivalent supported tool or fall back.
- **Canvas-mutation failure** (write-path tools) — never retry blindly; surface the error to the user and await confirmation before any retry.
