/* ═══════════════════════════════════════════════════════════
   app.js — Shared utilities for KTU Activity Points
   ═══════════════════════════════════════════════════════════ */

const BASE = (
  window.location.protocol === 'file:' ||
  ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '3000')
) ? 'http://localhost:3000' : '';

// Helper for page redirection
function getPageRoute(role) {
  const isHtml = window.location.pathname.endsWith('.html') || window.location.protocol === 'file:';
  if (role === 'admin') return isHtml ? 'admin.html' : '/admin';
  if (role === 'student') return isHtml ? 'student.html' : '/student';
  return isHtml ? 'index.html' : '/';
}

// ── Auth guard (call in page scripts) ──────────────────────
function guardAuth(requiredRole) {
  const token = localStorage.getItem('ktu_token');
  const role  = localStorage.getItem('ktu_role');
  if (!token || (requiredRole && role !== requiredRole)) {
    window.location.href = getPageRoute('home');
  }
  return JSON.parse(localStorage.getItem('ktu_user') || '{}');
}

function logout() {
  localStorage.removeItem('ktu_token');
  localStorage.removeItem('ktu_user');
  localStorage.removeItem('ktu_role');
  window.location.href = getPageRoute('home');
}

// ── Fetch wrapper ───────────────────────────────────────────
async function api(url, method = 'GET', body = null, isFile = false) {
  const token = localStorage.getItem('ktu_token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) {
    if (isFile) {
      opts.body = body; // FormData
    } else {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }

  let res;
  try {
    res = await fetch(BASE + url, opts);
  } catch (netErr) {
    throw new Error('Backend server is not running on http://localhost:3000. Please start the server using npm start or start.bat');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const errorMsg = err.error || (res.status === 404 ? 'Route not found (404). Ensure backend server is running.' : `Request failed (${res.status})`);
    throw new Error(errorMsg);
  }
  return res.json();
}

// Binary download helper
async function apiDownload(url) {
  const token = localStorage.getItem('ktu_token');
  let res;
  try {
    res = await fetch(BASE + url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  } catch (netErr) {
    throw new Error('Backend server is not running on http://localhost:3000.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Download failed (${res.status})`);
  }
  const blob  = await res.blob();
  const fname = (res.headers.get('Content-Disposition') || 'export.csv')
                .split('filename=')[1]?.replace(/"/g, '') || 'export.csv';
  const a     = document.createElement('a');
  a.href      = URL.createObjectURL(blob);
  a.download  = fname;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Toast ────────────────────────────────────────────────────
function toast(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${iconFor(type)}</span><span>${msg}</span>`;
  el.onclick = () => el.remove();
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}
function iconFor(t) { return { success:'✅', error:'❌', info:'ℹ️' }[t] || 'ℹ️'; }

// ── Button loading state ──────────────────────────────────────
function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn._text = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Loading…';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn._text || 'Submit';
    btn.disabled  = false;
  }
}

// ── Category labels ───────────────────────────────────────────
const CATEGORY_LABELS = {
  national_initiatives: 'National Initiatives',
  sports:               'Sports / Games / Cultural',
  professional:         'Professional Initiatives',
  entrepreneurship:     'Entrepreneurship & Innovation',
  leadership:           'Leadership & Management',
};

const LEVEL_LABELS = { I:'I (College)', II:'II (Zonal)', III:'III (State/University)', IV:'IV (National)', V:'V (International)' };

// ── Format date ───────────────────────────────────────────────
function fmtDate(dt) {
  if (!dt) return '–';
  return new Date(dt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

// ── Status badge ──────────────────────────────────────────────
function statusBadge(s) {
  return `<span class="badge badge-${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</span>`;
}

// ── Category icon ─────────────────────────────────────────────
function catIcon(cat) {
  const m = {
    national_initiatives: '🏅',
    sports:               '🏆',
    professional:         '💻',
    entrepreneurship:     '🚀',
    leadership:           '👑',
  };
  return m[cat] || '📌';
}

// ── Category bg color ─────────────────────────────────────────
function catColor(cat) {
  const m = {
    national_initiatives: 'rgba(34,197,94,0.15)',
    sports:               'rgba(245,158,11,0.15)',
    professional:         'rgba(79,142,247,0.15)',
    entrepreneurship:     'rgba(168,85,247,0.15)',
    leadership:           'rgba(244,63,94,0.15)',
  };
  return m[cat] || 'rgba(255,255,255,0.05)';
}
