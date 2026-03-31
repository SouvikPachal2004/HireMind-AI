const express = require('express');
const router = express.Router();

// Analyze voice/speech
router.post('/analyze', async (req, res) => {
  try {
    const { transcript, duration = 30 } = req.body;
    if (!transcript || transcript.trim().length < 3) {
      return res.json({ success: false, error: 'No speech detected.' });
    }

    const wordCount = transcript.trim().split(/\s+/).length;
    const wordsPerMinute = Math.floor((wordCount / duration) * 60);
    const confidenceScore = Math.min(95, 50 + wordCount * 0.8 + Math.random() * 15);
    const fluencyScore = Math.min(95, 45 + wordCount * 0.9 + Math.random() * 20);
    const clarityScore = Math.min(95, 55 + Math.random() * 30);

    let speedFeedback = 'Good pace';
    if (wordsPerMinute < 100) speedFeedback = 'Too slow – try to speak more naturally';
    else if (wordsPerMinute > 180) speedFeedback = 'Too fast – slow down for clarity';

    res.json({
      success: true,
      transcript,
      wordCount,
      wordsPerMinute,
      confidenceScore: Math.floor(confidenceScore),
      fluencyScore: Math.floor(fluencyScore),
      clarityScore: Math.floor(clarityScore),
      speedFeedback,
      suggestions: [
        'Maintain steady eye contact',
        'Use pauses effectively for emphasis',
        'Avoid filler words like "um" and "uh"',
        'Project your voice with confidence'
      ].slice(0, 2 + Math.floor(Math.random() * 2))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
