const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const Session = require('../models/Session');
const authMw  = require('../middleware/auth');

// GET /api/user/profile  (protected)
router.get('/profile', authMw, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/user/profile  (protected)
router.put('/profile', authMw, async (req, res) => {
  try {
    const { name, email, role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, email, role },
      { new: true, runValidators: true }
    ).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/user/stats  (protected)
router.get('/stats', authMw, async (req, res) => {
  try {
    const user    = await User.findById(req.user.id).select('-password');
    const sessions = await Session.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(30);

    const totalSessions = sessions.length;
    const avgScore = totalSessions
      ? Math.round(sessions.reduce((a, s) => a + (s.score || 0), 0) / totalSessions)
      : 0;

    // Progress data — last 7 days
    const progressData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const daySessions = sessions.filter(s => {
        const sd = new Date(s.createdAt);
        return sd.toDateString() === d.toDateString();
      });
      return {
        date: d.toLocaleDateString('en-US', { weekday: 'short' }),
        score: daySessions.length ? Math.round(daySessions.reduce((a, s) => a + s.score, 0) / daySessions.length) : 0
      };
    });

    res.json({
      success: true,
      totalSessions,
      completedInterviews: totalSessions,
      averageScore: avgScore,
      streak: user.streak || 1,
      progressData,
      recentSessions: sessions.slice(0, 5)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
