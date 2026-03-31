const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const Session = require('../models/Session');

// GET /api/stats/public  — no auth required, used on landing page
router.get('/public', async (req, res) => {
  try {
    const totalUsers      = await User.countDocuments();
    const totalSessions   = await Session.countDocuments();
    const totalInterviews = await Session.countDocuments({ type: 'mock' });

    // Success rate = % of sessions with score >= 60
    const passedSessions  = await Session.countDocuments({ score: { $gte: 60 } });
    const successRate     = totalSessions > 0
      ? Math.round((passedSessions / totalSessions) * 100)
      : 0;

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalSessions,
        totalInterviews,
        successRate
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
