const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:               { type: String, enum: ['mock', 'coding', 'voice', 'ats'], required: true },
  role:               { type: String, default: 'Software Developer' },
  score:              { type: Number, default: 0 },
  technicalScore:     { type: Number, default: 0 },
  communicationScore: { type: Number, default: 0 },
  confidenceScore:    { type: Number, default: 0 },
  questions:          [{ question: String, answer: String, feedback: String, score: Number }],
  duration:           { type: Number, default: 0 },
  createdAt:          { type: Date, default: Date.now }
});

module.exports = mongoose.model('Session', sessionSchema);
