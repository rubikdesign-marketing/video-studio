// Node 22 reads a folder given to --test as a module, so `node --test tools/conductor/tests/` loads this file,
// which loads the test files. `node --test tools/conductor/tests/*.test.mjs` runs them directly.
Promise.all(['./gate.test.mjs', './dispatch.test.mjs'].map((f) => import(f))).catch((e) => { console.error(e); process.exitCode = 1; });
