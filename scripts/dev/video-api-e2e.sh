#!/bin/bash
# Video pipeline over HTTP on a real (protected) Vercel deployment, as a fresh guest:
# guest session -> POST /api/jobs (video) -> poll -> Range request on the MP4.
# usage: scripts/dev/video-api-e2e.sh <deployment-url> <input-image-asset-id> [preset] [resolution] [duration]
set -u
DEP=$1; ASSET=$2; PRESET=${3:-slow-push-in}; RES=${4:-1080p}; DUR=${5:-5}
JAR=$(mktemp)
vc() { npx --yes vercel@latest curl "$1" --deployment "$DEP" --yes -- -s -b "$JAR" -c "$JAR" "${@:2}" 2>/dev/null; }

echo "guest: $(vc /api/auth/guest -X POST | grep -o '"ok":[a-z]*')"
SUBMIT=$(vc /api/jobs -X POST -H 'content-type: application/json' \
  -d "{\"vertical\":\"video\",\"modelId\":\"camera_motion\",\"presetId\":\"$PRESET\",\"inputAssetId\":\"$ASSET\",\"aspect\":\"16:9\",\"resolution\":\"$RES\",\"durationS\":$DUR}")
JOB=$(echo "$SUBMIT" | grep -o '"id":"[0-9a-f-]*"' | head -1 | cut -d'"' -f4)
echo "submit: job=$JOB $(echo "$SUBMIT" | grep -o '"status":"[a-z]*"' | head -1) $(echo "$SUBMIT" | grep -o '"balanceTenths":[0-9]*')"
[ -n "$JOB" ] || { echo "$SUBMIT"; exit 1; }
START=$(date +%s)
while true; do
  POLL=$(vc "/api/jobs?ids=$JOB")
  ST=$(echo "$POLL" | grep -o '"status":"[a-z]*"' | head -1 | cut -d'"' -f4)
  PR=$(echo "$POLL" | grep -o '"progress":[0-9]*' | head -1 | cut -d: -f2)
  echo "  $(( $(date +%s) - START ))s: $ST $PR%"
  case "$ST" in succeeded|failed|canceled) break;; esac
  [ $(( $(date +%s) - START )) -gt 280 ] && { echo "TIMEOUT"; break; }
  sleep 3
done
echo "final: $(echo "$POLL" | grep -o '"errorCode":[^,]*') $(echo "$POLL" | grep -o '"source":"[a-z]*"') $(echo "$POLL" | grep -o '"balanceTenths":[0-9]*')"
URL=$(echo "$POLL" | grep -o '"url":"/media/renders/[^"]*\.mp4"' | head -1 | cut -d'"' -f4)
if [ -n "$URL" ]; then
  echo "media: $URL"
  vc "$URL" -r 0-99 -D - -o /dev/null | grep -i -E '^HTTP|content-range|content-type|accept-ranges' | tr -d '\r'
  vc "$URL" -o /tmp/e2e-video.mp4 && echo "full download: $(wc -c < /tmp/e2e-video.mp4) bytes, header $(head -c 8 /tmp/e2e-video.mp4 | tail -c 4)"
fi
rm -f "$JAR"
