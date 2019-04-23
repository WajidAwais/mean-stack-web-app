const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const h = require("./helpers");

describe("admin operations", () => {
  let app;
  let admin;
  before(async () => { app = await h.setup(); });
  after(h.teardown);
  beforeEach(async () => {
    await h.reset();
    await h.makeUser({ roll: "ADM-1", admin: true, name: "Election Office" });
    admin = await h.signedIn(app, "ADM-1");
  });

  const newCandidate = { username: "Bilal Placeholder", roll_num: "22F-0100", batch: 2022, school: "Model High School", College: "City College", Skills: ["debating"] };

  it("adds a candidate with validation and duplicate detection", async () => {
    const created = await admin.post("/admin/addCandidate").send(newCandidate);
    assert.equal(created.status, 201);
    assert.equal(created.body.data.votes, 0);

    const missing = await admin.post("/admin/addCandidate").send({ ...newCandidate, roll_num: "22F-0101", school: "" });
    assert.equal(missing.status, 400);

    const badSkills = await admin.post("/admin/addCandidate").send({ ...newCandidate, roll_num: "22F-0102", Skills: [{ $gt: "" }] });
    assert.equal(badSkills.status, 400);

    const dup = await admin.post("/admin/addCandidate").send(newCandidate);
    assert.equal(dup.status, 409);
  });

  it("ignores a client-supplied vote count when adding a candidate", async () => {
    const res = await admin.post("/admin/addCandidate").send({ ...newCandidate, votes: 500 });
    assert.equal(res.body.data.votes, 0);
  });

  it("voids ballots for a deleted candidate so those voters can vote again", async () => {
    await h.makeCandidate({ roll: "C-1" });
    await h.makeCandidate({ roll: "C-2" });
    await h.makeUser({ roll: "V-1" });
    const voter = await h.signedIn(app, "V-1");
    await voter.patch("/voter/castVote").send({ roll: "C-1" });

    assert.equal((await admin.delete("/admin/deletecandidate/C-1")).status, 200);
    assert.equal((await admin.delete("/admin/deletecandidate/C-1")).status, 404);
    assert.equal((await voter.patch("/voter/castVote").send({ roll: "C-2" })).status, 200);
  });

  it("deletes voters (and their vote) but never admins through the voter route", async () => {
    await h.makeCandidate({ roll: "C-1" });
    await h.makeUser({ roll: "V-2" });
    const voter = await h.signedIn(app, "V-2");
    await voter.patch("/voter/castVote").send({ roll: "C-1" });

    assert.equal((await admin.delete("/admin/deletevoter/V-2")).status, 200);
    assert.equal((await h.candidate.findOne({ roll_num: "C-1" })).votes, 0);
    assert.equal((await admin.delete("/admin/deletevoter/ADM-1")).status, 404);
  });

  it("finds voters without exposing password hashes or ballot choices", async () => {
    await h.makeUser({ roll: "V-3", name: "Zainab Fictional" });
    const res = await admin.get("/admin/searchvoterUname/zainab");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    const [found] = res.body.data;
    assert.equal(found.password, undefined);
    assert.equal(found.votedFor, undefined);
    assert.equal(found.hasVoted, false);

    const byRoll = await admin.get("/admin/searchvoterRoll/V-3");
    assert.equal(byRoll.body.data[0].username, "Zainab Fictional");
  });

  it("filters the candidate list by batch and shows vote counts", async () => {
    await h.makeCandidate({ roll: "C-21", batch: 2021, votes: 4 });
    await h.makeCandidate({ roll: "C-22", batch: 2022 });
    const res = await admin.get("/admin/view_candidate_list/filter?batch=2021");
    assert.deepEqual(res.body.data.map((c) => c.roll_num), ["C-21"]);

    const votes = await admin.get("/admin/viewVotes/C-21");
    assert.equal(votes.body.data.votes, 4);
  });

  it("creates another admin who can sign in", async () => {
    const res = await admin.post("/admin/add_admin").send({ username: "Deputy Office", roll_number: "ADM-2", password: "another-long-pass" });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.role, "admin");
    const login = await request(app).post("/login").send({ roll_number: "ADM-2", password: "another-long-pass" });
    assert.equal(login.status, 200);
  });
});
