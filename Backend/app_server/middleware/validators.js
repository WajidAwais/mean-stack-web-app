const { body, param, query } = require("express-validator");
const { rejectInvalid } = require("./respond");

// Every value is checked with isString()/isInt() first, so an object such as
// {"$gt": ""} is rejected before it can reach a Mongo filter.
const text = (field, max = 60) =>
  body(field).isString().withMessage("must be text").bail().trim().isLength({ min: 1, max }).withMessage(`must be 1-${max} characters`);
const optionalText = (field, max = 120) =>
  body(field).optional({ values: "falsy" }).isString().withMessage("must be text").bail().trim().isLength({ max });

const rollNumber = (field) =>
  text(field, 20).bail().matches(/^[A-Za-z0-9-]+$/).withMessage("letters, digits and dashes only");
const password = (field) =>
  body(field).isString().withMessage("must be text").bail().isLength({ min: 8, max: 128 }).withMessage("must be 8-128 characters");
const batch = (field, { optional = false } = {}) => {
  const chain = body(field);
  return (optional ? chain.optional({ values: "falsy" }) : chain)
    .isInt({ min: 1, max: 9999 }).withMessage("must be a whole number").toInt();
};
const cnic = (field) =>
  body(field).optional({ values: "falsy" }).isString().bail().trim().matches(/^\d{5}-?\d{7}-?\d$/).withMessage("must look like 12345-1234567-1");
const phone = (field) =>
  body(field).optional({ values: "falsy" }).isString().bail().trim().matches(/^\+?[0-9][0-9 -]{6,19}$/).withMessage("must be a phone number");
const date = (field) =>
  body(field).optional({ values: "falsy" }).isISO8601().withMessage("must be a date (YYYY-MM-DD)").toDate();
const pathParam = (name) =>
  param(name).isString().trim().isLength({ min: 1, max: 60 }).withMessage("must be 1-60 characters");

const userFields = [
  cnic("CNIC"),
  date("dob"),
  optionalText("address", 200),
  optionalText("gender", 20),
  cnic("gcnic"),
  phone("phone_number"),
];

module.exports = {
  signup: [text("username"), rollNumber("roll_number"), password("password"), batch("batch"), ...userFields, rejectInvalid],
  addAdmin: [text("username"), rollNumber("roll_number"), password("password"), batch("batch", { optional: true }), ...userFields, rejectInvalid],
  login: [
    body("roll_number").isString().withMessage("must be text").bail().trim().notEmpty(),
    body("password").isString().withMessage("must be text").bail().notEmpty(),
    rejectInvalid,
  ],
  changePassword: [
    body("current_password").isString().withMessage("must be text").bail().notEmpty(),
    password("password"),
    rejectInvalid,
  ],
  updateProfile: [
    optionalText("username", 60),
    optionalText("address", 200),
    optionalText("gender", 20),
    cnic("cnic"), cnic("guard"), phone("phone"), date("dob"),
    batch("batch", { optional: true }),
    rejectInvalid,
  ],
  castVote: [rollNumber("roll"), rejectInvalid],
  addCandidate: [
    text("username"), rollNumber("roll_num"), batch("batch"),
    text("school", 120), text("College", 120),
    optionalText("Experience", 500),
    body("Skills").optional().isArray({ max: 20 }).withMessage("must be a list"),
    body("Skills.*").isString().withMessage("must be text").bail().trim().isLength({ min: 1, max: 40 }),
    rejectInvalid,
  ],
  filterByBatch: [query("batch").optional().isInt({ min: 1, max: 9999 }).withMessage("must be a whole number").toInt(), rejectInvalid],
  param: (name) => [pathParam(name), rejectInvalid],
};
