var mongoose = require("mongoose");
var dbURI = process.env.MONGODB_URI || "mongodb://localhost:27017/data";
mongoose.connect(
  dbURI,
  { useNewUrlParser: true }
);
mongoose.Promise = global.Promise;
//on connection
mongoose.connection.on("connected", () => {
  console.log("connected to db mongodb");
});

//on error
mongoose.connection.on("error", err => {
  if (err) {
    console.log("error in db connection" + err);
  }
});

//require("./showtimedb");
require("./candidate1");
require('./usersdb');