const express = require("express");
const rateLimit = require("express-rate-limit");

const ctrlCandidates = require("../controllers/cand_list");
const ctrlUsers = require("../controllers/user_controls");
const { requireLogin, requireRole } = require("../middleware/auth");
const check = require("../middleware/validators");

const router = express.Router();
const voter = requireRole("voter");
const admin = requireRole("admin");

const signInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT || 20),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { status: 429, data: null, message: "too many attempts, try again later" },
});

// Paths follow the 2019 API proposal so the original client calls still match.
router.post("/signup", signInLimiter, check.signup, ctrlUsers.signUp);
router.post("/login", signInLimiter, check.login, ctrlUsers.logIn);
router.post("/signout", ctrlUsers.logOut);
router.get("/signout", ctrlUsers.logOut);
router.get("/me", requireLogin, ctrlUsers.viewProfile);

router.get("/voter/homepage", voter, ctrlCandidates.getOwnBatchList);
router.get("/voter/view_candidate_list", voter, ctrlCandidates.getCandidateList);
router.get("/voter/search_Candidate/:query", voter, check.param("query"), ctrlCandidates.searchCandidateList);
router.get("/voter/viewCandidate/:roll_num", voter, check.param("roll_num"), ctrlCandidates.viewCandidate);
router.patch("/voter/castVote", voter, check.castVote, ctrlUsers.castVote);
router.get("/voter/results", voter, ctrlCandidates.results);
router.get("/voter/ViewProfileVoter", voter, ctrlUsers.viewProfile);
router.put("/voter/UpdateProfile", voter, check.updateProfile, ctrlUsers.updateProfile);
router.patch("/voter/changePassword", voter, check.changePassword, ctrlUsers.changePassword);
router.delete("/voter/deactivate_account", voter, ctrlUsers.deactivateAccount);

router.get("/admin/homepage", admin, ctrlCandidates.getCandidateList);
router.get("/admin/view_candidate_list", admin, ctrlCandidates.getCandidateList);
router.get("/admin/view_candidate_list/filter", admin, check.filterByBatch, ctrlCandidates.filterByBatch);
router.get("/admin/viewCandidate/:roll_num", admin, check.param("roll_num"), ctrlCandidates.viewCandidate);
router.post("/admin/addCandidate", admin, check.addCandidate, ctrlCandidates.addCandidate);
router.delete("/admin/deletecandidate/:roll", admin, check.param("roll"), ctrlCandidates.deleteCandidate);
router.get("/admin/viewVotes/:candidate", admin, check.param("candidate"), ctrlUsers.viewVotes);
router.get("/admin/results", admin, ctrlCandidates.results);
router.get("/admin/searchvoterUname/:query", admin, check.param("query"), ctrlUsers.searchVotersByName);
router.get("/admin/searchvoterRoll/:query", admin, check.param("query"), ctrlUsers.searchVotersByRoll);
router.delete("/admin/deletevoter/:roll", admin, check.param("roll"), ctrlUsers.deleteVoter);
router.post("/admin/add_admin", admin, check.addAdmin, ctrlUsers.addAdmin);
router.get("/admin/ViewProfileAdmin", admin, ctrlUsers.viewProfile);
router.put("/admin/UpdateProfile", admin, check.updateProfile, ctrlUsers.updateProfile);
router.patch("/admin/changePassword", admin, check.changePassword, ctrlUsers.changePassword);

module.exports = router;
