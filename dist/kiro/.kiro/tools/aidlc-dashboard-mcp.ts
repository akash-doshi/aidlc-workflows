#!/usr/bin/env bun
/**
 * aidlc-dashboard-mcp — the AI-DLC live dashboard, served as a Codex MCP-UI app.
 *
 * The FIRST AI-DLC-authored MCP server (Codex ships none by default). Local stdio,
 * zero external deps, newline-delimited JSON-RPC 2.0. Reads the workspace
 * `aidlc-docs/aidlc-state.md` via aidlc-lib and renders a live panel inside the
 * Codex app's MCP-app sandbox.
 *
 * Design: aidlc-docs/inception/application-design/* (dogfooded + arch-reviewer READY).
 * Contract validated on Bedrock via Excalidraw: tool result carries
 * `_meta.ui.resourceUri` → a `ui://` resource with MIME `text/html;profile=mcp-app`.
 *
 * Invariant: every field in DashboardState is derivable from aidlc-state.md.
 * No fabricated data ever leaves this server.
 *
 * Usage (Codex config.toml):
 *   [mcp_servers.aidlc-dashboard]
 *   command = "bun"
 *   args = ["{{HARNESS_DIR}}/tools/aidlc-dashboard-mcp.ts"]
 * Project dir resolves from AIDLC_PROJECT_DIR or process.cwd().
 */

import { readStateFile, getField, parseCheckboxes, loadStageGraph } from "./aidlc-lib.ts";

const UI_URI = "ui://aidlc/panel";
const MCP_UI_MIME = "text/html;profile=mcp-app";
const PHASES = ["Initialization", "Ideation", "Inception", "Construction", "Operation"] as const;

export interface DashboardState {
  initialized: boolean;
  project: string;
  phase: string;
  currentStage: string;
  status: string;
  nextStage: string;
  phases: { name: string; status: string }[];
  stages: {
    slug: string;
    state: string;
    suffix: string;
    number: string;
    name: string;
    phase: string;
    requires_stage: string[];
    produces: string[];
    consumes: string[];
  }[];
}

const EMPTY: DashboardState = {
  initialized: false,
  project: "",
  phase: "",
  currentStage: "",
  status: "",
  nextStage: "",
  phases: PHASES.map((name) => ({ name, status: "Pending" })),
  stages: [],
};

/** Compose existing aidlc-lib helpers — NO new state logic (AD2). */
export function readDashboardState(projectDir: string): DashboardState {
  let content: string;
  try {
    content = readStateFile(projectDir); // throws if missing → uninitialized
  } catch {
    return EMPTY;
  }
  // Join checkbox state with the stage-graph so each stage carries its phase,
  // number, and display name (the state file has only slug+state+suffix).
  let graph: ReturnType<typeof loadStageGraph> = [];
  try {
    graph = loadStageGraph();
  } catch {
    graph = [];
  }
  const bySlug = new Map(graph.map((n) => [n.slug, n]));
  const titleCasePhase = (p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  const lifecyclePhase = (getField(content, "Lifecycle Phase") ?? "").toUpperCase();

  const stages = parseCheckboxes(content).map((c) => {
    const node = bySlug.get(c.slug);
    return {
      slug: c.slug,
      state: c.state,
      suffix: c.suffix,
      number: node?.number ?? "",
      name: node?.name ?? c.slug,
      phase: node ? titleCasePhase(node.phase) : "",
      requires_stage: node?.requires_stage ?? [],
      produces: node?.produces ?? [],
      consumes: (node?.consumes ?? []).map((x) => x.artifact),
    };
  });

  // Phase status, derived authoritatively from the stages + the Lifecycle Phase
  // field. The "## Phase Progress" block in aidlc-state.md can lag behind the
  // actual run (e.g. after a jump), so we do NOT trust it: a phase whose stages
  // are all done/skipped is Verified; the phase matching Lifecycle Phase (or
  // holding the current in-progress/awaiting stage) is Active; the rest Pending.
  const phaseStatus = (name: string): string => {
    const inPhase = stages.filter((s) => s.phase === name);
    if (inPhase.length === 0) return "Pending";
    const hasCurrent = inPhase.some((s) => s.state === "in-progress" || s.state === "awaiting-approval" || s.state === "revising");
    const allSettled = inPhase.every((s) => s.state === "completed" || s.state === "skipped");
    const isLifecycle = name.toUpperCase() === lifecyclePhase;
    if (hasCurrent || isLifecycle) return "Active";
    if (allSettled) return "Verified";
    return "Pending";
  };

  return {
    initialized: true,
    project: getField(content, "Project") ?? "",
    phase: getField(content, "Lifecycle Phase") ?? "",
    currentStage: getField(content, "Current Stage") ?? "",
    status: getField(content, "Status") ?? "",
    nextStage: getField(content, "Next Stage") ?? "",
    phases: PHASES.map((name) => ({ name, status: phaseStatus(name) })),
    stages,
  };
}

// ---- panel HTML (UI resource). Host-theme only; no hardcoded brand color (AC2). ----
// Imported from a sibling so the server stays lean and the panel is independently testable.
import { PANEL_HTML } from "./aidlc-dashboard-panel.ts";

// ---- stdio JSON-RPC plumbing ----
function send(msg: unknown) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}
function ok(id: unknown, result: unknown) {
  send({ jsonrpc: "2.0", id, result });
}
function fail(id: unknown, code: number, message: string) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

const TOOL_META = {
  ui: { resourceUri: UI_URI },
  "ui/resourceUri": UI_URI,
  // Inline frame sizing (Codex clamps inline height to [min 200, max 720], default 240).
  // Request a taller default so the flow diagram is not stuck in a 240px scroll box.
  "openai/widgetHeightHint": 560,
  "openai/widgetMinFrameHeight": 320,
  "openai/widgetPrefersBorder": true,
};

function projectDir(): string {
  return process.env.AIDLC_PROJECT_DIR?.trim() || process.cwd();
}

export function handleRequest(req: any) {
  const { id, method, params } = req ?? {};
  switch (method) {
    case "initialize":
      return ok(id, {
        protocolVersion: params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "aidlc-dashboard", title: "AI-DLC Dashboard", version: "0.1.0" },
      });
    case "notifications/initialized":
      return;
    case "tools/list":
      return ok(id, {
        tools: [
          {
            name: "aidlc_dashboard",
            title: "AI-DLC Dashboard",
            description: "Show the live AI-DLC workflow state (phase, current stage, status, next stage) as a panel.",
            inputSchema: { type: "object", properties: {} },
            annotations: { readOnlyHint: true },
            execution: { taskSupport: "forbidden" },
            _meta: TOOL_META,
          },
        ],
      });
    case "tools/call": {
      if (params?.name !== "aidlc_dashboard") return fail(id, -32602, `Unknown tool: ${params?.name}`);
      const state = readDashboardState(projectDir());
      return ok(id, {
        content: [
          {
            type: "text",
            text: state.initialized
              ? `AI-DLC · ${state.phase} · ${state.currentStage} (${state.status})`
              : "AI-DLC workflow not initialized in this workspace.",
          },
        ],
        structuredContent: state,
        _meta: TOOL_META,
      });
    }
    case "resources/list":
      return ok(id, { resources: [{ uri: UI_URI, name: "AI-DLC dashboard panel", mimeType: MCP_UI_MIME }] });
    case "resources/read": {
      if (params?.uri !== UI_URI) return fail(id, -32602, `Unknown resource: ${params?.uri}`);
      return ok(id, { contents: [{ uri: UI_URI, mimeType: MCP_UI_MIME, text: PANEL_HTML }] });
    }
    case "ping":
      return ok(id, {});
    default:
      if (id !== undefined) fail(id, -32601, `Method not found: ${method}`);
  }
}

// Only run the stdio loop when executed directly (not when imported by tests).
if (import.meta.main) {
  let buf = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        handleRequest(JSON.parse(line));
      } catch {
        /* ignore malformed line */
      }
    }
  });
  process.stdin.on("end", () => process.exit(0));
}
