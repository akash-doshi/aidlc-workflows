#!/usr/bin/env bash
# Stability batch runner for AIDLC CLI-adapter evaluation.
#
# Runs WAVES x PER_WAVE evaluations as sequential waves of concurrent runs.
# Each run is fully isolated (PID-stamped run folder, per-run rules clone,
# per-workspace harness dist), so concurrency is safe. The only shared resource
# is Bedrock — we grep each session log for throttling so harness-induced
# correlated failures can be told apart from genuine AIDLC variance.
#
# Usage:
#   ADAPTER=claude-cli WAVES=2 PER_WAVE=5 SCOPE=mvp scripts/stability_batch.sh
#   ADAPTER=kiro-cli   WAVES=2 PER_WAVE=5 SCOPE=mvp scripts/stability_batch.sh
set -u

cd "$(dirname "$0")/.." || exit 1
export PATH="$HOME/.bun/bin:$PATH"

ADAPTER=${ADAPTER:-claude-cli}
SCOPE=${SCOPE:-mvp}
WAVES=${WAVES:-3}
PER_WAVE=${PER_WAVE:-7}
# Bedrock region for the run (codex-cli's gpt-5.x map is enabled in us-east-1).
REGION=${REGION:-us-west-2}
LOGDIR="/tmp/aidlc-stability-${ADAPTER}-$(date -u +%Y%m%dT%H%M%S)"
mkdir -p "$LOGDIR"
echo "Batch runner: adapter=$ADAPTER scope=$SCOPE — $WAVES waves x $PER_WAVE concurrent = $((WAVES*PER_WAVE)) runs"
echo "Per-run logs: $LOGDIR"

run_one() {
  local tag="$1"
  uv run python run.py cli --cli "$ADAPTER" \
    --scope "$SCOPE" \
    --vision test_cases/sci-calc-v2/vision.md \
    --tech-env test_cases/sci-calc-v2/tech-env.md \
    --golden test_cases/sci-calc-v2/golden-aidlc-docs \
    --openapi test_cases/sci-calc-v2/openapi.yaml \
    --scorer-model global.anthropic.claude-opus-4-6-v1 \
    --region "$REGION" \
    > "$LOGDIR/$tag.log" 2>&1
  echo "  [$tag] finished (exit=$?)"
}

for w in $(seq 1 "$WAVES"); do
  echo ""
  echo "=== WAVE $w/$WAVES starting at $(date -u +%H:%M:%S) ==="
  for i in $(seq 1 "$PER_WAVE"); do
    run_one "w${w}-r${i}" &
  done
  wait
  echo "=== WAVE $w/$WAVES complete at $(date -u +%H:%M:%S) ==="
done

echo ""
echo "=== throttle / Bedrock error scan ==="
grep -rilE "throttl|ThrottlingException|TooManyRequests|429|ServiceUnavailable|internalServerException" "$LOGDIR" \
  | sed "s#$LOGDIR/##" || echo "  none detected"

echo ""
echo "=== ALL WAVES DONE — log dir: $LOGDIR ==="
echo "$LOGDIR" > /tmp/aidlc-stability-last-logdir.txt
