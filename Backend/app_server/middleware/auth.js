const usersdb = require("../models/usersdb");
const { send } = require("./respond");

// Loads the signed-in user from the session. A session that points at a
// deleted account is treated as signed out.
async function requireLogin(req, res, next) {
  const userId = req.session && req.session.userId;
  if (!userId) return send(res, 401, null, "sign in required");
  const user = await usersdb.findById(userId);
  if (!user) {
    req.session.userId = null;
    return send(res, 401, null, "sign in required");
  }
  req.user = user;
  next();
}

function requireRole(role) {
  return [
    requireLogin,
    (req, res, next) => {
      if (req.user.role !== role) return send(res, 403, null, `${role} access only`);
      next();
    },
  ];
}

module.exports = { requireLogin, requireRole };
