const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { db }   = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { sendOtpEmail } = require('../utils/mailer');

const router = express.Router();

// ── POST /api/auth/register ──────────────────────────────────
router.post('/register', (req, res) => {
  const { roll_number, name, email, password, department, batch_year } = req.body;

  if (!roll_number || !name || !email || !password || !department || !batch_year) {
    return res.status(400).json({ error: 'All fields including email are required' });
  }

  const cleanRoll  = roll_number.trim().toUpperCase();
  const cleanEmail = email.trim().toLowerCase();

  const existingRoll = db.prepare('SELECT id FROM students WHERE roll_number = ?').get([cleanRoll]);
  if (existingRoll) {
    return res.status(409).json({ error: 'Roll number already registered' });
  }

  const existingEmail = db.prepare('SELECT id FROM students WHERE email = ?').get([cleanEmail]);
  if (existingEmail) {
    return res.status(409).json({ error: 'Email address already registered' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO students (roll_number, name, email, password_hash, department, batch_year) VALUES (?, ?, ?, ?, ?, ?)'
  ).run([cleanRoll, name.trim(), cleanEmail, password_hash, department.trim(), parseInt(batch_year)]);

  const token = jwt.sign(
    { id: result.lastInsertRowid, roll_number: cleanRoll, name: name.trim(), email: cleanEmail, role: 'student' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.status(201).json({
    message: 'Registration successful',
    token,
    user: { id: result.lastInsertRowid, roll_number: cleanRoll, name: name.trim(), email: cleanEmail, department, role: 'student' }
  });
});

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (role === 'admin') {
    const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get([username.trim()]);
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

  // Student login via roll number OR registered email
  const cleanUser = username.trim();
  const student = db.prepare('SELECT * FROM students WHERE roll_number = ? OR email = ?').get([cleanUser.toUpperCase(), cleanUser.toLowerCase()]);
  if (!student || !bcrypt.compareSync(password, student.password_hash)) {
    return res.status(401).json({ error: 'Invalid roll number/email or password' });
  }

  const token = jwt.sign(
    { id: student.id, roll_number: student.roll_number, name: student.name, email: student.email, role: 'student' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: student.id,
      roll_number: student.roll_number,
      name: student.name,
      email: student.email,
      department: student.department,
      role: 'student'
    }
  });
});

// ── POST /api/auth/forgot-password ──────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { identifier } = req.body; // Can be email or roll number

  if (!identifier) {
    return res.status(400).json({ error: 'Email address or roll number is required' });
  }

  const queryVal = identifier.trim();
  const student = db.prepare('SELECT * FROM students WHERE email = ? OR roll_number = ?').get([queryVal.toLowerCase(), queryVal.toUpperCase()]);

  if (!student) {
    return res.status(444 || 404).json({ error: 'No account found with this email or roll number' });
  }

  if (!student.email) {
    return res.status(400).json({ error: 'No email address linked to this account. Please contact administrator.' });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  // Valid for 15 minutes
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  // Save OTP in database
  db.prepare(`
    INSERT INTO password_resets (email, otp, expires_at)
    VALUES (?, ?, ?)
  `).run([student.email, otp, expiresAt]);

  // Dispatch email
  const mailResult = await sendOtpEmail(student.email, otp);

  res.json({
    message: `Verification code sent to ${student.email}`,
    email: student.email,
    previewMode: mailResult.previewMode || false,
    otp: mailResult.previewMode ? otp : undefined,
  });
});

// ── POST /api/auth/reset-password ───────────────────────────
router.post('/reset-password', (req, res) => {
  const { email, otp, new_password } = req.body;

  if (!email || !otp || !new_password) {
    return res.status(400).json({ error: 'Email, OTP verification code, and new password are required' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp   = otp.trim();

  // Verify active non-expired OTP
  const record = db.prepare(`
    SELECT * FROM password_resets
    WHERE email = ? AND otp = ? AND used = 0 AND datetime(expires_at) > datetime('now')
    ORDER BY created_at DESC
    LIMIT 1
  `).get([cleanEmail, cleanOtp]);

  if (!record) {
    return res.status(400).json({ error: 'Invalid or expired verification code (OTP)' });
  }

  // Hash new password & update student profile
  const password_hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE students SET password_hash = ? WHERE email = ?').run([password_hash, cleanEmail]);

  // Mark OTP as used
  db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run([record.id]);

  res.json({ message: 'Password reset successful! You can now log in with your new password.' });
});

module.exports = router;
