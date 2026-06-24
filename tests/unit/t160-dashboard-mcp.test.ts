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

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "aidlc-dash-"));
  mkdirSync(join(work, "aidlc-docs"), { recursive: true });
  writeFileSync(join(work, "aidlc-docs", "aidlc-state.md"), FIXTURE_STATE);
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
    // exact top-level field set — no fabricated keys
    expect(Object.keys(sc).sort()).toEqual(
      ["currentStage", "initialized", "nextStage", "phase", "phases", "project", "stages", "status"].sort(),
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
      ["consumes", "name", "number", "phase", "produces", "requires_stage", "slug", "state", "suffix"].sort(),
    );
    // requires_stage carries the DAG dependency edges from the graph
    expect(appDesign.requires_stage).toContain("requirements-analysis");
    // produces/consumes are flattened artifact-name arrays
    expect(appDesign.produces).toContain("components");
    expect(Array.isArray(appDesign.consumes)).toBe(true);
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

  test("uninitialized workspace → initialized:false, no throw", () => {
    rmSync(join(work, "aidlc-docs", "aidlc-state.md"));
    const res = rpc([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "aidlc_dashboard" } },
    ]);
    expect(res[4].result.structuredContent.initialized).toBe(false);
  });
});

describe("AC2 — panel is host-themed, no hardcoded brand color", () => {
  test("panel HTML references host theme context", async () => {
    const { PANEL_HTML } = await import(PANEL);
    expect(/window\.openai|window\.oai|hostContext/.test(PANEL_HTML)).toBe(true);
  });

  test("panel HTML contains no hardcoded brand hex", async () => {
    const { PANEL_HTML } = await import(PANEL);
    // the Codex brand/status literals must NOT appear — colors come from host tokens
    expect(/#339cff|#00a240|#e25507|#e02e2a|#0d0d0d|#1a1c1f/i.test(PANEL_HTML)).toBe(false);
  });

  test("panel is a flow diagram with a fullscreen-request bridge", async () => {
    const { PANEL_HTML } = await import(PANEL);
    expect(PANEL_HTML).toContain("requestDisplayMode"); // expand → fullscreen
    expect(PANEL_HTML).toContain("requires_stage"); // draws dependency edges
    expect(PANEL_HTML).toContain("AI-DLC"); // in-panel wordmark (correct title)
  });
});
