#!/usr/bin/env node
// Wait until someone presses Send on the review page, then print the notes and exit.
//   node studio/wait-for-notes.mjs <job_dir> [--hours 8]
// Claude runs this in the background after handing over a cut. When it exits, Claude is woken
// with the notes on screen. Exit code 0 = notes arrived, 3 = nobody sent anything in time.
//
//   node studio/wait-for-notes.mjs <job_dir> --done <batch number> '<json: [{"id": "b001-n1", "reply": "..."}]>'
// marks a batch as done once the notes have been worked through, so the page shows the replies.
//
//   node studio/wait-for-notes.mjs <job_dir> --paper [--hours 8]
// waits for the transcript page's Send (edit/paper.json marked sent), then prints what was decided and exits.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const jobDir = path.resolve(args[0] || (console.error('Give the job folder.'), process.exit(2)));
const dir = path.join(jobDir, 'review');
const flag = (name) => { const i = args.indexOf('--' + name); return i >= 0 ? args.slice(i + 1) : null; };
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const batchFiles = () => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^batch-\d+\.json$/.test(f)).sort().map((f) => path.join(dir, f)) : []);

const done = flag('done');
if (done) {
  const file = path.join(dir, `batch-${String(done[0]).padStart(3, '0')}.json`);
  const batch = read(file); const replies = done[1] ? JSON.parse(done[1]) : [];
  for (const note of batch.notes) {
    const r = replies.find((x) => x.id === note.id);
    note.resolved = true; if (r?.reply) note.reply = r.reply;
  }
  batch.status = 'done'; batch.done_at = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(batch, null, 1));
  console.log(`Batch ${batch.batch} marked done (${batch.notes.length} notes).`);
  process.exit(0);
}

const hours = Number((flag('hours') || [8])[0]);
if (flag('paper')) {
  const file = path.join(jobDir, 'edit', 'paper.json');
  const until = Date.now() + hours * 3600 * 1000;
  const look = () => {
    const paper = fs.existsSync(file) ? read(file) : null;
    if (paper?.status === 'sent') {
      paper.status = 'picked up'; paper.picked_at = new Date().toISOString();
      fs.writeFileSync(file, JSON.stringify(paper, null, 2));
      const kept = paper.blocks.filter((b) => b.words.length).length;
      console.log(`Paper edit sent${paper.reviewer ? ` by ${paper.reviewer}` : ''}: ${paper.approved ? 'ready for the rough cut' : 'with notes, not ready yet'}.`);
      console.log(`${kept} of ${paper.blocks.length} sentences kept; ${(paper.approved_joins || []).length} flagged join(s) approved; ${(paper.keep_pauses || []).length} pause(s) kept as said.`);
      if (paper.note) console.log(`Note: ${paper.note}`);
      console.log(paper.approved ? 'Next: node tools/footage/footage.mjs rough <job> --render' : 'Next: work through the note, then hand the paper edit back.');
      process.exit(0);
    }
    if (Date.now() > until) { console.log('Nobody sent the paper edit in time.'); process.exit(3); }
    setTimeout(look, 3000);
  };
  look();
} else {
const deadline = Date.now() + hours * 3600 * 1000;
const check = () => {
  for (const file of batchFiles()) {
    const batch = read(file);
    if (batch.status !== 'sent') continue;
    batch.status = 'picked up'; batch.picked_at = new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(batch, null, 1));
    console.log(`Review, batch ${batch.batch}, on ${batch.video}${batch.reviewer ? `, from ${batch.reviewer}` : ''}: ${batch.notes.length} note(s)`);
    if (batch.approved) console.log('\nTHIS CUT IS APPROVED by the reviewer. Record the approval in job.json.');
    if (batch.good_scenes?.length) console.log(`\nScenes marked as good, leave them as they are: ${batch.good_scenes.join(', ')}`);
    const order = [...batch.notes].sort((a, b) => (b.must - a.must) || (a.time - b.time));
    for (const n of order) {
      const what = n.kind === 'keep' ? 'KEEP THIS (do not change it; record what works)' : n.must ? 'MUST CHANGE' : 'change';
      console.log(`\n[${n.id}] ${what} at ${n.time} s${n.scene ? `, scene ${n.scene} (${n.scene_title})` : ''}${n.topic ? `, about ${n.topic}` : ''}`);
      console.log(`  "${n.text}"`);
      if (n.box) console.log(`  pointing at: left ${Math.round(n.box.x * 100)}%, top ${Math.round(n.box.y * 100)}%, ${Math.round(n.box.w * 100)}% wide, ${Math.round(n.box.h * 100)}% tall`);
      if (n.frame) console.log(`  frame: ${path.join(jobDir, n.frame)}`);
    }
    console.log(`\nWhen finished: node studio/wait-for-notes.mjs ${args[0]} --done ${batch.batch} '[{"id":"${batch.notes[0]?.id || 'b001-n1'}","reply":"what changed"}]'`);
    process.exit(0);
  }
  if (Date.now() > deadline) { console.log('No notes were sent.'); process.exit(3); }
  setTimeout(check, 2000);
};
check();
}
