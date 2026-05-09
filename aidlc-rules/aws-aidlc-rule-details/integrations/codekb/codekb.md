# CodeKB Integration

## Overview

CodeKB is a code knowledge base that parses a repository into a "space", extracts components (functions, classes, methods, variables), builds a call graph, generates summaries, and exposes the result through MCP tools. When Active, AI-DLC stages that need information about the codebase's structure, components, or call graph may satisfy those needs through CodeKB queries instead of filesystem scans.

This integration is **non-blocking**. On any failure, stages MUST fall back to the default path per `common/integrations.md`.

## Preconditions

- MCP server `code-knowledge-base` is reachable from the agent's runtime.
- An analyzed space exists that corresponds to the current workspace (matched by git remote or workspace path).
- The integration's status is `Active` in `aidlc-docs/aidlc-state.md`.

## Capabilities

This integration can answer the following information needs (expressed in neutral language; stage files do not reference these directly):

- What source-level components (functions, classes, methods, interfaces, variables, enums) exist in the analyzed codebase, and where are they defined?
- Which component is responsible for a given business concept, behavior, or natural-language description?
- What does a given component call? What calls a given component?
- What is the full call graph rooted at a given component, and what is the source of every function in that graph?
- What is the summary of the codebase in terms of component counts, language breakdown, and call-graph size?
- Is a given symbol (exact name or fuzzy pattern) defined in the codebase, and what is its source?

## Authoritative For

These information needs are best served by CodeKB over default paths, even when defaults would technically work:

- Semantic lookup by natural-language description ("where is authentication implemented", "what handles payment retries").
- Forward and reverse dependency queries at function/method granularity ("what calls this function", "what does this class depend on").
- Call-graph traversal from an entry point.

For other information needs — build configuration, infrastructure-as-code, deployment scripts, secrets, non-source files, git history, runtime behavior — CodeKB is NOT authoritative and stages should use their default paths.

## Tools

Tools are exposed by the `code-knowledge-base` MCP server. All component IDs use the form `<space_id>::<qualified_name>` and MUST be passed verbatim from prior tool output — never reconstructed.

**Setup and overview**:

- `load_knowledge_base(space_id)` — initialize shared state; call once per session before any query tool.
- `list_spaces()` — list analyzed spaces.
- `list_hyperspaces()` — list named groups of 2+ spaces.
- `get_space_details(space_id)` — full space metadata.
- `get_stats(space_id?)` — component totals, language breakdown, call-graph size.

**Semantic search (preferred first query)**:

- `get_component_from_description(query, n_results?, space_id? | space_ids? | hyperspace_id?)` — natural-language → ranked components with descriptions.

**Lookup**:

- `find_component(name)` — exact, case-sensitive.
- `search_components(pattern)` — wildcard `*`.
- `list_components(component_type?, space_id?)` — enumerate by kind.
- `show_component(name)` — full source, metadata, stored description.

**Flow and dependencies**:

- `show_dependencies(component)` — incoming (dependents) and outgoing (calls).
- `trace_flow(component, depth=10)` — recursive call tree from an entry point.
- `get_call_graph_with_source(component_id, depth=10)` — trace plus full source for every function in the graph.

## Usage Guidance

When satisfying an information need with CodeKB:

1. Call `load_knowledge_base(space_id)` once per session before any other query.
2. For natural-language needs, start with `get_component_from_description` rather than `list_components` or `search_components`. It returns ranked components with descriptions, which often removes the need for follow-up calls.
3. Drill in with the narrowest tool that answers the question:
   - Exact name known → `find_component` or `show_component`.
   - Fuzzy name → `search_components` with a `*` pattern.
   - "What calls X / what does X call" → `show_dependencies`.
   - "What happens when X runs" → `trace_flow` (start at depth 3–5, widen only if needed).
   - Deep analysis needing source for every callee → `get_call_graph_with_source` (high-cost; narrow the entry point first with `trace_flow`).

### Anti-patterns

- Calling `list_components()` without a filter as a first step — prefer `get_component_from_description`.
- Guessing component IDs instead of passing IDs returned by prior tool calls.
- Calling `get_call_graph_with_source` at default depth on a top-level entry point — narrow with `trace_flow` at depth 2–3 first.
- Skipping `load_knowledge_base` before other query tools.
- Echoing secret values that appear in returned source into user-facing summaries.

## Failure Handling

All failures are non-blocking per `common/integrations.md`. Specific patterns:

- **"No knowledge base loaded"** — call `load_knowledge_base(space_id)` and retry once.
- **Empty result from exact lookup** — drop to `search_components` with a wildcard, or `get_component_from_description` with a natural-language query.
- **Truncated output from `get_call_graph_with_source`** — reduce depth or pick a narrower entry point via `trace_flow`.
- **Transport errors on every call** — treat the integration as unavailable, update `aidlc-state.md` status from `Active` to `Unavailable`, log the transition in `audit.md`, and fall back to the default path.
- **Space becomes stale during the session** — continue using it but note the staleness in the relevant stage artifact.
