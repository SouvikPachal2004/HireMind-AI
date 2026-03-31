const express = require('express');
const router  = express.Router();
const Session = require('../models/Session');
const User    = require('../models/User');
const authMw  = require('../middleware/auth');

const questionBank = {
  'Software Developer': {
    technical: [
      'Explain the difference between stack and heap memory.',
      'What is the time complexity of quicksort in the worst case?',
      'Describe the SOLID principles with examples.',
      'What is a closure in JavaScript?',
      'Explain REST vs GraphQL — when would you use each?',
      'What is the difference between process and thread?',
      'Explain database indexing and when to use it.'
    ],
    behavioral: [
      'Tell me about a time you resolved a conflict in your team.',
      'Describe a challenging project and how you handled it.',
      'How do you prioritize tasks under pressure?',
      'Tell me about a time you failed and what you learned.'
    ],
    hr: [
      'Why do you want to work here?',
      'Where do you see yourself in 5 years?',
      'What is your greatest strength and weakness?',
      'How do you handle feedback and criticism?'
    ]
  },
  'Web Developer': {
    technical: [
      'What is the CSS box model?',
      'Explain event delegation in JavaScript.',
      'What are Web Workers and when would you use them?',
      'Describe the difference between SSR and CSR.',
      'What is CORS and how do you handle it?',
      'Explain the difference between localStorage and sessionStorage.',
      'What is a service worker?'
    ],
    behavioral: [
      'Tell me about a complex UI you built.',
      'How do you ensure cross-browser compatibility?',
      'Describe your workflow for implementing a new feature.',
      'How do you handle performance issues in a web app?'
    ],
    hr: [
      'What motivates you as a developer?',
      'How do you stay updated with web trends?',
      'Describe your ideal work environment.',
      'How do you handle tight deadlines?'
    ]
  },
  'Data Scientist': {
    technical: [
      'Explain the bias-variance tradeoff.',
      'What is regularization and why is it used?',
      'Describe the difference between supervised and unsupervised learning.',
      'What is cross-validation and why is it important?',
      'Explain gradient descent and its variants.',
      'What is the difference between precision and recall?',
      'How do you handle imbalanced datasets?'
    ],
    behavioral: [
      'Tell me about a data project that had a business impact.',
      'How do you handle missing or dirty data?',
      'Describe a time your model failed in production.',
      'How do you communicate findings to non-technical stakeholders?'
    ],
    hr: [
      'Why data science?',
      'What tools do you prefer and why?',
      'How do you keep up with research in the field?',
      'Describe a time you had to learn something quickly.'
    ]
  },
  'ML Engineer': {
    technical: [
      'What is the difference between a model and a pipeline?',
      'Explain the transformer architecture.',
      'What is feature engineering and why does it matter?',
      'How do you deploy a machine learning model to production?',
      'What is MLOps and what problems does it solve?',
      'Explain model quantization.',
      'What is the difference between batch and online learning?'
    ],
    behavioral: [
      'Describe a model you took from research to production.',
      'How do you handle model drift?',
      'Tell me about a time you improved model performance significantly.',
      'How do you collaborate with data engineers and product teams?'
    ],
    hr: [
      'What excites you about ML?',
      'How do you keep up with research papers?',
      'Describe your experience with cloud ML platforms.',
      'Where do you see ML engineering in 5 years?'
    ]
  }
};

const feedbackTemplates = [
  { min: 0,  max: 40,  text: 'Your answer needs more depth. Focus on core concepts and provide concrete examples. Consider reviewing the fundamentals of this topic.' },
  { min: 41, max: 65,  text: 'Good attempt! You covered the basics but missed some key points. Try to elaborate with real-world examples and be more specific.' },
  { min: 66, max: 80,  text: 'Solid answer! You demonstrated good understanding. To improve, add more technical depth and mention edge cases.' },
  { min: 81, max: 100, text: 'Excellent response! You showed strong knowledge with clear examples and structured thinking. Keep it up!' }
];

// POST /api/interview/generate-questions
router.post('/generate-questions', async (req, res) => {
  try {
    const { role = 'Software Developer', type = 'technical', count = 5 } = req.body;
    const bank    = questionBank[role] || questionBank['Software Developer'];
    const pool    = bank[type] || bank.technical;
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(count, pool.length));
    res.json({ success: true, questions: shuffled, role, type });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/interview/evaluate-answer
router.post('/evaluate-answer', async (req, res) => {
  try {
    const { question, answer, role = 'Software Developer' } = req.body;
    if (!answer || answer.trim().length < 5)
      return res.json({ success: true, score: 0, feedback: 'Please provide a more detailed answer.' });

    const wordCount = answer.trim().split(/\s+/).length;
    const base  = Math.min(40 + wordCount * 1.8, 92);
    const noise = (Math.random() * 10) - 5;
    const score = Math.max(10, Math.min(100, Math.floor(base + noise)));
    const tmpl  = feedbackTemplates.find(t => score >= t.min && score <= t.max);

    res.json({ success: true, score, feedback: tmpl.text, wordCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/interview/save-session  (protected)
router.post('/save-session', authMw, async (req, res) => {
  try {
    const session = await Session.create({ ...req.body, userId: req.user.id });

    // Update user stats
    const sessions = await Session.find({ userId: req.user.id });
    const avg = Math.round(sessions.reduce((a, s) => a + s.score, 0) / sessions.length);
    await User.findByIdAndUpdate(req.user.id, {
      totalSessions:       sessions.length,
      completedInterviews: sessions.length,
      averageScore:        avg,
      $inc: { streak: 0 }   // streak logic can be extended
    });

    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/interview/sessions  (protected)
router.get('/sessions', authMw, async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
