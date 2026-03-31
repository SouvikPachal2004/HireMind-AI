require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');

const app = express();
const frontendDir = path.join(__dirname, '../frontend');

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/stats',     require('./routes/stats'));
app.use('/api/user',      require('./routes/user'));
app.use('/api/interview', require('./routes/interview'));
app.use('/api/resume',    require('./routes/resume'));
app.use('/api/coding',    require('./routes/coding'));
app.use('/api/voice',     require('./routes/voice'));
app.use('/api/report',    require('./routes/report'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Serve frontend on the same port for both direct and workspace-style routes.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use('/hiremind-ai/frontend', express.static(frontendDir));
app.use(express.static(frontendDir));

app.get(['/index.html', '/hiremind-ai/frontend/index.html', '/'], (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});
app.get(['/dashboard.html', '/hiremind-ai/frontend/dashboard.html'], (req, res) => {
  res.sendFile(path.join(frontendDir, 'dashboard.html'));
});
app.get(['/interview-room.html', '/hiremind-ai/frontend/interview-room.html'], (req, res) => {
  res.sendFile(path.join(frontendDir, 'interview-room.html'));
});

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err.message));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 HireMind AI server running on http://localhost:${PORT}`));
