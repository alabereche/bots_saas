---
name: "deploy-check"
description: "Pre-deploy safety checklist for Firebase functions under the permanent CPU quota, then targeted deploy with post-verification. Refuses destructive operations."
---

# Deploy Check (Firebase, CPU-quota aware)

Run this BEFORE any `firebase deploy`, then execute and verify.

## 1. Pre-flight (blocking)

- **Build:** `cd functions && npm run build` — tsc must output 0 errors.
- **Tests:** every affected `*.test.ts` passes via `npx ts-node`.
- **Exports:** any NEW function is exported in `functions/src/index.ts` (else "No function matches the filter").
- **Quota math:** `grep -n "maxInstances" functions/src/api/*.ts` — light callables must be 1-2. Compute worst-case Σ(maxInstances×cpu) for the region; if the deploy could push over the permanent ceiling, STOP and report options (the 2026-08-07/09 deadlocks).
- **Consumers bundle:** shared-code changes (e.g. match_factory.ts) must deploy every function that imports it — enumerate with grep before choosing the --only list.

## 2. Deploy

- Targeted only: `firebase deploy --only functions:fnA,functions:fnB --project gen-lang-client-0457211063`.
- Database rules changes: separate `--only database` (transient "Command aborted" = known flake, retry).
- NEVER run: functions:delete (unless human-ordered), database removes/updates outside the approved operation, git reset/clean, any file deletion — the human deletes manually.

## 3. Post-verify

- `firebase functions:list --project gen-lang-client-0457211063` — confirm each function present.
- Capture Function URLs for NEW onRequest functions from deploy output.
- `firebase functions:log --only <fn>` sanity check.

## Output

Functions touched + configs + build/test evidence + list verification → DEPLOYED or BLOCKED (reason).
