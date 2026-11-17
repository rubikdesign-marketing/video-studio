# Structure library

Beat frameworks for laying a film out in time: the studio's four playbook shapes (`studio-promo`, `studio-demo`, `studio-tutorial`, `studio-edit`), the default for each film type, and nine borrowed ones. The craft is in `knowledge/craft/16-structure-and-retention.md`; credits in `CREDITS.md`.

```bash
node tools/plan/beats.mjs frameworks
node tools/plan/beats.mjs jobs/<job>                       # the playbook's shape for the job's type
node tools/plan/beats.mjs jobs/<job> --framework reel-shape --platform reels
node tools/plan/retention.mjs <export.csv> --job jobs/<job>
```

A framework is a list of beats in order. Each beat has a job, a size as a share of the film (`size: [min, max]`) and limits in seconds (`seconds: [min, max]`), either or both, and says whether it is required. The borrowed frameworks' timings are their sources' own, allowed 25% either way; the playbook shapes are the playbooks' own numbers.

To add a framework: add it to `frameworks.json` and run `node --test tools/plan/tests/*.test.mjs`. The test refuses a framework whose beats cannot fill a film of the lengths it says it suits, and any source whose licence does not allow copying.
