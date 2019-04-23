const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const h = require("./helpers");

describe("voting and results", () => {
  let app;
  before(async () => { app = await h.setup(); });
  after(h.teardown);
  beforeEach(h.reset);

  it("shows a voter only the candidates of their own batch on the homepage", async () => {
    await h.makeUser({ roll: "V-1", batch: 2022 });
    await h.makeCandidate({ roll: "C-22", batch: 2022 });
    await h.makeCandidate({ roll: "C-23", batch: 2023 });
    const voter = await h.signedIn(app, "V-1");

    const res = await voter.get("/voter/homepage");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.map((c) => c.roll_num), ["C-22"]);
    assert.equal(res.body.data[0].votes, undefined);
  });

  it("records one vote per voter", async () => {
    await h.makeUser({ roll: "V-2" });
    await h.makeCandidate({ roll: "C-1" });
    const voter = await h.signedIn(app, "V-2");

    const first = await voter.patch("/voter/castVote").send({ roll: "C-1" });
    assert.equal(first.status, 200);
    const second = await voter.patch("/voter/castVote").send({ roll: "C-1" });
    assert.equal(second.status, 409);
    assert.equal((await h.candidate.findOne({ roll_num: "C-1" })).votes, 1);

    const me = await voter.get("/me");
    assert.equal(me.body.data.hasVoted, true);
    assert.equal(me.body.data.votedFor, undefined);
  });

  it("counts only one of several simultaneous votes from the same voter", async () => {
    await h.makeUser({ roll: "V-3" });
    await h.makeCandidate({ roll: "C-1" });
    await h.makeCandidate({ roll: "C-2" });
    const voter = await h.signedIn(app, "V-3");

    const statuses = await Promise.all(
      ["C-1", "C-2", "C-1", "C-2"].map((roll) => voter.patch("/voter/castVote").send({ roll }).then((r) => r.status)),
    );
    assert.equal(statuses.filter((s) => s === 200).length, 1);
    const total = (await h.candidate.find()).reduce((sum, c) => sum + c.votes, 0);
    assert.equal(total, 1);
  });

  it("rejects votes for another batch, unknown candidates and operator payloads", async () => {
    await h.makeUser({ roll: "V-4", batch: 2022 });
    await h.makeCandidate({ roll: "C-23", batch: 2023 });
    const voter = await h.signedIn(app, "V-4");

    assert.equal((await voter.patch("/voter/castVote").send({ roll: "C-23" })).status, 403);
    assert.equal((await voter.patch("/voter/castVote").send({ roll: "C-404" })).status, 404);
    assert.equal((await voter.patch("/voter/castVote").send({ roll: { $ne: "" } })).status, 400);
    assert.equal((await h.candidate.findOne({ roll_num: "C-23" })).votes, 0);
  });

  it("does not let a voter switch batch after voting", async () => {
    await h.makeUser({ roll: "V-5", batch: 2022 });
    await h.makeCandidate({ roll: "C-1", batch: 2022 });
    const voter = await h.signedIn(app, "V-5");
    await voter.patch("/voter/castVote").send({ roll: "C-1" });

    const res = await voter.put("/voter/UpdateProfile").send({ batch: 2023 });
    assert.equal(res.status, 409);
  });

  it("reports winners per batch for any number of batches, including ties", async () => {
    await h.makeUser({ roll: "V-6" });
    await h.makeCandidate({ roll: "A-1", batch: 2021, votes: 5 });
    await h.makeCandidate({ roll: "A-2", batch: 2021, votes: 2 });
    await h.makeCandidate({ roll: "B-1", batch: 2022, votes: 3 });
    await h.makeCandidate({ roll: "B-2", batch: 2022, votes: 3 });
    await h.makeCandidate({ roll: "C-1", batch: 2023, votes: 0 });
    await h.makeCandidate({ roll: "D-1", batch: 2024, votes: 1 });
    const voter = await h.signedIn(app, "V-6");

    const res = await voter.get("/voter/results");
    assert.equal(res.status, 200);
    const byBatch = Object.fromEntries(res.body.data.map((b) => [b.batch, b]));
    assert.deepEqual(Object.keys(byBatch), ["2021", "2022", "2023", "2024"]);
    assert.deepEqual(byBatch[2021].winners.map((w) => w.roll_num), ["A-1"]);
    assert.deepEqual(byBatch[2022].winners.map((w) => w.roll_num).sort(), ["B-1", "B-2"]);
    assert.deepEqual(byBatch[2023].winners, []);
    assert.equal(byBatch[2021].totalVotes, 7);
  });

  it("returns an empty result list when there are no candidates", async () => {
    await h.makeUser({ roll: "V-7" });
    const voter = await h.signedIn(app, "V-7");
    const res = await voter.get("/voter/results");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, []);
  });

  it("treats search text literally rather than as a pattern", async () => {
    await h.makeUser({ roll: "V-8" });
    await h.makeCandidate({ roll: "C-1", name: "Hamza Example" });
    await h.makeCandidate({ roll: "C-2", name: "Sara Sample" });
    const voter = await h.signedIn(app, "V-8");

    const literal = await voter.get(`/voter/search_Candidate/${encodeURIComponent(".*")}`);
    assert.deepEqual(literal.body.data, []);
    const partial = await voter.get("/voter/search_Candidate/sample");
    assert.deepEqual(partial.body.data.map((c) => c.roll_num), ["C-2"]);
  });
});
