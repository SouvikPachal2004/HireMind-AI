const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ success: false, error: 'No token provided' });
  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'Malformed token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};
