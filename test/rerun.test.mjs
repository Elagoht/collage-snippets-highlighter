// A save during an inspection is inspected too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Rerun } = require("../out/src/rerun.js");

test("a run asked for while one is under way runs once more after it", async () => {
  const r = new Rerun();
  let runs = 0;
  let release;
  const work = () => new Promise((resolve) => { runs++; release = resolve; });
  const events = [];
  const first = r.run(work, () => events.push("start"), () => events.push("done"));
  assert.equal(r.pending, true);
  await Promise.resolve();
  r.run(work); // two saves mid-build: one more run, not two
  r.run(work);
  release();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(runs, 2, "the save mid-build was not inspected");
  assert.equal(r.pending, true);
  release();
  await first;
  assert.equal(runs, 2);
  assert.equal(r.pending, false);
  assert.deepEqual(events, ["start", "done"]);
});
