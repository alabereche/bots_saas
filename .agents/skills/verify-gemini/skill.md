---
name: "verify-gemini"
description: "Verify an external agent's (Gemini) walkthrough report against the actual codebase with zero trust — scope, gates, and past failure patterns."
---

# Verify Gemini Output

You are executing the zero-trust review of an external AI agent's delivered work.

## Input
The walkthrough report (pasted or referenced) describing what was implemented, plus the approved plan it claims to follow.

## Procedure

1. **Scope audit:** `git status --short` (ignore .g.dart churn) and `git diff --stat`. List every changed file. Compare against the plan's approved file list — flag additions/omissions.
2. **Per-claim verification:** for each "done" item in the report:
   - Open the cited files; confirm the change exists at the claimed location (file:line).
   - Grep for the key symbols (new classes, exported functions, wiring call-sites). An unused new provider/function is a wiring failure.
3. **Known failure patterns — check every time:**
   - `grep -rn "maxInstances" functions/src/api/<new file>` — must be 1-2 for light callables.
   - Hardcoded dates in new/modified tests (`grep -rn "202[0-9]-[0-9][0-9]-[0-9][0-9]\|DateTime.utc(202" test/`) — must be clock-relative.
   - Modified (not added) old tests: `git diff --stat test/` and inspect any non-new test file.
   - Invented APIs: for every method the report claims to call, grep its definition.
   - Files the report claims exist: `ls` them.
   - Client writes to server-owned fields (users/{uid}: eloRating/xp/level/subscription/quota/ownedDeckIds/pendingGifts) — must be a callable, never direct.
4. **Run the gates yourself (never trust reported numbers):**
   - `flutter analyze` → 0 issues.
   - `flutter test` → record exact count.
   - `cd functions && npx tsc --noEmit` and run all `*.test.ts` if server code touched.
5. **Integration seams:** entry point wired? exit/cleanup paths clear the state? any write to a watched provider (self-rebuild loop risk)?

## Output

Table: claim → ✅ VERIFIED (evidence) / ⚠️ DEVIATION / ❌ FALSE.
Then: gates results (real runs), and final verdict **APPROVED / APPROVED WITH CONDITIONS / REJECTED**.
