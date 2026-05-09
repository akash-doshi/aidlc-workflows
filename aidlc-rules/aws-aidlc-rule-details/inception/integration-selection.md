# Integration Selection

**Purpose**: Discover available integrations, probe for reachability, and let the user choose which to activate for the session. This is the first user-facing stage of any AI-DLC workflow.

**Execute when**: Once per workflow run, as the very first stage — before Workspace Detection and every other stage.

**Skip when**: No integrations are defined under `integrations/` (the directory is empty or missing). In that case, record an empty `## Integrations` section in `aidlc-state.md` (creating the file if it does not yet exist) and proceed.

**Rerun behavior**: If `aidlc-state.md` already contains an `## Integrations` section from a prior run, skip the probes and prompts and resume with the previously recorded statuses. The user may explicitly request a rerun by asking to re-select integrations.

## Prerequisites

None. This stage runs first.

- `common/integrations.md` must be loaded (it defines the integration file contract this stage relies on). The core workflow loads it with other common rules before any stage executes.

## Step 1: Discover Integrations

List all subdirectories under `integrations/`. For each subdirectory `<name>/`:

1. Confirm `<name>.opt-in.md` exists. If missing, skip the integration and log a warning in `audit.md`.
2. Load `<name>.opt-in.md`. Do NOT load `<name>.md` yet — it is loaded only on activation.
3. Extract from `<name>.opt-in.md`:
   - A short description of the integration
   - The probe logic
   - The opt-in prompt (if any)

## Step 2: Run Probes

For each discovered integration, execute its probe per its `<name>.opt-in.md`:

1. **Test reachability** silently. If the tool is unreachable or unconfigured, mark the integration as `Unavailable` with a brief reason (e.g., "MCP server not configured", "CLI not in PATH"). Do NOT prompt the user.
2. **Workspace match check.** If the probe defines a workspace-match step (e.g., "is there an analyzed space for this repo?"), run it. If a match is found without user input, mark the integration as `Ready`. If the probe requires context the probe itself can gather (git remote, workspace path, file presence), the probe is responsible for gathering it without prompting.
3. **Record probe results** in a working list. Do not write to `aidlc-state.md` yet.

## Step 3: Present Selection

Present a single combined message to the user listing every discovered integration, its detected state, and an action the user can take. Use this format:

```markdown
# 🔌 Integration Selection

The following integrations are available for this project. Select which to activate for this session.

| # | Integration | Detected State | Notes |
|---|---|---|---|
| 1 | [name] | [Ready / Needs Setup / Unavailable] | [short reason] |
| 2 | ... | ... | ... |

**Guidance**:
- **Ready** — tool is reachable and matches this workspace; confirm to activate.
- **Needs Setup** — tool is reachable but requires one-time setup (e.g., analyze this repo). The integration's prompt will follow.
- **Unavailable** — tool is not reachable or not configured. Cannot be used this session.

Which integrations would you like to activate?

A) Activate all **Ready** integrations
B) Activate all **Ready** plus set up any **Needs Setup** integrations now
C) Select individually (I will ask one by one)
D) Skip integrations for this session
X) Other (please describe after [Answer]: tag below)

[Answer]: 
```

**CRITICAL**: After presenting this message, WAIT for the user's response. Do not proceed to any other stage until the user has answered. This is a hard interaction gate even though it is not an "approval gate" in the traditional sense.

### Step 3.1: Handle "Needs Setup" integrations

For each integration in the `Needs Setup` state that the user opted to configure (Options B or C), present the integration-specific opt-in prompt from its `<name>.opt-in.md`. Wait for the user's answer. Apply the probe's post-prompt logic to determine if the integration becomes `Ready` or stays `Unavailable`.

### Step 3.2: Handle individual selection

For Option C, iterate through integrations that are `Ready` or `Needs Setup` and ask the user a simple yes/no per integration. Skip anything that is `Unavailable`.

## Step 4: Activate Selected Integrations

For each integration the user activated:

1. Load `integrations/<name>/<name>.md` in full.
2. Set its status to `Active`.

For each integration not activated (declined or `Unavailable`):

1. Do NOT load `<name>.md`.
2. Record the appropriate status (`Unavailable`, or `Available` if the user declined a ready-to-use integration).

## Step 5: Record in aidlc-state.md

This stage runs before Workspace Detection and therefore before `aidlc-state.md` is populated with project details. If the file does not exist yet, create it with only the `## Integrations` section populated; Workspace Detection will fill in the remaining fields in the next stage.

```markdown
## Integrations

| Integration | Status | Reason | Probed At |
|---|---|---|---|
| [name] | [Active / Available / Unavailable] | [short reason or match detail] | [ISO 8601 timestamp] |
| ... | ... | ... | ... |
```

Status values:

- **Active** — loaded and usable this session; stages will match information needs against its capabilities.
- **Available** — reachable and matched this workspace, but the user declined activation. Not used this session.
- **Unavailable** — not reachable, not configured, or setup incomplete.

## Step 6: Log and Proceed

1. Log the entire selection interaction in `audit.md` with complete raw user input and timestamps. Create `audit.md` if it does not yet exist.
2. Present a short completion message as its OWN standalone message (not batched with the next stage):

```markdown
# 🔌 Integration Selection Complete

- **Active**: [list, or "none"]
- **Available but declined**: [list, or "none"]
- **Unavailable**: [list, or "none"]

Proceeding to **Workspace Detection**.
```

3. Automatically proceed to Workspace Detection. **No approval gate** — this is a configuration stage, not an artifact-producing one. However, the selection question in Step 3 IS an interaction gate; the model MUST have received the user's selection response before reaching this step.
