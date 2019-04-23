const candidate = require("../models/candidate1");
const usersdb = require("../models/usersdb");
const { send } = require("../middleware/respond");

const LIST_FIELDS = "username batch roll_num school College";

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports.escapeRegex = escapeRegex;

module.exports.getCandidateList = async function getCandidateList(req, res) {
  const list = await candidate.find({}, LIST_FIELDS).sort({ batch: 1, username: 1 });
  send(res, 200, list, list.length ? "found" : "no candidates yet");
};

module.exports.getOwnBatchList = async function getOwnBatchList(req, res) {
  const list = await candidate.find({ batch: req.user.Batch }, LIST_FIELDS).sort({ username: 1 });
  send(res, 200, list, list.length ? "found" : "no candidates in your batch yet");
};

module.exports.filterByBatch = async function filterByBatch(req, res) {
  const batch = req.query.batch ?? req.user.Batch;
  if (batch == null) return send(res, 400, null, "batch is required");
  const list = await candidate.find({ batch }, LIST_FIELDS).sort({ username: 1 });
  send(res, 200, list, list.length ? "found" : "no candidates in that batch");
};

module.exports.searchCandidateList = async function searchCandidateList(req, res) {
  const pattern = new RegExp(escapeRegex(req.params.query), "i");
  const list = await candidate.find({ username: pattern }, LIST_FIELDS).sort({ username: 1 }).limit(50);
  send(res, 200, list, list.length ? "found" : "no match");
};

module.exports.viewCandidate = async function viewCandidate(req, res) {
  const projection = req.user.role === "admin" ? "-__v" : "-__v -votes";
  const found = await candidate.findOne({ roll_num: req.params.roll_num }, projection);
  if (!found) return send(res, 404, null, "candidate not found");
  send(res, 200, found, "found");
};

module.exports.addCandidate = async function addCandidate(req, res) {
  const { username, batch, roll_num, school, College, Experience, Skills } = req.body;
  const created = await candidate.create({ username, batch, roll_num, school, College, Experience, Skills });
  send(res, 201, created, "candidate added");
};

module.exports.deleteCandidate = async function deleteCandidate(req, res) {
  const removed = await candidate.findOneAndDelete({ roll_num: req.params.roll });
  if (!removed) return send(res, 404, null, "candidate not found");
  // Ballots for a withdrawn candidate are void; those voters may vote again.
  await usersdb.updateMany({ votedFor: removed.roll_num }, { $set: { votedFor: null } });
  send(res, 200, removed, "candidate deleted");
};

module.exports.results = async function results(req, res) {
  const batches = await candidate.aggregate([
    { $sort: { batch: 1, votes: -1, username: 1 } },
    {
      $group: {
        _id: "$batch",
        maxVotes: { $max: "$votes" },
        totalVotes: { $sum: "$votes" },
        standings: { $push: { username: "$username", roll_num: "$roll_num", votes: "$votes" } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const data = batches.map((b) => ({
    batch: b._id,
    totalVotes: b.totalVotes,
    winners: b.maxVotes > 0 ? b.standings.filter((c) => c.votes === b.maxVotes) : [],
    standings: b.standings,
  }));
  send(res, 200, data, data.length ? "found" : "no candidates yet");
};
