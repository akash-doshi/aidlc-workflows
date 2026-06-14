#!/usr/bin/env node
/**
 * validate-folder-structure.js — Validates that intent directory structure follows conventions.
 *
 * Checks:
 *   - Stage directories exist under the correct phase (inception/construction/operations)
 *   - Stage names match those in stage-graph.md
 *   - No stage directories at wrong level (e.g., stages/requirements-analysis/ instead of stages/inception/requirements-analysis/)
 *   - Construction stages are under a unit subdirectory
 *
 * Usage:
 *   node validate-folder-structure.js --intent <intent-dir>
 *
 * Exit codes:
 *   0 — Valid
 *   1 — Invalid
 *   2 — Usage error
 */

const fs = require("fs");
const path = require("path");

// --- Known stages by phase (from stage-graph.md) ---
const STAGES_BY_PHASE = {
  inception: [
    "reverse-engineering",
    "requirements-analysis",
    "story-generation",
    "wireframe-design",
    "domain-design",
    "units-generation",
    "contract-design",
  ],
  construction: [
    "functional-design",
    "nfr-design",
    "infrastructure-design",
    "code-generation",
  ],
  operations: [],
};

// All valid stage names (flat set)
const ALL_STAGE_NAMES = new Set(
  Object.values(STAGES_BY_PHASE).flat()
);

// Phases
const PHASES = new Set(Object.keys(STAGES_BY_PHASE));

// --- Helpers ---

function fail(message) {
  console.log(JSON.stringify({ valid: false, errors: [message] }));
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--intent" && argv[i + 1]) {
      args.intent = argv[++i];
    }
  }
  return args;
}

// --- Main ---

const args = parseArgs(process.argv.slice(2));

if (!args.intent) {
  console.error("Usage: node validate-folder-structure.js --intent <intent-dir>");
  process.exit(2);
}

if (!fs.existsSync(args.intent)) {
  fail(`Intent directory not found: ${args.intent}`);
}

const stagesDir = path.join(args.intent, "stages");
if (!fs.existsSync(stagesDir)) {
  fail("No stages/ directory found");
}

const errors = [];
const warnings = [];

// Check top-level entries under stages/
const topLevel = fs.readdirSync(stagesDir, { withFileTypes: true })
  .filter(e => e.isDirectory());

for (const entry of topLevel) {
  const name = entry.name;

  // Should be a phase directory
  if (PHASES.has(name)) {
    // Good — it's a phase. Check contents.
    const phaseDir = path.join(stagesDir, name);
    const phaseContents = fs.readdirSync(phaseDir, { withFileTypes: true })
      .filter(e => e.isDirectory());

    for (const stageEntry of phaseContents) {
      const stageName = stageEntry.name;

      if (name === "construction") {
        // Construction: expect unit directories, not stage directories directly
        // A unit directory contains stage subdirectories
        const unitDir = path.join(phaseDir, stageName);
        const unitContents = fs.readdirSync(unitDir, { withFileTypes: true })
          .filter(e => e.isDirectory());

        for (const unitChild of unitContents) {
          if (!STAGES_BY_PHASE.construction.includes(unitChild.name)) {
            warnings.push(`construction/${stageName}/${unitChild.name}: not a recognized construction stage`);
          }
        }
      } else {
        // Inception/operations: expect stage directories directly
        const validForPhase = STAGES_BY_PHASE[name] || [];
        if (!validForPhase.includes(stageName)) {
          errors.push(`stages/${name}/${stageName}: '${stageName}' is not a valid ${name} stage. Valid: [${validForPhase.join(", ")}]`);
        }
      }
    }
  } else if (ALL_STAGE_NAMES.has(name)) {
    // It's a stage name at the wrong level — should be under a phase
    const correctPhase = Object.entries(STAGES_BY_PHASE).find(([, stages]) => stages.includes(name));
    errors.push(`stages/${name}: stage directory at wrong level. Should be stages/${correctPhase ? correctPhase[0] : "??"}/${name}/`);
  } else {
    warnings.push(`stages/${name}: unrecognized directory (not a phase or known stage)`);
  }
}

// Result
const result = {
  valid: errors.length === 0,
  errors,
  warnings,
};

console.log(JSON.stringify(result, null, 2));
process.exit(errors.length === 0 ? 0 : 1);
