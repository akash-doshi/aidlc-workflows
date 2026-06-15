# Long-Term Strategy: Which Architecture to Pursue

> Unbiased recommendation for a stable, long-term product that won't need replacing in 2 months.

**Verdict: Invest in the Kiro direction (flexible core + bolted-on robustness).**

---

## The Architectural Argument

The asymmetry discovered in the comparison isn't a coincidence — it reveals which architecture is more *extensible*:

- **Kiro's gaps are additive** — you add a state-manager tool, add hooks, add a team-memory directory. Nothing existing breaks. The flexible core remains intact while guardrails accumulate around it.

- **Claude Code's gaps are subtractive** — you need to *remove* rigidity. Loosen the engine. Make the compiled graph negotiable. Weaken the "engine owns all routing" contract. Every flexibility gain comes at the cost of something that currently provides robustness.

In software architecture terms: **Kiro is open for extension, Claude Code is closed for modification.** For a long-term product that will evolve over years, you want the system that's open for extension.

---

## The Product-Market Argument

The people using AI-DLC workflows are not all the same:

- Some teams are 2 people building a prototype
- Some teams are 50 people building a regulated system
- Some start with wireframes, others with documents, others with existing code
- Some want full ceremony, others want "just build it"

**A flexible system can serve all of these by adding layers of rigour on top.** A rigid system can only serve the high-ceremony case and asks everyone else to tolerate overhead they don't need.

Claude Code is built for the 50-person regulated case and asks the 2-person prototype team to accept 32 stages, bun, AWS credentials, and compiled graphs. That's a hard sell.

Kiro with the P0 improvements (state-manager + validation) serves the 2-person case natively *and* can scale to the regulated case by adding team-memory rules, review iterations, and contributor checks — all configured conversationally, not via config files.

---

## The LLM Evolution Argument

This is the argument that matters most for "not replacing in 2 months":

**LLMs are getting better at reasoning, not worse.** The trend over the next 1-2 years is:
- Better instruction following
- Longer reliable context windows
- Better tool use
- Better self-correction

Claude Code was designed *around* the assumption that LLMs can't be trusted with routing decisions — hence the deterministic engine. That assumption becomes less true every 6 months. An architecture built to compensate for LLM weakness becomes over-engineered as LLMs improve.

Kiro's architecture *trusts* the LLM with composition and routing, then uses simple tools as guardrails for the things that genuinely should be deterministic (state transitions, file existence). As LLMs improve:
- Kiro gets better automatically (the LLM makes better composition decisions, better stage outputs, fewer errors)
- Claude Code's engine becomes increasingly unnecessary overhead — the engine solves a problem that the LLM no longer has, but you're still paying for the complexity

**Build for where LLMs will be in 12 months, not where they were 12 months ago.**

---

## The Maintenance Argument

Claude Code today: 25 tools (TypeScript, bun), 10 hooks, compiled graphs, scope grids, 5-layer rule chains, sensor manifests, frontmatter schemas, swarm orchestration, worktree management. That's a large surface area to maintain, test, and debug.

Kiro with improvements: 3-4 tools (Node.js), 2-3 hooks, markdown files, JSON schemas. The complexity lives in the *skills* (prompt engineering, which is cheap to iterate on) rather than in *code* (which requires testing, versioning, and backwards compatibility).

When something breaks:
- In Claude Code: is it the engine? The graph? The scope-grid? The hook? The sensor? The state file format? A frontmatter field? You're debugging a compiled system.
- In Kiro: is it the skill instruction? The template? The state-manager rejecting a transition? You're debugging a much smaller surface.

---

## The Honest Caveat

Claude Code is better *today* for one specific case: a single team that runs the same workflow repeatedly, wants CI automation (`--test-run`), and values absolute reproducibility over flexibility. If that's your target user exclusively, Claude Code's maturity advantage matters.

But if you're building a product for diverse teams with diverse workflows, that needs to evolve with LLM capabilities, and that you don't want to rewrite in 6 months when the next model makes half the engine unnecessary — **Kiro's architecture is the right foundation.**

---

## The Recommendation

1. Take the Kiro implementation as the foundation
2. Implement P0 from `kiro-improvements-from-claude.md` (state-manager + validation hook) — this closes the robustness gap in ~1 week of work
3. Implement P1 (team-memory + template overrides) — this adds persistence
4. You now have a system that's flexible, robust, cheap, multi-repo, multi-intent, and maintainable — with ~500 lines of tooling rather than ~5000

That's the long-term stable product.

---

## Execution Roadmap

| Phase | What | Timeline | Outcome |
|-------|------|----------|---------|
| **Now** | Kiro as-is + P0 (state-manager, validation hook) | 1 week | Robust, flexible, working |
| **Next** | P1 (team-memory, template overrides, workflow lock) | 1 week | Persistent, customizable |
| **Then** | P2 (session resume, learnings hook) | 3-5 days | Self-improving, resilient |
| **Later** | P3 (cross-reference validation) | 1 week | Enterprise-grade traceability |
| **Future** | Parallel execution (if needed) | TBD | Multi-unit concurrency |

Total investment to reach "Kiro with Claude Code's robustness": ~3-4 weeks of work, ~500 lines of new tooling, zero architectural rework.

Compare: making Claude Code flexible requires touching the engine's core thesis, rewriting path resolution across 25 tools, and accepting that mid-workflow adaptivity is architecturally impossible without a rewrite.

---

## One-Line Summary

**Kiro's architecture is a foundation you build on. Claude Code's architecture is a monument you work around.**
