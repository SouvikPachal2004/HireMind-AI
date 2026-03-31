const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const skillKeywords = [
  'JavaScript','TypeScript','Python','Java','C++','React','Vue','Angular','Node.js',
  'Express','MongoDB','PostgreSQL','MySQL','Redis','Docker','Kubernetes','AWS','GCP',
  'Azure','Git','REST','GraphQL','Machine Learning','Deep Learning','TensorFlow',
  'PyTorch','Pandas','NumPy','SQL','HTML','CSS','Tailwind','Bootstrap','Next.js',
  'FastAPI','Django','Flask','Spring Boot','Microservices','CI/CD','Linux','Agile','Scrum'
];

// Upload resume
router.post('/upload-resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    // Simulate skill extraction (in production, use pdf-parse or similar)
    const detectedSkills = skillKeywords.sort(() => Math.random() - 0.5).slice(0, 8 + Math.floor(Math.random() * 6));
    const score = 60 + Math.floor(Math.random() * 30);

    const suggestions = [
      'Add quantifiable achievements (e.g., "Improved performance by 40%")',
      'Include a professional summary at the top',
      'List certifications and relevant courses',
      'Use action verbs to start bullet points',
      'Tailor keywords to match job descriptions',
      'Add links to GitHub, LinkedIn, or portfolio'
    ].sort(() => Math.random() - 0.5).slice(0, 4);

    res.json({
      success: true,
      filename: req.file.filename,
      skills: detectedSkills,
      score,
      suggestions,
      missingSkills: skillKeywords.filter(s => !detectedSkills.includes(s)).slice(0, 5)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
