const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { initializeDatabase } = require('./db');
const { authenticateToken }  = require('./middleware/auth');

const authRoutes    = require('./routes/auth');
const studentRoutes = require('./routes/student');
const adminRoutes   = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static — serve uploads and client ───────────────────────
// Note: No auth on uploads — browsers can't send Bearer tokens in img/iframe src
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'client')));

// ── API Routes ───────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/activities', studentRoutes);
app.use('/api/admin',      adminRoutes);

// ── Client-side routing fallback ────────────────────────────
app.get('/student', (req, res) => res.sendFile(path.join(__dirname, '..', 'client', 'student.html')));
app.get('/admin',   (req, res) => res.sendFile(path.join(__dirname, '..', 'client', 'admin.html')));

// ── 404 handler ──────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Error handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Max 10 MB.' });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Boot ─────────────────────────────────────────────────────
initializeDatabase();
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n🚀 KTU Activity Points Server running at http://localhost:${PORT}`);
    console.log(`   Admin login → username: admin | password: admin123\n`);
  });
}

module.exports = app;
