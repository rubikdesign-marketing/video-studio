# 03 · Conductor, registry, menu: handoff

**Ref:** branch `damex-03-conductor`, not pushed.
- 49f16fb merges the upgrade line.
- c58a720 is the 03 work.
- dd6f088 merges the RC3 source (d827069, release ff9a20f) with no conflicts.
- Then RC3 fixes and evidence.

**Engine:** RC3 as released; this branch changes 0 engine files.
- The sample renders: 732 frames, 12.2 s.
- `tsc` is clean apart from the generated job captions.

**Gates**
- 0–4 passed.
- 5, conductor on the real halden engine job: routing, caps, overlap, retries, blocked model, paid stop, resume and receipts all hold.
- Tests: tools 190/190, setup 22/22.
- Registry against RC3: 995 items, 0 mismatches.
- 4C: new costs about 58% more, which pays for the beat and hook checks.

**Changed**
- `CLAUDE.md`, `README.md`, `ONBOARDING.md`, `release/{manifest.json,overrides}`
- `.claude/{settings.json,agents,skills}`
- `tools/{conductor,library,plan/brief}`
- `library/registry.json`, `setup/{start.sh,start.ps1,install.sh,runtime/doctor.mjs}`, `templates/job.json`
- `.damex/` (redacted, excluded from export)

**Workers:** 4 of 5.

**Usage:** 5-hour 45%, weekly 8%. No paid calls.

**Open**
- No live helper-built render yet.
- `start.ps1` untested (no PowerShell here).
- The allow list needs a trusted workspace.
- One run in three used `J=`.
- `hooks.mjs` flag mismatch.

**For Prompt 05:** 8 `look-*` paths are wrong.

**Next:** the owner reviews; push when asked.
