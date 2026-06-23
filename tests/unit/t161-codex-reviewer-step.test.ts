// t161-codex-reviewer-step: Codex conductor honors the §12a reviewer step.
//
// covers: file:skills/aidlc/SKILL.md
//
// The engine attaches `directive.reviewer` + `directive.reviewer_max_iterations`
// to every gated run-stage directive (aidlc-orchestrate.ts). Claude and Kiro
// conductors invoke the reviewer in their `gate: true` branch (§12a). The Codex
// conductor historically did NOT, so the v2 reviewer step silently no-op'd on
// Codex. This pins that the shipped Codex SKILL.md now contains the §12a step,
// at parity with the other harnesses.
//
// Mechanism: none — pure structural assertion over the shipped SKILL.md bytes.

import { describe, expect, test } from "bun:test";
import { REPO_ROOT } from "../harness/fixtures.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const codexSkill = readFileSync(
  join(REPO_ROOT, "harness", "codex", "skills", "aidlc", "SKILL.md"),
  "utf-8",
);

describe("Codex §12a reviewer step", () => {
  test("gate:true branch references the §12a reviewer step", () => {
    expect(codexSkill).toContain("Reviewer step (§12a)");
  });

  test("the reviewer step keys off directive.reviewer", () => {
    expect(codexSkill).toContain("directive.reviewer");
  });

  test("it honors the iteration cap", () => {
    expect(codexSkill).toContain("reviewer_max_iterations");
  });

  test("reviewer forms independent judgement (does not receive memory.md)", () => {
    // the §12a contract: pass artifacts/Q&A, NOT memory.md/plan.md
    const idx = codexSkill.indexOf("Reviewer step (§12a)");
    const step = codexSkill.slice(idx, idx + 800);
    expect(/NOT\s+`?memory\.md`?|not `memory.md`/i.test(step)).toBe(true);
  });
});
