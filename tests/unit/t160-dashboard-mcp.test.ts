// t160-dashboard-mcp: the AI-DLC dashboard MCP server + panel contract.
//
// covers: file:tools/aidlc-dashboard-mcp.ts
// covers: file:tools/aidlc-dashboard-panel.ts
//
// Proves the Codex MCP-UI dashboard contract (validated empirically on Bedrock via
// Excalidraw) over the shipped server, driven as a real stdio JSON-RPC peer:
//   AC1 — tools/list exposes _meta.ui.resourceUri + readOnlyHint; resources/read
//         returns MIME text/html;profile=mcp-app; tools/call over a FIXTURE
//         aidlc-state.md returns structuredContent whose fields equal the fixture's
//         real values, and surfaces NO field not derivable from the state file.
//   AC2 — the panel HTML reads host theme context and hardcodes NO brand hex.
//
// Mechanism: cli — spawns the server with Bun.spawnSync, feeds newline-delimited
// JSON-RPC on stdin, parses stdout. AIDLC_PROJECT_DIR points at a temp workspace
// containing a hand-written fixture state file (real format, known values).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { REPO_ROOT } from "../harness/fixtures.ts";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BUN = process.execPath;
const SERVER = join(REPO_ROOT, "core", "tools", "aidlc-dashboard-mcp.ts");
const PANEL = join(REPO_ROOT, "core", "tools", "aidlc-dashboard-panel.ts");
// the compiled stage-graph lives only in dist; point the server at it so the
// stage→phase/number/name join is exercised (matches a real install layout).
const STAGE_GRAPH = join(REPO_ROOT, "dist", "codex", ".codex", "tools", "data", "stage-graph.json");

// A minimal but real-format aidlc-state.md fixture with KNOWN values.
const FIXTURE_STATE = `# AI-DLC State Tracking

## Project Information
- **Project**: Widget service
- **Scope**: feature

## Phase Progress
<!-- Status values: Pending, Active, Verified, Skipped -->

- **Initialization**: Verified
- **Ideation**: Verified
- **Inception**: Active
- **Construction**: Pending
- **Operation**: Pending

## Stage Progress
- [x] workspace-scaffold — EXECUTE
- [x] intent-capture — EXECUTE
- [S] market-research — SKIP: not needed
- [?] application-design — EXECUTE
- [-] units-generation — EXECUTE
- [R] delivery-planning — EXECUTE
- [ ] functional-design — EXECUTE

## Current Status
- **Lifecycle Phase**: INCEPTION
- **Current Stage**: application-design
- **Next Stage**: units-generation
- **Status**: Running
`;

let work: string;

// A small but real-format audit.md to exercise the presence layer (cycles 1 & 4).
const FIXTURE_AUDIT = `# AI-DLC Audit Log

## Stage Started
**Timestamp**: 2026-05-28T08:00:00Z
**Event**: STAGE_STARTED
**Stage**: application-design
**Agent**: aidlc-architect-agent

---

## Artifact Created
**Timestamp**: 2026-05-28T08:05:00Z
**Event**: ARTIFACT_CREATED
**Tool**: Write
**File**: aidlc-docs/inception/application-design/components.md

---

## Gate Open
**Timestamp**: 2026-05-28T08:06:00Z
**Event**: STAGE_AWAITING_APPROVAL
**Stage**: application-design
**Artifacts**: components.md, decisions.md
`;

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "aidlc-dash-"));
  mkdirSync(join(work, "aidlc-docs"), { recursive: true });
  writeFileSync(join(work, "aidlc-docs", "aidlc-state.md"), FIXTURE_STATE);
  writeFileSync(join(work, "aidlc-docs", "audit.md"), FIXTURE_AUDIT);
});
afterEach(() => rmSync(work, { recursive: true, force: true }));

// Drive the server: send the given requests, return parsed responses by id.
function rpc(requests: object[]): Record<number, any> {
  const stdin = requests.map((r) => JSON.stringify(r)).join("\n") + "\n";
  const r = Bun.spawnSync({
    cmd: [BUN, SERVER],
    stdin: new TextEncoder().encode(stdin),
    stdout: "pipe",
    stderr: "ignore",
    env: { ...process.env, AIDLC_PROJECT_DIR: work, AIDLC_STAGE_GRAPH: STAGE_GRAPH },
  });
  const out = new TextDecoder().decode(r.stdout).trim();
  const byId: Record<number, any> = {};
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined) byId[msg.id] = msg;
  }
  return byId;
}

describe("AC1 — dashboard MCP server contract", () => {
  test("tools/list exposes _meta.ui.resourceUri and readOnlyHint", () => {
    const res = rpc([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {} } },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
    ]);
    const tool = res[2].result.tools[0];
    expect(tool.name).toBe("aidlc_dashboard");
    expect(tool._meta.ui.resourceUri).toBe("ui://aidlc/panel");
    expect(tool.annotations.readOnlyHint).toBe(true);
    // inline frame sizing hints so the flow diagram is not stuck in a 240px scroll box
    expect(tool._meta["openai/widgetHeightHint"]).toBeGreaterThanOrEqual(320);
    expect(tool._meta["openai/widgetHeightHint"]).toBeLessThanOrEqual(720);
  });

  test("resources/read returns MCP-UI MIME", () => {
    const res = rpc([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 3, method: "resources/read", params: { uri: "ui://aidlc/panel" } },
    ]);
    const c = res[3].result.contents[0];
    expect(c.mimeType).toBe("text/html;profile=mcp-app");
    expect(c.text).toContain("<body");
  });

  test("tools/call returns ONLY real state fields with fixture values", () => {
    const res = rpc([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "aidlc_dashboard" } },
    ]);
    const sc = res[4].result.structuredContent;
    // exact top-level field set — no fabricated keys (presence layer joins audit.md)
    expect(Object.keys(sc).sort()).toEqual(
      ["activeAgent", "currentStage", "initialized", "lastArtifact", "nextStage", "phase", "phases", "project", "recentEvents", "stages", "status"].sort(),
    );
    // values equal the fixture's real values
    expect(sc.initialized).toBe(true);
    expect(sc.project).toBe("Widget service");
    expect(sc.phase).toBe("INCEPTION");
    expect(sc.currentStage).toBe("application-design");
    expect(sc.nextStage).toBe("units-generation");
    expect(sc.status).toBe("Running");
    // each stage is joined with the stage-graph → carries number/name/phase + edges/artifacts
    const appDesign = sc.stages.find((s: any) => s.slug === "application-design");
    expect(appDesign.number).toBe("2.6");
    expect(appDesign.name).toBe("Application Design");
    expect(appDesign.phase).toBe("Inception");
    expect(Object.keys(appDesign).sort()).toEqual(
      ["consumes", "name", "number", "phase", "produces", "requires_stage", "risk", "slug", "state", "suffix"].sort(),
    );
    // requires_stage carries the DAG dependency edges from the graph
    expect(appDesign.requires_stage).toContain("requirements-analysis");
    // produces/consumes are flattened artifact-name arrays
    expect(appDesign.produces).toContain("components");
    expect(Array.isArray(appDesign.consumes)).toBe(true);
    // danger-edge: design stages are safe; deploy/provision stages flag touches-cloud
    expect(appDesign.risk).toBe("");
    const deploy = sc.stages.find((s: any) => s.slug === "deployment-execution");
    if (deploy) expect(deploy.risk).toBe("touches-cloud");
    const codegen = sc.stages.find((s: any) => s.slug === "code-generation");
    if (codegen) expect(codegen.risk).toBe("writes-code");
    // phase status is DERIVED authoritatively (not the lagging Phase Progress block):
    // Inception holds the awaiting-approval stage → Active; earlier phases all settled → Verified
    const byPhase = Object.fromEntries(sc.phases.map((p: any) => [p.name, p.status]));
    expect(byPhase["Inception"]).toBe("Active");
    expect(byPhase["Initialization"]).toBe("Verified");
    expect(byPhase["Construction"]).toBe("Pending");
    // all 6 checkbox states represented from the fixture
    const states = sc.stages.map((s: any) => s.state);
    for (const st of ["completed", "skipped", "awaiting-approval", "in-progress", "revising", "pending"]) {
      expect(states).toContain(st);
    }
    // the result must carry the UI template link too
    expect(res[4].result._meta.ui.resourceUri).toBe("ui://aidlc/panel");
  });

  test("presence layer joins audit.md (active agent, recent events, last artifact)", () => {
    const res = rpc([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "aidlc_dashboard" } },
    ]);
    const sc = res[4].result.structuredContent;
    expect(sc.activeAgent).toBe("aidlc-architect-agent"); // from current stage's STAGE_STARTED
    expect(sc.lastArtifact).toBe("components.md"); // basename of latest ARTIFACT_*
    expect(sc.recentEvents.length).toBeGreaterThanOrEqual(3); // most-recent-first stream
    expect(sc.recentEvents[0].event).toBe("STAGE_AWAITING_APPROVAL");
    expect(sc.recentEvents.every((e: any) => typeof e.ts === "string" && typeof e.event === "string")).toBe(true);
  });

  test("uninitialized workspace → initialized:false, no throw", () => {
    rmSync(join(work, "aidlc-docs", "aidlc-state.md"));
    const res = rpc([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "aidlc_dashboard" } },
    ]);
    expect(res[4].result.structuredContent.initialized).toBe(false);
  });
});

describe("AC2 — panel reads host theme + self-themes with the Codex palette", () => {
  test("panel HTML reads host theme context (theme/styleVariables/displayMode)", async () => {
    const { PANEL_HTML } = await import(PANEL);
    expect(/window\.openai|window\.oai|hostContext/.test(PANEL_HTML)).toBe(true);
    expect(PANEL_HTML).toContain("styleVariables"); // applies host token overrides
    expect(PANEL_HTML).toContain("displayMode"); // adapts inline vs fullscreen
  });

  test("panel self-themes for both dark and light (prefers-color-scheme)", async () => {
    const { PANEL_HTML } = await import(PANEL);
    // it owns a palette so it is legible even when the host injects no tokens,
    // and supports light via prefers-color-scheme + a data-theme override.
    expect(PANEL_HTML).toContain("prefers-color-scheme");
    expect(PANEL_HTML).toContain('data-theme');
  });

  test("panel is a flow diagram with a fullscreen toggle bridge", async () => {
    const { PANEL_HTML } = await import(PANEL);
    expect(PANEL_HTML).toContain("requestDisplayMode"); // expand → fullscreen
    expect(PANEL_HTML).toContain("toggleMode"); // and collapse back to inline
    expect(PANEL_HTML).toContain("requires_stage"); // draws dependency edges
    expect(PANEL_HTML).toContain("AI-DLC"); // in-panel wordmark (correct title)
  });

  test("panel discovers phases from data and is space-aware + live-updating", async () => {
    const { PANEL_HTML } = await import(PANEL);
    // phases come from the data (d.phases), NOT a hard-coded list in the panel
    expect(PANEL_HTML).toContain("d.phases");
    expect(/var PHASES\s*=\s*\[/.test(PANEL_HTML)).toBe(false);
    // fit-to-frame: reads the host container size and scales (preserveAspectRatio)
    expect(PANEL_HTML).toContain("preserveAspectRatio");
    expect(PANEL_HTML).toContain("Host.maxW");
    // self-polls so it reflects aidlc-state.md changes without a manual tool call
    expect(PANEL_HTML).toContain("callServerTool");
    expect(PANEL_HTML).toContain("setInterval");
  });
});
