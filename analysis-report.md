# AI-DLC v2 Skills Implementation — Analysis Report

## 1. Inconsistencies

### 1.1 State schema doesn't document `--scope` state key pattern

`aidlc-state-schema.md` §2 "State key" documents two patterns:
- Inception: `<skill-name>`
- Construction (per-unit): `<skill-name>:<unit-name>`

The `--scope` flag introduces a third: `<skill-name>:<scope-name>` (e.g. `reverse-engineering:repo-a`). Process-checker handles it, but the state schema doesn't mention it. A builder reading only the schema wouldn't know this exists.

### 1.2 Orchestrator protocol §5 doesn't mention `--scope`

Section 5 documents `--unit` differences. No equivalent for `--scope`. The orchestrator LLM must also read the workflow format doc to understand scoped skills.

### 1.3 Wireframes output directory nesting: `wireframes/wireframes/`

The wireframes skill writes visual files to a `wireframes/` subdirectory inside its own output folder (`inception/wireframes/`). Result: `inception/wireframes/wireframes/<screen>.svg`. This double-nesting is confusing. Consider renaming the visual subdirectory to `screens/` or `visuals/`.

### 1.4 Folder structure shows `code/` but skill name is `code-generation`

The folder structure convention shows `construction/<unit>/code/` for code-generation artifacts. Process-checker resolves paths using the skill name (`code-generation`), so it would look in `construction/<unit>/code-generation/`. One is wrong — likely the folder structure doc needs updating to `code-generation/`.

### 1.5 Application-design validation spec missing `screen-data-map.md` as upstream

The SKILL.md lists `screen-data-map.md` as optional input, but `validation-spec.md` only lists `requirements.md`, `stories.md`, `personas.md` as upstream. The validator won't check consistency with wireframe data unless the spec is updated.

### 1.6 `aidlc-` prefix translation is implicit

Workflow files use bare names (`requirements-analysis`). Skill folders use `aidlc-requirements-analysis`. Process-checker translates with `aidlc-${stageName}`. This works but is undocumented — a contributor creating a skill without the prefix would break process-checker silently.

### 1.7 Code-generation doesn't list `nfr-design-patterns.md` or `logical-components.md` as input

Code-generation's SKILL.md says it implements patterns from `cross-cutting.md`, but doesn't reference `nfr-design-patterns.md` (which defines the actual patterns to implement — circuit breakers, caching, etc.) or `logical-components.md`. These should be listed as optional inputs since code-gen needs to implement them.

### 1.8 Code-generation doesn't list wireframe artifacts as input

For frontend code generation, `screen-structure.md`, `screen-data-map.md`, and `wireframe-guidance.md` are the primary inputs for the frontend layers. The SKILL.md doesn't mention them.

### 1.9 Infrastructure-design doesn't list `business-rules.md` in validation spec upstream

The SKILL.md lists `business-logic-model.md`, `domain-entities.md` as input but the validation spec only lists them as "if present." The SKILL.md implies they're required prerequisites.

### 1.10 Inconsistent "stories" terminology in units-generation

`units-of-work.md` output says "Stories — which story IDs this unit implements (includes both primary-owned and contributing stories)" but `units-of-work-story-map.md` is the authoritative source for primary vs contributing. The Stories field in `units-of-work.md` is redundant and could drift from the story map.

---

## 2. Potential Hiccups / Issue Points

### 2.1 Bootstrap runs outside process_checker — no enforcement

If `intent-bootstrap` produces invalid output (malformed state file, missing audit), the error only surfaces when `workflow-composition` triggers process_checker. The error message won't point to bootstrap as the root cause.

### 2.2 Large context window pressure on later skills

The orchestrator includes in every builder invocation: builder protocol, SKILL.md, validation-spec, folder structure, input files, step context. For infrastructure-design or code-generation, the upstream artifact list is enormous (10+ files). This could exceed context limits, causing the builder to miss instructions or produce incomplete output.

### 2.3 Validation report machine-readable block is fragile

The `---PROCESS-CHECK-DATA---` block is parsed with exact string matching. Extra whitespace, markdown formatting, or trailing content after the block will break parsing. The fallback regex is less reliable.

### 2.4 Code-generation writes to workspace root — process_checker can't verify code

Process-checker's `checkExecution()` looks for artifacts relative to the skill output directory. Code lives in the workspace root. Only `CODE_SUMMARY.md` and `code-generation-plan.md` are verifiable by process-checker. The actual generated code is unverified by the enforcement mechanism.

### 2.5 No mechanism for "go back to a previous skill"

The orchestrator can "insert a skill mid-execution" per workflow-composition rule 5, but there's no documented mechanism for how this interacts with process_checker. Does the orchestrator edit `workflow.md`? Process-checker re-reads it, but the checkpoint cursor might be stale.

### 2.6 Per-unit state files vs single intent-state.md

Folder structure shows `<unit-name>-state.md` files, but state schema and process-checker only reference `intent-state.md` with `<skill>:<unit>` keys. It's unclear when per-unit state files are used. They may be vestigial from an earlier design.

### 2.7 Wireframes visual file validation is hard for an LLM validator

Validation rule 10 says "Visual wireframe files must be well-formed (valid SVG or valid HTML)." An LLM validator can check this textually but can't render and visually verify. There's no deterministic script in `scripts/` to validate SVG/HTML structure. This rule may produce false passes.

### 2.8 Code-generation's execution model conflicts with the standard loop

Code-gen's "On each invocation" model (find first unchecked layer, generate, build, test) implies multiple builder invocations within a single execution step. But the standard loop has one `execution:pending → execution:complete` transition. Either code-gen runs all layers in one invocation (risky for context), or it needs a different state model (layer-by-layer with intermediate states).

### 2.9 Workflow-composition examples reference skills that don't exist yet

Examples reference `build-and-test` which is still 🚧. If the LLM follows an example and includes it in the workflow, process-checker will fail when it can't find the skill folder.

---

## 3. Verbosity Reduction Opportunities

### 3.1 Repeated "Do not ask about..." clauses across skills

Every inception skill repeats "do not ask about tech stack / infrastructure / deployment." Builder protocol rule 4 ("Scope-by-phase") already covers this generically. ~2-3 lines per skill could be removed.

### 3.2 Identical "Validation" footer in every SKILL.md

Every skill ends with the same two sentences pointing to `validation-spec.md` and the validator protocol. Could be stated once in the catalogue or builder protocol.

### 3.3 Repeated brownfield context clause

Multiple skills repeat the brownfield availability statement. Builder protocol rule 6 already covers this.

### 3.4 Validation spec "Inputs" section partially duplicates SKILL.md "Input" section

Both list upstream artifacts. The overlap is ~60-80%. Could be consolidated into one authoritative list.

### 3.5 Workflow-composition has 9 detailed examples (~150 lines)

Could be condensed to 4-5 representative examples. The full set could live in a separate reference file for edge cases.

### 3.6 Question guidance repeats "Analyse X first. Derive what you can; ask only where..."

This preamble appears in nearly every skill. Could be a single builder protocol rule: "Always analyse inputs before generating questions. Ask only where genuine ambiguity remains."

---

## 4. Optimization Opportunities

### 4.1 Build script could validate cross-references

Currently validates JSON and frontmatter fields only. Could additionally check:
- Every skill in CATALOGUE.md has a corresponding folder
- Every validation-spec "Inputs" upstream artifact references a real skill output
- Folder structure convention matches actual skill output definitions

### 4.2 Generated skill-registry.json for fast flag lookup

The orchestrator and process-checker must parse SKILL.md frontmatter to read flags. A build-time generated `skill-registry.json` would eliminate markdown parsing at runtime.

### 4.3 Process-checker could validate skill folder existence at setup

Currently fails late (at validation time) when it can't find `validation-spec.md`. An early check during the setup step would fail fast with a clear error.

### 4.4 Deterministic scripts for wireframes and code-generation

Wireframes could have a `scripts/validate-svg.sh` that checks SVG well-formedness. Code-generation could have a `scripts/verify-build.sh` that confirms the build passes. These would give process-checker something concrete to verify beyond LLM judgment.

### 4.5 Artifact path resolution could support subdirectories

Process-checker currently resolves bare filenames relative to the skill output dir. Wireframes needs `wireframes/<screen>.svg` and code-gen's chunks need subdirectory paths. Supporting relative paths (not just bare filenames) in the Artifacts column would fix this cleanly.

---

## 5. Unclear Instructions

### 5.1 When does the orchestrator write `— : complete`?

The protocol says it writes complete "after verification approval, or directly from `validation : pass` when `artefact-verification: "false"`." But the loop shows `process_checker(skill-complete)` as a separate step. Unclear whether the orchestrator writes complete before or after the final process_checker call.

### 5.2 What happens when `human-clarification: "false"` and no questions are needed?

Builder protocol says "produce the question file with a brief note explaining why no questions were needed if the skill convention requires it." Which skills require it? All? None? Ambiguous.

### 5.3 How does the orchestrator determine input file paths?

The workflow file lists them, but for the first skill after bootstrap, paths reference files that `intent-bootstrap` just created. The orchestrator must know the intent directory path — returned by intent-bootstrap but not explicitly documented as a handoff variable.

### 5.4 Retry scope for code-generation after validation failure

Code-gen has layers with checkpoints. If validation fails, does the builder re-generate all layers or just fix the failing one? The builder protocol §2.5 says "fix the issues identified" but code-gen's layer model makes this ambiguous.

### 5.5 What "presenting artifacts to the human" means

The protocol says "present artifacts, wait for approval" but doesn't specify format — file paths? Contents? Summary? Left to LLM judgment, which may be inconsistent.

### 5.6 How does the orchestrator handle wireframes' "go back to stories" request?

Wireframes' question guidance says to flag missing story coverage. If the human says "add it," the orchestrator should go back to user-stories. But the mechanism (edit workflow.md? insert a skill?) isn't specified.

### 5.7 NFR-design is listed as optional prerequisite for infrastructure-design

Infrastructure-design says "NFR design should be complete (if applicable)." But when is it not applicable? If nfr-design ran, its outputs are mandatory inputs. If it didn't run (skipped in workflow), infrastructure-design must work without them. The "if present" handling needs to be explicit in the validation spec.

---

## 6. Potential for Misunderstanding

### 6.1 "Stage" vs "Skill" vs folder name — triple naming

- Stage: `requirements-analysis` (human-facing, state file, workflow file)
- Skill: `aidlc-requirements-analysis` (folder name, invokeSubAgent)
- Display: "requirements analysis stage" (chat)

Contributors must mentally map between all three.

### 6.2 `per-unit: "false"` construction skill (`build-and-test`)

The only construction skill that doesn't use `--unit`. What flag does it use in workflow.md? `--phase construction`? Nothing? Not documented.

### 6.3 Catalogue shows `plan-verification: "n/a"` but SKILL.md uses `"false"`

The catalogue display value `n/a` doesn't match the actual frontmatter value `"false"`. Could confuse someone reading the catalogue vs the SKILL.md.

### 6.4 Validation rule numbering must be sequential integers

Process-checker counts rules by matching `^\d+\.` and expects the RULES line to contain `1,2,3,...,N`. Sub-rules (1a, 1b) or gaps in numbering would break the count. Not prohibited anywhere but would cause silent failures.

### 6.5 Artifacts column can't represent subdirectory paths

State schema says "bare filenames only." But wireframes produces `wireframes/login.svg` (a relative path within the output dir). Listing just `login.svg` can't be resolved. Listing `wireframes/login.svg` violates "bare filenames." This needs a decision.

### 6.6 "Contributing units" in story map is new — downstream skills don't reference it

Functional-design reads `units-of-work-story-map.md` to know which stories are "mapped to this unit." But the story map now has primary vs contributing. Does functional-design run for contributing stories too, or only primary? The SKILL.md says "stories mapped to this unit" without distinguishing.

---

## 7. Things That May Confuse a Human

### 7.1 Questions presented one-at-a-time in chat vs all-at-once in file

The question format says "present one at a time in chat" but "save all to file at once." If the human answers in the file, they might miss chat presentation. If they answer in chat, the file needs updating. The handoff is implicit.

### 7.2 Artifacts live outside the project directory

Design docs go to `org-ai-kb/aidlc-docs/intent-<nnn>/`, not the project repo. Easy to miss — humans expect docs in their repo.

### 7.3 30+ approval touchpoints for a full workflow

With all flags at default, each skill requires: answer questions + approve plan + approve artifacts = 3 touchpoints × 10 skills = 30 minimum. Could feel overwhelming. The workflow-composition skill can reduce this by overriding flags, but the default is maximum involvement.

### 7.4 No definition of what "approve" means

When artifacts are presented for verification, what constitutes approval? Detailed review? Quick glance? The system doesn't guide the human on what to look for or how deep to go.

### 7.5 Audit trail grows unbounded

For complex intents with retries, the audit file could be hundreds of lines. No summary view, no filtering. Useful for post-mortem but not for real-time orientation.

### 7.6 Trigger phrase ambiguity

README says "Using AI-DLC, ..." to activate. Skill description says it activates on any development prompt. Unclear whether the phrase is required or just one option.

### 7.7 No visual progress indicator

No dashboard or progress bar. The human must read the state file to know where they are in a 10+ skill workflow. The orchestrator could present a progress summary between skills, but this isn't specified.

### 7.8 Code-generation produces code outside aidlc-docs — where exactly?

The skill says "Application source code in the workspace (not in aidlc-docs/)" but doesn't specify the exact path within the workspace. Is it the workspace root? A `src/` folder? The unit's "Code organization strategy" from units-of-work.md? The human might not know where to look.
