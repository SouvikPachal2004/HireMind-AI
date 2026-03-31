const express = require('express');
const router = express.Router();

const testCases = {
  twoSum: [
    { input: '[2,7,11,15], target=9', expected: '[0,1]' },
    { input: '[3,2,4], target=6', expected: '[1,2]' },
    { input: '[3,3], target=6', expected: '[0,1]' }
  ],
  reverseString: [
    { input: '"hello"', expected: '"olleh"' },
    { input: '"world"', expected: '"dlrow"' }
  ],
  fibonacci: [
    { input: 'n=5', expected: '5' },
    { input: 'n=10', expected: '55' }
  ]
};

// Run code
router.post('/run', async (req, res) => {
  try {
    const { code, language = 'javascript', problem = 'twoSum' } = req.body;
    if (!code || code.trim().length < 5) {
      return res.json({ success: false, error: 'Please write some code first.' });
    }

    // Simulate test case results
    const cases = testCases[problem] || testCases.twoSum;
    const passed = Math.floor(Math.random() * (cases.length + 1));
    const results = cases.map((tc, i) => ({
      input: tc.input,
      expected: tc.expected,
      output: i < passed ? tc.expected : 'Wrong Answer',
      passed: i < passed,
      time: (Math.random() * 50 + 5).toFixed(1) + 'ms'
    }));

    const timeComplexity = ['O(n)', 'O(n log n)', 'O(n²)', 'O(1)', 'O(log n)'][Math.floor(Math.random() * 5)];
    const spaceComplexity = ['O(1)', 'O(n)', 'O(log n)'][Math.floor(Math.random() * 3)];

    res.json({
      success: true,
      results,
      passed,
      total: cases.length,
      timeComplexity,
      spaceComplexity,
      executionTime: (Math.random() * 100 + 10).toFixed(2) + 'ms'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Submit code
router.post('/submit', async (req, res) => {
  try {
    const { code, language = 'javascript', problem = 'twoSum' } = req.body;
    const cases = testCases[problem] || testCases.twoSum;
    const allPassed = Math.random() > 0.3;
    const passed = allPassed ? cases.length : Math.floor(cases.length * 0.6);

    res.json({
      success: true,
      accepted: allPassed,
      passed,
      total: cases.length,
      score: Math.floor((passed / cases.length) * 100),
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
      message: allPassed ? 'All test cases passed! Great job!' : 'Some test cases failed. Review your logic.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
