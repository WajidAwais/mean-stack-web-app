const { validationResult } = require("express-validator");

// Every response keeps the {status, data, message} envelope from the
// original API proposal; the HTTP status now matches `status`.
function send(res, status, data, message) {
  return res.status(status).json({ status, data, message });
}

function rejectInvalid(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  return send(res, 400, { errors }, "invalid input");
}

function notFound(req, res) {
  send(res, 404, null, "not found");
}

// eslint-disable-next-line no-unused-vars
function handleError(err, req, res, next) {
  if (err && err.code === 11000) return send(res, 409, null, "already exists");
  if (err && err.type === "entity.parse.failed") return send(res, 400, null, "malformed JSON");
  if (err && err.status && err.status < 500) return send(res, err.status, null, err.message);
  console.error(err);
  send(res, 500, null, "internal error");
}

module.exports = { send, rejectInvalid, notFound, handleError };
