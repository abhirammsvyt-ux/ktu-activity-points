const express    = require('express');
const { Parser } = require('json2csv');
const { db, logActivity } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticateToken, requireAdmin);

// ── GET /api/admin/activities ────────────────────────────────
// List all activities, with optional filters
router.get('/activities', (req, res) => {
  const { status, semester, student_id } = req.query;

  let query = `
    SELECT
      a.*,
      s.name          AS student_name,
      s.roll_number,
      s.department,
      s.batch_year
    FROM activities a
    JOIN students s ON s.id = a.student_id
    WHERE 1=1
  `;
  const params = [];

  if (status)     { query += ' AND a.status = ?';     params.push(status); }
  if (semester)   { query += ' AND a.semester = ?';   params.push(semester); }
  if (student_id) { query += ' AND a.student_id = ?'; params.push(student_id); }

  query += ' ORDER BY a.submitted_at DESC';

  // node-sqlite3-wasm: pass params as array, NOT spread args
  const activities = db.prepare(query).all(params);
  res.json({ count: activities.length, activities });
});

// ── GET /api/admin/students ──────────────────────────────────
router.get('/students', (req, res) => {
  const students = db.prepare(`
    SELECT
      s.id, s.roll_number, s.name, s.email, s.department, s.batch_year, s.created_at, s.last_login_at,
      COUNT(a.id)                                                    AS total_activities,
      COALESCE(SUM(CASE WHEN a.status='verified' THEN a.calculated_points ELSE 0 END), 0) AS verified_points
    FROM students s
    LEFT JOIN activities a ON a.student_id = s.id
    GROUP BY s.id
    ORDER BY s.name
  `).all([]);
  res.json({ count: students.length, students });
});

// ── GET /api/admin/students/:id/history ─────────────────────
// Retrieve complete activity history and audit log for a student
router.get('/students/:id/history', (req, res) => {
  const { id } = req.params;
  const student = db.prepare(`
    SELECT id, roll_number, name, email, department, batch_year, created_at, last_login_at
    FROM students WHERE id = ?
  `).get([id]);

  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const activities = db.prepare(`
    SELECT * FROM activities WHERE student_id = ? ORDER BY submitted_at DESC
  `).all([id]);

  const logs = db.prepare(`
    SELECT * FROM activity_logs WHERE student_id = ? ORDER BY created_at DESC
  `).all([id]);

  res.json({
    student,
    activities,
    logs
  });
});

// ── PATCH /api/admin/activities/:id ─────────────────────────
// Verify or reject a single activity
router.patch('/activities/:id', (req, res) => {
  const { id } = req.params;
  const { status, admin_remarks } = req.body;

  if (!['verified', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'status must be verified, rejected, or pending' });
  }

  const existing = db.prepare('SELECT id, student_id, category, semester FROM activities WHERE id = ?').get([id]);
  if (!existing) return res.status(404).json({ error: 'Activity not found' });

  db.prepare(`
    UPDATE activities
    SET status = ?, admin_remarks = ?, verified_at = datetime('now')
    WHERE id = ?
  `).run([status, admin_remarks || null, id]);

  logActivity(
    existing.student_id,
    `CERTIFICATE_${status.toUpperCase()}`,
    `Certificate for ${existing.category} (${existing.semester}) was ${status}${admin_remarks ? ': ' + admin_remarks : ''}`
  );

  res.json({ message: `Activity ${status} successfully` });
});

// ── GET /api/admin/export/:semester ─────────────────────────
// Export semester-wise CSV
router.get('/export/:semester', (req, res) => {
  const { semester } = req.params;
  const { status_filter = 'verified' } = req.query;

  const rows = db.prepare(`
    SELECT
      s.roll_number                     AS "Roll Number",
      s.name                            AS "Student Name",
      s.department                      AS "Department",
      s.batch_year                      AS "Batch Year",
      a.semester                        AS "Semester",
      CASE a.category
        WHEN 'national_initiatives' THEN 'National Initiatives'
        WHEN 'sports'               THEN 'Sports / Games / Cultural'
        WHEN 'professional'         THEN 'Professional Self Initiatives'
        WHEN 'entrepreneurship'     THEN 'Entrepreneurship & Innovation'
        WHEN 'leadership'           THEN 'Leadership & Management'
        ELSE a.category
      END                               AS "Category",
      a.sub_category                    AS "Sub-Category",
      COALESCE(a.level, '-')            AS "Level",
      COALESCE(a.achievement, '-')      AS "Achievement",
      COALESCE(a.institution_type, '-') AS "Institution Type",
      a.calculated_points               AS "Points",
      a.status                          AS "Status",
      COALESCE(a.admin_remarks, '')     AS "Remarks",
      a.submitted_at                    AS "Submitted At",
      COALESCE(a.verified_at, '')       AS "Verified At"
    FROM activities a
    JOIN students s ON s.id = a.student_id
    WHERE a.semester = ? AND a.status = ?
    ORDER BY s.roll_number, a.category
  `).all([semester, status_filter]);

  if (rows.length === 0) {
    return res.status(404).json({ error: `No ${status_filter} activities found for ${semester}` });
  }

  // Compute per-student totals and append summary rows
  const studentTotals = {};
  for (const row of rows) {
    const key = row['Roll Number'];
    if (!studentTotals[key]) {
      studentTotals[key] = {
        'Roll Number': key,
        'Student Name': row['Student Name'],
        'Department': row['Department'],
        'Batch Year': row['Batch Year'],
        'Semester': semester,
        'Category': '*** TOTAL ***',
        'Sub-Category': '',
        'Level': '',
        'Achievement': '',
        'Institution Type': '',
        'Points': 0,
        'Status': '',
        'Remarks': '',
        'Submitted At': '',
        'Verified At': '',
      };
    }
    studentTotals[key]['Points'] += row['Points'];
  }

  const allRows = [...rows];
  for (const total of Object.values(studentTotals)) {
    allRows.push(total);
  }

  try {
    const parser = new Parser({ fields: Object.keys(rows[0]) });
    const csv    = parser.parse(allRows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="KTU_ActivityPoints_${semester}_${Date.now()}.csv"`
    );
    res.send(csv);
  } catch (err) {
    console.error('[CSV Export Error]', err);
    res.status(500).json({ error: 'CSV export failed' });
  }
});

// ── GET /api/admin/stats ─────────────────────────────────────
router.get('/stats', (req, res) => {
  const stats = {
    total_students:    db.prepare('SELECT COUNT(*) AS c FROM students').get([]).c,
    total_activities:  db.prepare('SELECT COUNT(*) AS c FROM activities').get([]).c,
    pending:           db.prepare("SELECT COUNT(*) AS c FROM activities WHERE status='pending'").get([]).c,
    verified:          db.prepare("SELECT COUNT(*) AS c FROM activities WHERE status='verified'").get([]).c,
    rejected:          db.prepare("SELECT COUNT(*) AS c FROM activities WHERE status='rejected'").get([]).c,
    by_semester: db.prepare(`
      SELECT semester, COUNT(*) AS count, SUM(calculated_points) AS total_pts
      FROM activities WHERE status='verified'
      GROUP BY semester ORDER BY semester
    `).all([]),
    by_category: db.prepare(`
      SELECT category, COUNT(*) AS count
      FROM activities WHERE status='verified'
      GROUP BY category
    `).all([]),
  };
  res.json(stats);
});

module.exports = router;
