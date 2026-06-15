# The Case for Keeping Claude Code

> A steel-man argument for why Claude Code's architecture may be the right long-term bet, despite its rigidity costs.

---

## The Core Thesis: LLMs Are Unreliable Orchestrators

The previous strategy document assumes LLMs will keep getting better at reasoning and self-direction. But there's a counter-argument that's equally valid:

**LLMs are unreliable in ways that don't improve linearly.** They:
- Hallucinate with high confidence
- Drift from instructions as context grows
- Make different decisions on the same input across runs (non-deterministic)
- Degrade under load (context window pressure)
- Can't be unit-tested (their "logic" isn't inspectable)

Claude Code's engine was built on the premise that **routing should never be a language task** — it should be a data task. That's not a bet against LLM improvement. It's a bet that *some things should never be left to probability*, no matter how good the model gets.

---

## Argument 1: Reproducibility Is a Product Requirement, Not a Nice-to-Have

When a customer runs `/aidlc feature` on Monday and again on Wednesday with the same intent, they expect the same workflow. With Kiro:

- The LLM might compose a different stage order
- It might skip a stage it included last time
- It might ask different composition questions
- The "conversational flexibility" becomes "unpredictable behavior" when you need consistency

Claude Code guarantees: same scope + same state = same directive. Always. This is testable, assertable, and CI-automatable.

**For enterprise customers:** "We ran your framework and got different results each time" is a support ticket that kills trust. Claude Code never generates that ticket.

---

## Argument 2: The "LLMs Will Get Better" Bet Is Risky

The previous document says "build for where LLMs will be in 12 months." But:

- **Nobody knows where LLMs will be in 12 months.** Scaling laws may plateau. Reasoning improvements may stall. The next frontier might be speed/cost, not capability.
- **Kiro's architecture bets the product on model quality.** If the model has a bad day (degraded API, rate limits, a regression in a model update), Kiro's orchestration degrades because the orchestrator IS the model.
- **Claude Code's architecture is model-independent for routing.** The engine works identically whether the LLM is Opus, Sonnet, or a future model. Only the *execution quality within stages* depends on model capability — not whether the right stage fires next.

A model regression in Kiro = wrong stages fire, state gets corrupted, workflow derails.
A model regression in Claude Code = stage outputs are lower quality, but the workflow still proceeds correctly.

**Which failure mode would you rather explain to a customer?**

---

## Argument 3: The "Flexibility" Kiro Provides Is Often Unnecessary

Ask yourself: how often does a team *actually* want a different stage order?

- Most teams run requirements → design → code. Every time.
- The "wireframes before requirements" case is real but rare — and Claude Code handles it with `--stage`.
- The "many front doors" argument sounds compelling in a pitch deck but in practice, teams settle into a pattern within 2 weeks and never deviate.

What teams *actually* want:
1. Skip stages that don't apply (Claude Code: scopes handle this)
2. Get to code faster (Claude Code: `bugfix` and `poc` scopes)
3. Not repeat themselves (Claude Code: learnings system handles this)

**Kiro's flexibility solves a problem that's more theoretical than practical.** Claude Code's scopes solve the *real* problem (right-sizing) with tested, deterministic answers.

---

## Argument 4: 25 Tools Is a Feature, Not a Bug

The maintenance argument against Claude Code ("25 tools to debug") flips when you consider:

- **Each tool is independently testable.** `aidlc-state.ts` has unit tests. `aidlc-graph.ts` has unit tests. `aidlc-orchestrate.ts` has a differential corpus that proves it emits correct directives.
- **Kiro's "simplicity" is untestable.** How do you unit-test "the LLM will compose the right workflow"? You can't. You're relying on vibes.
- **Code is debuggable. Prompts are not.** When a state transition fails in Claude Code, you read a stack trace. When a state transition fails in Kiro, you read a chat log and guess what the LLM was thinking.

The 25 tools aren't complexity — they're **reified decisions**. Each one is a decision that used to live in LLM prose and now lives in inspectable, testable, versionable code. That's engineering maturity, not over-engineering.

---

## Argument 5: The Swarm Is a Genuine Differentiator

Kiro is strictly sequential. Claude Code can fan out N units in parallel via the swarm. For a real-world system with 5-10 units of work:

- Kiro: 5 units × 4 construction stages × ~10 minutes each = **3+ hours sequential**
- Claude Code: 5 units in parallel × 4 stages × ~10 minutes = **~40 minutes**

That's not a theoretical advantage — it's a 5x speedup for the most expensive phase of the workflow. As systems get more complex (more units), the gap widens.

You cannot add parallelism to Kiro without building... an engine. At which point you're rebuilding Claude Code.

---

## Argument 6: The Learnings System Compounds Value Over Time

Claude Code's §13 learnings ritual means:
- Run 1: the team corrects "always use Result<T,E> instead of exceptions"
- Run 2: that correction is already in `aidlc-project-learnings.md`, automatically applied
- Run 10: the system has accumulated 30+ team-specific rules and never makes those mistakes again

Kiro has no equivalent. The "team-memory" proposal in the improvements doc is a manual append-to-file process that depends on the LLM remembering to ask. Claude Code's approach is:
- **Automatic** — the ritual fires after every gated stage
- **Validated** — learnings are conflict-checked against org rules before persistence
- **Structured** — NEVER/ALWAYS format, dated, attributable

This is genuine institutional knowledge capture. Over 6 months of use, a Claude Code installation becomes *deeply* tailored to the team. A Kiro installation stays at baseline unless someone manually maintains `team-memory/preferences.md`.

---

## Argument 7: Sensors Catch What LLMs Miss

Claude Code's sensors run after every stage:
- `required-sections` — does the output have the expected structure?
- `upstream-coverage` — does it reference all consumed upstream artifacts?
- `linter` — is any generated code syntactically valid?
- `type-check` — does TypeScript code compile?

These are deterministic quality gates that catch LLM output errors before the human sees them. In Kiro, if the LLM produces a requirements doc missing the NFR section, nobody catches it until a human (who won't read it anyway) reviews it.

**Sensors are the automated QA layer for LLM outputs.** Kiro has nothing equivalent and the proposed "artifact-validator" in the improvements doc is a single existence check, not content validation.

---

## Argument 8: CI/Automation Is Table Stakes for Enterprise

Claude Code's `--test-run` flag means the entire workflow can run in CI without human interaction. This enables:
- Automated regression testing of the framework itself
- "Run AI-DLC on every PR" workflows
- Benchmark comparisons across model versions
- Headless execution in pipelines

Kiro's architecture fundamentally requires human interaction (the composition conversation). You can't CI-automate a system that asks "Am thinking: Requirements → Stories → Domain Design. Good to go?" and waits for a response.

For enterprise adoption, headless/CI execution is not optional — it's a procurement checkbox.

---

## Argument 9: The Maturity Gap Is Real and Expensive to Close

Claude Code today: 32 stages, 11 agents, 9 scopes, 10 hooks, 25 tools, sensors, rules, knowledge bases, swarm, worktrees, learnings, session cost tracking, replay, outcomes pack, 40+ docs.

Kiro today: 11 stages, 8 agents, 0 scopes, 1 hook, 2 tools, no sensors, no rules, no swarm, no learnings.

The "3-4 weeks to close the gap" estimate in the Kiro improvements doc is optimistic for P0-P1. But it doesn't account for:
- The swarm (months of work, if ever)
- CI/headless mode (requires rethinking the composition conversation)
- Sensors with content validation (requires schema definitions per artifact)
- Knowledge loading per agent (requires building the knowledge base)
- Session cost tracking, replay, outcomes pack
- The 40+ pages of documentation

Choosing Kiro means accepting that you're 6+ months behind on features that Claude Code ships today. "Simple" and "incomplete" are not the same thing.

---

## Argument 10: The Engine Can Be Made Negotiable (It's Not Impossible)

The previous document frames Claude Code as rigid forever. But Option C (Composition Phase) is genuinely low-effort and solves the biggest flexibility complaint:

1. Add a `propose-plan` directive (one new kind, ~50 lines)
2. The conductor presents the plan conversationally
3. Human amends it
4. Engine validates and locks the amended plan
5. Execution proceeds deterministically

This gives you "many front doors" + "flexible ordering" + "conversational feel" while keeping deterministic execution, sensors, swarm, CI mode, and state integrity. It's not a rewrite — it's one new interaction before the main loop.

**Claude Code + Composition Phase = flexibility where it matters (planning) + rigour where it matters (execution).**

---

## The Counter-Recommendation

If the goal is a long-term stable product:

1. **Keep Claude Code as the foundation** — it has 6+ months of hard-won engineering, tested edge cases, and enterprise-grade features
2. **Add Option C** (Composition Phase) — solve the flexibility problem at the planning stage (~1 week)
3. **Add Option D** (Multi-Intent) — solve the second-intent problem (~2 weeks)
4. **Add Option E** (Template Layer) — solve the custom format problem (~3 days)
5. **Add summary-first output** — solve the "nobody reads docs" problem (~3 days)

Total: ~4 weeks. Same timeline as "improve Kiro." But you start from a complete, tested, enterprise-ready system rather than a minimal skeleton that needs everything built.

---

## When to Choose Which

| If your primary customer is... | Choose |
|---|---|
| Enterprise teams needing audit trails, CI automation, reproducibility | Claude Code |
| Diverse teams with varying workflows who value low ceremony | Kiro |
| Teams that run the same workflow repeatedly and want it to learn | Claude Code |
| Teams building prototypes or doing exploratory work | Kiro |
| A product that must work headlessly in pipelines | Claude Code |
| A product that must feel natural and conversational | Kiro |
| A team with strong DevOps that will maintain 25 tools | Claude Code |
| A small team that wants to iterate on prompts, not code | Kiro |

---

## One-Line Summary

**Claude Code is a finished car that needs a better GPS. Kiro is a great GPS that needs a car built around it.**

The question is: is it faster to add navigation to a running vehicle, or to build a vehicle around a navigation system?
