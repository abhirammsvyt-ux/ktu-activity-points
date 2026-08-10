const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { db }   = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/auth/register ──────────────────────────────────
router.post('/register', (req, res) => {
  const { roll_number, name, password, department, batch_year } = req.body;

  if (!roll_number || !name || !password || !department || !batch_year) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const existing = db.prepare('SELECT id FROM students WHERE roll_number = ?').get([roll_number]);
  if (existing) {
    return res.status(409).json({ error: 'Roll number already registered' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO students (roll_number, name, password_hash, department, batch_year) VALUES (?, ?, ?, ?, ?)'
  ).run([roll_number, name.trim(), password_hash, department.trim(), parseInt(batch_year)]);

  const token = jwt.sign(
    { id: result.lastInsertRowid, roll_number, name, role: 'student' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.status(201).json({
    message: 'Registration successful',
    token,
    user: { id: result.lastInsertRowid, roll_number, name, department, role: 'student' }
  });
});

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (role === 'admin') {
    const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get([username]);
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    return res.json({
      token,
      user: { id: admin.id, username: admin.username, role: 'admin' }
    });
  }

  // Student login via roll number
  const student = db.prepare('SELECT * FROM students WHERE roll_number = ?').get([username]);
  if (!student || !bcrypt.compareSync(password, student.password_hash)) {
    return res.status(401).json({ error: 'Invalid roll number or password' });
  }

  const token = jwt.sign(
    { id: student.id, roll_number: student.roll_number, name: student.name, role: 'student' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: student.id,
      roll_number: student.roll_number,
      name: student.name,
      department: student.department,
      role: 'student'
    }
  });
});

module.exports = router;
