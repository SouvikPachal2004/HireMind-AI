const express = require('express');
const router  = express.Router();
const Session = require('../models/Session');
const User    = require('../models/User');
const authMw  = require('../middleware/auth');

router.post('/generate', authMw, async (req, res) => {
  try {
    const user     = await User.findById(req.user.id).select('-password');
    const sessions = await Session.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(20);
    const role     = user.role || 'Software Developer';

    const avgScore = sessions.length
      ? Math.round(sessions.reduce((a, s) => a + s.score, 0) / sessions.length)
      : 72;

    const techScore  = Math.max(0, Math.min(100, avgScore + Math.floor(Math.random() * 10) - 4));
    const commScore  = Math.max(0, Math.min(100, avgScore + Math.floor(Math.random() * 14) - 7));
    const confScore  = Math.max(0, Math.min(100, avgScore + Math.floor(Math.random() * 18) - 9));

    const strengths = [
      'Strong problem-solving approach with structured thinking',
      'Clear communication of technical concepts',
      'Good understanding of core data structures',
      'Demonstrates systematic debugging skills',
      'Shows enthusiasm and a growth mindset'
    ].sort(() => Math.random() - 0.5).slice(0, 3);

    const weaknesses = [
      'Needs improvement in system design depth',
      'Could elaborate more on behavioral answers',
      'Time management during coding challenges',
      'Depth of knowledge in advanced algorithms',
      'Confidence when answering under pressure'
    ].sort(() => Math.random() - 0.5).slice(0, 3);

    const suggestions = [
      'Practice LeetCode medium/hard problems daily',
      'Study system design patterns (HLD/LLD)',
      'Record yourself answering behavioral questions',
      'Review the STAR method for behavioral interviews',
      'Build 2–3 portfolio projects to showcase skills',
      'Do mock interviews with peers weekly'
    ].sort(() => Math.random() - 0.5).slice(0, 4);

    res.json({
      success: true,
      report: {
        generatedAt:        new Date().toISOString(),
        userName:           user.name,
        role,
        totalSessions:      sessions.length,
        averageScore:       avgScore,
        technicalScore:     techScore,
        communicationScore: commScore,
        confidenceScore:    confScore,
        strengths,
        weaknesses,
        suggestions,
        readinessLevel: avgScore >= 80 ? 'Interview Ready' : avgScore >= 60 ? 'Almost Ready' : 'Needs Practice'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
