# KTU Activity Points Management System

A full-stack web application for managing, calculating, and verifying student extracurricular activity points as per KTU (Kerala Technological University) institutional rules.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js v18+](https://nodejs.org/) installed

### One-Click Start (Windows)
```
Double-click: start.bat
```

### Manual Start
```bash
# In your terminal, navigate to this folder:
cd "d:\ktu points"

# Install dependencies (first time only):
npm install

# Start the server:
npm start
```

Then open **http://localhost:3000** in your browser.

---

## 🔑 Default Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Student | Register first via the Register tab | Your chosen password |

---

## 📂 Project Structure

```
ktu points/
├── server/
│   ├── index.js              ← Express entry point (port 3000)
│   ├── db.js                 ← SQLite setup + schema migrations
│   ├── middleware/auth.js    ← JWT authentication guards
│   ├── engine/
│   │   └── pointsEngine.js  ← ⭐ Full KTU rules engine
│   ├── routes/
│   │   ├── auth.js           ← /api/auth/* (login, register)
│   │   ├── student.js        ← /api/activities/*
│   │   └── admin.js          ← /api/admin/*
│   └── uploads/              ← Stored certificate files
├── client/
│   ├── index.html            ← Login / Register page
│   ├── student.html          ← Student portal
│   ├── admin.html            ← Admin dashboard
│   └── assets/
│       ├── style.css         ← Global dark-mode styles
│       ├── app.js            ← Shared utilities
│       ├── student.js        ← Student portal logic
│       └── admin.js          ← Admin dashboard logic
├── ktu_points.db             ← SQLite database (auto-created)
├── package.json
└── start.bat                 ← Windows quick-start
```

---

## 📋 Features

### Student Portal (`/student`)
- Register with KTU Roll Number
- Select semester (S1–S8)
- Submit activities across 5 categories
- **Live points preview** before submission
- Upload certificate/PDF (max 10 MB)
- View activity history with per-semester totals
- See verification status (Pending / Verified / Rejected)

### Admin Dashboard (`/admin`)
- System overview with stats
- Review queue for pending submissions
- View uploaded documents inline
- **Verify or Reject** with remarks
- Student roster with total points
- **One-click CSV export** per semester

---

## 🧮 Points Engine — Category Summary

| Category | Key Rules |
|----------|-----------|
| **National Initiatives** | NCC/NSS = 60 pts, bonuses up to +20, cap 80 |
| **Sports/Games/Cultural** | Level-based (8–60), prize bonus, cap 80 for Lvl IV/V winners |
| **Professional Initiatives** | 9 sub-categories with own caps (MOOC=50, TOEFL=50, etc.) |
| **Entrepreneurship** | Fixed lookup (Patent Licensed=80, Startup=60, etc.) |
| **Leadership** | Role-based (Chairman=30, Coordinator=15, etc.), cap 40–60 |

---

## 📥 CSV Export Format

Columns: `Roll Number, Student Name, Department, Batch Year, Semester, Category, Sub-Category, Level, Achievement, Institution Type, Points, Status, Remarks, Submitted At, Verified At`

Plus auto-generated **TOTAL rows** per student for easy faculty review.

---

## 🛡️ Security

- Passwords hashed with **bcrypt** (10 rounds)
- **JWT tokens** with 24h expiry for students, 12h for admin
- File uploads restricted to PDF/image formats, max 10 MB
- All admin routes protected with role-based middleware

---

## ⚙️ Configuration

Edit `server/index.js` to change the port:
```js
const PORT = process.env.PORT || 3000;
```

Change the JWT secret in `server/middleware/auth.js`:
```js
const JWT_SECRET = process.env.JWT_SECRET || 'your-custom-secret';
```

To reset the admin password, delete `ktu_points.db` and restart (will re-seed with `admin123`).
