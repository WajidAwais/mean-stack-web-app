const mongoose = require("mongoose");

// Wrap any `$`-prefixed keys that reach a filter in `$eq`, so a request body
// like {"roll_number": {"$ne": ""}} can never turn into a query operator.
mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

const DEFAULT_URI = "mongodb://localhost:27017/eballot";

function connect(uri = process.env.MONGODB_URI || DEFAULT_URI) {
  return mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
}

require("./candidate1");
require("./usersdb");

module.exports = { connect, mongoose };
