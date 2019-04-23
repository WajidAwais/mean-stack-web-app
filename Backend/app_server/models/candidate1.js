const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  batch: { type: Number, required: true },
  roll_num: { type: String, required: true, unique: true, trim: true },
  votes: { type: Number, default: 0, min: 0 },
  school: { type: String, required: true, trim: true },
  College: { type: String, required: true, trim: true },
  Experience: { type: String, trim: true },
  Skills: [String],
});

candidateSchema.index({ batch: 1, votes: -1 });

module.exports = mongoose.model("candidate1", candidateSchema);
