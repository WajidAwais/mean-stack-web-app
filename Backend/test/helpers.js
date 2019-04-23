const { randomUUID } = require("node:crypto");
const request = require("supertest");

const { connect, mongoose } = require("../app_server/models/db");
const { createApp } = require("../app");
const usersdb = require("../app_server/models/usersdb");
const candidate = require("../app_server/models/candidate1");

const BASE_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";

// Each test file gets its own throwaway database so files can run in any order.
async function setup() {
  const uri = new URL(BASE_URI);
  uri.pathname = `/eballot_test_${randomUUID().slice(0, 8)}`;
  await connect(uri.toString());
  await Promise.all([usersdb.init(), candidate.init()]);
  return createApp();
}

async function teardown() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

async function reset() {
  await Promise.all([usersdb.deleteMany({}), candidate.deleteMany({})]);
}

const PASSWORD = "correct-horse-battery";

async function makeUser({ roll, batch = 2022, admin = false, name = `User ${roll}` }) {
  return usersdb.create({ username: name, roll_number: roll, password: PASSWORD, Batch: batch, type: !admin });
}

async function signedIn(app, roll) {
  const agent = request.agent(app);
  const res = await agent.post("/login").send({ roll_number: roll, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${roll}: ${res.status}`);
  return agent;
}

function makeCandidate({ roll, batch = 2022, name = `Candidate ${roll}`, votes = 0 }) {
  return candidate.create({ username: name, roll_num: roll, batch, votes, school: "Model High School", College: "City College" });
}

module.exports = { setup, teardown, reset, makeUser, makeCandidate, signedIn, PASSWORD, usersdb, candidate };
