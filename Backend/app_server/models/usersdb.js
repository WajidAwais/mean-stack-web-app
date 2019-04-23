const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const BCRYPT_ROUNDS = 10;

// Field names follow the original 2019 schema so existing data still loads.
// `type` is true for voters and false for admins, as in the API proposal.
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  password: { type: String, required: true, select: false },
  roll_number: { type: String, required: true, unique: true, trim: true },
  CNIC: { type: String, trim: true },
  dob: { type: Date },
  Address: { type: String, trim: true },
  Gender: { type: String, trim: true },
  Batch: { type: Number },
  guardian_cnic: { type: String, trim: true },
  votedFor: { type: String, default: null },
  phone_number: { type: String, trim: true },
  type: { type: Boolean, required: true },
});

userSchema.pre("save", async function hashPassword() {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
  }
});

userSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.virtual("role").get(function role() {
  return this.type ? "voter" : "admin";
});

// Never send the hash, and keep the ballot secret: callers only learn
// whether someone has voted, not for whom.
userSchema.set("toJSON", {
  virtuals: true,
  transform(doc, ret) {
    ret.hasVoted = Boolean(ret.votedFor);
    delete ret.password;
    delete ret.votedFor;
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

userSchema.statics.authenticate = async function authenticate(rollNumber, password) {
  const user = await this.findOne({ roll_number: rollNumber }).select("+password");
  if (!user || !(await user.checkPassword(password))) return null;
  return user;
};

module.exports = mongoose.model("usersdb", userSchema);
