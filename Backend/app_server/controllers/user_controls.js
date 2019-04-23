const { trusted } = require("mongoose");
const candidate = require("../models/candidate1");
const usersdb = require("../models/usersdb");
const { send } = require("../middleware/respond");
const { escapeRegex } = require("./cand_list");

function startSession(req, user) {
  return new Promise((resolve, reject) => {
    // A fresh session id on every sign-in prevents session fixation.
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = user.id;
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

function endSession(req, res) {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) return reject(err);
      res.clearCookie("eballot.sid");
      resolve();
    });
  });
}

function profileFromBody(body) {
  return {
    username: body.username,
    password: body.password,
    roll_number: body.roll_number,
    CNIC: body.CNIC,
    dob: body.dob,
    Address: body.address,
    Gender: body.gender,
    Batch: body.batch,
    guardian_cnic: body.gcnic,
    phone_number: body.phone_number,
  };
}

async function withdrawVote(user) {
  if (!user.votedFor) return;
  await candidate.updateOne({ roll_num: user.votedFor, votes: trusted({ $gt: 0 }) }, { $inc: { votes: -1 } });
}

module.exports.signUp = async function signUp(req, res) {
  const user = await usersdb.create({ ...profileFromBody(req.body), type: true });
  await startSession(req, user);
  send(res, 201, user, "account created");
};

module.exports.addAdmin = async function addAdmin(req, res) {
  const admin = await usersdb.create({ ...profileFromBody(req.body), type: false });
  send(res, 201, admin, "admin added");
};

module.exports.logIn = async function logIn(req, res) {
  const user = await usersdb.authenticate(req.body.roll_number, req.body.password);
  if (!user) return send(res, 401, null, "wrong roll number or password");
  await startSession(req, user);
  send(res, 200, user, "signed in");
};

module.exports.logOut = async function logOut(req, res) {
  await endSession(req, res);
  send(res, 200, null, "signed out");
};

module.exports.viewProfile = function viewProfile(req, res) {
  send(res, 200, req.user, "found");
};

module.exports.updateProfile = async function updateProfile(req, res) {
  const user = req.user;
  const changes = {
    username: req.body.username,
    Address: req.body.address,
    CNIC: req.body.cnic,
    phone_number: req.body.phone,
    guardian_cnic: req.body.guard,
    Gender: req.body.gender,
    dob: req.body.dob,
    Batch: req.body.batch,
  };
  if (changes.Batch !== undefined && changes.Batch !== user.Batch && user.votedFor) {
    return send(res, 409, null, "batch cannot change after voting");
  }
  for (const [field, value] of Object.entries(changes)) {
    if (value !== undefined && value !== "") user[field] = value;
  }
  await user.save();
  send(res, 200, user, "profile updated");
};

module.exports.changePassword = async function changePassword(req, res) {
  const user = await usersdb.findById(req.user.id).select("+password");
  if (!(await user.checkPassword(req.body.current_password))) {
    return send(res, 403, null, "current password is wrong");
  }
  user.password = req.body.password;
  await user.save();
  send(res, 200, null, "password changed");
};

module.exports.deactivateAccount = async function deactivateAccount(req, res) {
  await withdrawVote(req.user);
  await usersdb.deleteOne({ _id: req.user._id });
  await endSession(req, res);
  send(res, 200, null, "account deleted");
};

module.exports.castVote = async function castVote(req, res) {
  const chosen = await candidate.findOne({ roll_num: req.body.roll });
  if (!chosen) return send(res, 404, null, "candidate not found");
  if (chosen.batch !== req.user.Batch) {
    return send(res, 403, null, "you can only vote for a candidate in your own batch");
  }
  // The conditional update is the one-vote guard: two parallel requests
  // cannot both find votedFor empty.
  const marked = await usersdb.findOneAndUpdate(
    { _id: req.user._id, votedFor: null },
    { $set: { votedFor: chosen.roll_num } },
  );
  if (!marked) return send(res, 409, null, "you have already voted");
  await candidate.updateOne({ _id: chosen._id }, { $inc: { votes: 1 } });
  send(res, 200, { roll_num: chosen.roll_num, username: chosen.username }, "vote recorded");
};

module.exports.viewVotes = async function viewVotes(req, res) {
  const found = await candidate.findOne({ roll_num: req.params.candidate }, "username roll_num batch votes");
  if (!found) return send(res, 404, null, "candidate not found");
  send(res, 200, found, "found");
};

module.exports.searchVotersByName = async function searchVotersByName(req, res) {
  const pattern = new RegExp(escapeRegex(req.params.query), "i");
  const voters = await usersdb.find({ type: true, username: pattern }).sort({ username: 1 }).limit(50);
  send(res, 200, voters, voters.length ? "found" : "no match");
};

module.exports.searchVotersByRoll = async function searchVotersByRoll(req, res) {
  const voters = await usersdb.find({ type: true, roll_number: req.params.query });
  send(res, 200, voters, voters.length ? "found" : "no match");
};

module.exports.deleteVoter = async function deleteVoter(req, res) {
  const voter = await usersdb.findOne({ type: true, roll_number: req.params.roll });
  if (!voter) return send(res, 404, null, "voter not found");
  await withdrawVote(voter);
  await usersdb.deleteOne({ _id: voter._id });
  send(res, 200, voter, "voter deleted");
};
