const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const h = require("./helpers");

describe("accounts and sessions", () => {
  let app;
  before(async () => { app = await h.setup(); });
  after(h.teardown);
  beforeEach(h.reset);

  it("signs a new voter up, hashes the password and starts a session", async () => {
    const agent = request.agent(app);
    const res = await agent.post("/signup").send({ username: "Ayesha Demo", roll_number: "22F-0001", password: h.PASSWORD, batch: 2022 });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.role, "voter");
    assert.equal(res.body.data.password, undefined);

    const stored = await h.usersdb.findOne({ roll_number: "22F-0001" }).select("+password");
    assert.notEqual(stored.password, h.PASSWORD);
    assert.match(stored.password, /^\$2[aby]\$/);

    const me = await agent.get("/me");
    assert.equal(me.status, 200);
    assert.equal(me.body.data.roll_number, "22F-0001");
  });

  it("rejects incomplete or weak sign-ups with 400 and field errors", async () => {
    const res = await request(app).post("/signup").send({ username: "No Pass", roll_number: "22F-0002", password: "short", batch: 2022 });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.data.errors.map((e) => e.field), ["password"]);

    const noBatch = await request(app).post("/signup").send({ username: "X", roll_number: "22F-0003", password: h.PASSWORD });
    assert.equal(noBatch.status, 400);
  });

  it("returns 409 for a roll number that is already registered", async () => {
    await h.makeUser({ roll: "22F-0004" });
    const res = await request(app).post("/signup").send({ username: "Dup", roll_number: "22F-0004", password: h.PASSWORD, batch: 2022 });
    assert.equal(res.status, 409);
  });

  it("refuses a wrong password and an operator object in place of a value", async () => {
    await h.makeUser({ roll: "22F-0005" });
    const wrong = await request(app).post("/login").send({ roll_number: "22F-0005", password: "not-the-password" });
    assert.equal(wrong.status, 401);

    const injected = await request(app).post("/login").send({ roll_number: { $ne: "" }, password: { $ne: "" } });
    assert.equal(injected.status, 400);
  });

  it("keeps two signed-in users apart (no shared login state)", async () => {
    await h.makeUser({ roll: "22F-0006", name: "First Voter" });
    await h.makeUser({ roll: "22F-0007", name: "Second Voter" });
    const first = await h.signedIn(app, "22F-0006");
    await h.signedIn(app, "22F-0007");

    const me = await first.get("/voter/ViewProfileVoter");
    assert.equal(me.body.data.roll_number, "22F-0006");
  });

  it("guards routes by sign-in and by role", async () => {
    assert.equal((await request(app).get("/voter/homepage")).status, 401);
    await h.makeUser({ roll: "22F-0008" });
    const voter = await h.signedIn(app, "22F-0008");
    assert.equal((await voter.get("/admin/homepage")).status, 403);
    assert.equal((await voter.get("/voter/homepage")).status, 200);
  });

  it("reports the session state without a 401 for the browser client", async () => {
    const anon = await request(app).get("/session");
    assert.equal(anon.status, 200);
    assert.equal(anon.body.data, null);

    await h.makeUser({ roll: "22F-0013" });
    const agent = await h.signedIn(app, "22F-0013");
    const mine = await agent.get("/session");
    assert.equal(mine.body.data.roll_number, "22F-0013");
  });

  it("ends the session on sign-out", async () => {
    await h.makeUser({ roll: "22F-0009" });
    const agent = await h.signedIn(app, "22F-0009");
    assert.equal((await agent.post("/signout")).status, 200);
    assert.equal((await agent.get("/me")).status, 401);
  });

  it("changes the password only when the current one is supplied", async () => {
    await h.makeUser({ roll: "22F-0010" });
    const agent = await h.signedIn(app, "22F-0010");
    const bad = await agent.patch("/voter/changePassword").send({ current_password: "guess", password: "a-new-password" });
    assert.equal(bad.status, 403);

    const ok = await agent.patch("/voter/changePassword").send({ current_password: h.PASSWORD, password: "a-new-password" });
    assert.equal(ok.status, 200);
    const relogin = await request(app).post("/login").send({ roll_number: "22F-0010", password: "a-new-password" });
    assert.equal(relogin.status, 200);
  });

  it("updates only the profile fields that were sent", async () => {
    await h.makeUser({ roll: "22F-0011" });
    const agent = await h.signedIn(app, "22F-0011");
    const res = await agent.put("/voter/UpdateProfile").send({ phone: "0300-1234567", dob: "2001-04-05" });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.phone_number, "0300-1234567");
    assert.equal(res.body.data.dob.slice(0, 10), "2001-04-05");
    assert.equal(res.body.data.username, "User 22F-0011");
  });

  it("deleting an account withdraws its vote", async () => {
    await h.makeUser({ roll: "22F-0012" });
    await h.makeCandidate({ roll: "C-1" });
    const agent = await h.signedIn(app, "22F-0012");
    await agent.patch("/voter/castVote").send({ roll: "C-1" });
    assert.equal((await h.candidate.findOne({ roll_num: "C-1" })).votes, 1);

    assert.equal((await agent.delete("/voter/deactivate_account")).status, 200);
    assert.equal((await h.candidate.findOne({ roll_num: "C-1" })).votes, 0);
    assert.equal(await h.usersdb.countDocuments({ roll_number: "22F-0012" }), 0);
  });

  it("answers unknown paths and malformed JSON with the JSON envelope", async () => {
    const missing = await request(app).get("/nope");
    assert.equal(missing.status, 404);
    assert.equal(missing.body.message, "not found");

    const broken = await request(app).post("/login").set("Content-Type", "application/json").send("{not json");
    assert.equal(broken.status, 400);
  });
});
