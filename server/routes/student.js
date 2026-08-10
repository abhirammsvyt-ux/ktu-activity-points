const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { db }   = require('../db');
const { authenticateToken, requireStudent } = require('../middleware/auth');
const { calculatePoints } = require('../engine/pointsEngine');

const router = express.Router();

// ── Multer storage config ────────────────────────────────────
const UPLOAD_DIR = process.env.VERCEL
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Only PDF and image files are allowed'));
  },
});

// ── POST /api/activities ─────────────────────────────────────
router.post(
  '/',
  authenticateToken,
  requireStudent,
  upload.single('document'),
  (req, res) => {
    const {
      semester,
      category,
      sub_category,
      level,
      achievement,
      institution_type,
      document_type,
      extra_details,
    } = req.body;

    if (!semester || !category || !sub_category) {
      return res.status(400).json({ error: 'semester, category, and sub_category are required' });
    }

    // Duplicate certificate check
    const existingCert = db.prepare(`
      SELECT id FROM activities
      WHERE student_id = ? AND category = ? AND sub_category = ? AND semester = ?
    `).get([req.user.id, category, sub_category, semester]);

    if (existingCert) {
      return res.status(409).json({ error: 'This certificate has already been uploaded.' });
    }

    const extras = (() => {
      try { return JSON.parse(extra_details || '{}'); }
      catch { return {}; }
    })();

    const { points, breakdown } = calculatePoints({
      category,
      sub_category,
      level,
      achievement,
      institution_type,
      extra_details: extras,
    });

    const document_path = req.file ? `uploads/${req.file.filename}` : null;

    const result = db.prepare(`
      INSERT INTO activities
        (student_id, semester, category, sub_category, level, achievement,
         institution_type, document_path, document_type, extra_details,
         calculated_points, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run([
      req.user.id,
      semester,
      category,
      sub_category,
      level || null,
      achievement || null,
      institution_type || null,
      document_path,
      document_type || null,
      JSON.stringify(extras),
      points
    ]);

    logActivity(req.user.id, 'UPLOAD_CERTIFICATE', `Uploaded certificate for ${category} (${sub_category}) in ${semester}`);

    res.status(201).json({
      message: 'Activity submitted successfully',
      activity_id: result.lastInsertRowid,
      calculated_points: points,
      breakdown,
    });
  }
);

// ── GET /api/activities/my ───────────────────────────────────
router.get('/my', authenticateToken, requireStudent, (req, res) => {
  const { semester } = req.query;

  let query = `
    SELECT a.*, s.name AS student_name, s.roll_number
    FROM activities a
    JOIN students s ON s.id = a.student_id
    WHERE a.student_id = ?
  `;
  const params = [req.user.id];

  if (semester) {
    query += ' AND a.semester = ?';
    params.push(semester);
  }

  query += ' ORDER BY a.submitted_at DESC';

  // node-sqlite3-wasm: pass params as array, NOT spread args
  const activities = db.prepare(query).all(params);

  // Group by semester, compute totals
  const semesterMap = {};
  for (const act of activities) {
    if (!semesterMap[act.semester]) {
      semesterMap[act.semester] = { activities: [], total_points: 0, verified_points: 0 };
    }
    semesterMap[act.semester].activities.push(act);
    semesterMap[act.semester].total_points += act.calculated_points;
    if (act.status === 'verified') {
      semesterMap[act.semester].verified_points += act.calculated_points;
    }
  }

  res.json({ activities, semester_summary: semesterMap });
});

// ── GET /api/activities/file/:filename ──────────────────────
// No auth needed — browsers can't send Bearer tokens in img/iframe src
router.get('/file/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.sendFile(filePath);
});

module.exports = router;
