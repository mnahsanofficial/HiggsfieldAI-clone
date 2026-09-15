#!/bin/bash
# Ship a branch: open the PR, wait for the Vercel preview check, fill __PREVIEW_URL__ in the
# body, merge with a merge commit (never squash), sync main, wait for production to serve it.
# usage: scripts/dev/ship.sh <branch> "<title>" <body-file>
set -u
cd "$(git rev-parse --show-toplevel)"
BR=$1; TITLE=$2; BODY=$3
# Same gates Vercel's build applies (next build typechecks scripts/ too), before anything is pushed.
npm run build >/tmp/ship-build.log 2>&1 || { echo "BUILD FAILED, not shipping"; tail -20 /tmp/ship-build.log; exit 1; }
npx tsc --noEmit || { echo "TYPECHECK FAILED, not shipping"; exit 1; }
npm run lint --silent || { echo "LINT FAILED, not shipping"; exit 1; }
git push -q origin "$BR"
gh pr view "$BR" >/dev/null 2>&1 || gh pr create --base main --head "$BR" --title "$TITLE" --body-file "$BODY" | tail -1
sleep 20
S=""
for i in $(seq 1 40); do S=$(gh pr checks "$BR" 2>&1 | awk -F'\t' '$1=="Vercel"{print $2" "$4}'); case "$S" in pass*|fail*) break;; esac; sleep 12; done
echo "preview check: $S"
case "$S" in pass*) ;; *) echo "NOT MERGING"; exit 1;; esac
PREV=$(npx --yes vercel@latest inspect "$(echo "$S" | awk '{print $2}')" 2>&1 | grep -o 'https://higgsfield-ai-clone-[a-z0-9]*-mnahsanofficials-projects\.vercel\.app' | head -1)
echo "preview url: $PREV"
if [ -n "$PREV" ]; then sed -i '' "s#__PREVIEW_URL__#$PREV#g" "$BODY"; gh pr edit "$BR" --body-file "$BODY" >/dev/null; fi
[ -z "$(git status --porcelain)" ] || { echo "DIRTY TREE, NOT MERGING"; git status --short; exit 1; }
gh pr merge "$BR" --merge --delete-branch | tail -1
git fetch --prune origin -q; git switch -q main; git merge -q --ff-only origin/main
echo "main: $(git log --oneline -1)"
SHA=$(git rev-parse --short HEAD)
for i in $(seq 1 40); do curl -s https://higgsfield-ai-clone.vercel.app | grep -q "$SHA" && { echo "PRODUCTION GREEN: serving $SHA"; exit 0; }; sleep 10; done
echo "PRODUCTION NOT SERVING $SHA YET"; exit 2
