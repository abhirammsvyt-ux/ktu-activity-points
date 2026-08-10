/* ═══════════════════════════════════════════════════════════
   admin.js — Admin Dashboard Logic
   ═══════════════════════════════════════════════════════════ */

let currentActivityId = null;

document.addEventListener('DOMContentLoaded', () => {
  const user = guardAuth('admin');
  document.getElementById('admin-username').textContent = user.username || 'admin';
  loadOverview();
  loadPendingCount();
});

// ── Section navigation ────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.remove('hidden');
  document.getElementById(`nav-${name}`).classList.add('active');

  if (name === 'overview')  loadOverview();
  if (name === 'pending')   loadPending();
  if (name === 'all')       loadAll();
  if (name === 'students')  loadStudents();
}

// ── Load pending count (for sidebar badge) ───────────────────
async function loadPendingCount() {
  try {
    const data = await api('/api/admin/stats');
    document.getElementById('pending-count').textContent = data.pending;
    document.getElementById('as-pending').textContent    = data.pending;
  } catch (e) { /* silent */ }
}

// ── Overview ──────────────────────────────────────────────────
async function loadOverview() {
  try {
    const data = await api('/api/admin/stats');
    document.getElementById('as-students').textContent = data.total_students;
    document.getElementById('as-total').textContent    = data.total_activities;
    document.getElementById('as-verified').textContent = data.verified;
    document.getElementById('as-pending').textContent  = data.pending;
    document.getElementById('as-rejected').textContent = data.rejected;
    document.getElementById('pending-count').textContent = data.pending;

    // Semester chart
    const semEl = document.getElementById('by-semester-chart');
    if (!data.by_semester.length) {
      semEl.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">No verified data yet.</p>';
    } else {
      const maxPts = Math.max(...data.by_semester.map(r => r.total_pts), 1);
      semEl.innerHTML = data.by_semester.map(r => `
        <div style="margin-bottom:0.75rem;">
          <div class="d-flex justify-between" style="font-size:0.82rem; margin-bottom:0.3rem;">
            <span>${r.semester}</span>
            <span class="text-muted">${r.count} activities · <strong>${r.total_pts} pts</strong></span>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style="width:${Math.round(r.total_pts/maxPts*100)}%"></div>
          </div>
        </div>`).join('');
    }

    // Category chart
    const catEl = document.getElementById('by-category-chart');
    if (!data.by_category.length) {
      catEl.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">No verified data yet.</p>';
    } else {
      const maxC = Math.max(...data.by_category.map(r => r.count), 1);
      catEl.innerHTML = data.by_category.map(r => `
        <div style="margin-bottom:0.75rem;">
          <div class="d-flex justify-between" style="font-size:0.82rem; margin-bottom:0.3rem;">
            <span>${catIcon(r.category)} ${CATEGORY_LABELS[r.category] || r.category}</span>
            <span class="text-muted">${r.count}</span>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style="width:${Math.round(r.count/maxC*100)}%; background:var(--gradient-card);"></div>
          </div>
        </div>`).join('');
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Pending activities ─────────────────────────────────────────
async function loadPending() {
  const el = document.getElementById('pending-list');
  el.innerHTML = '<div class="empty-state"><div class="empty-icon">🔄</div><p>Loading…</p></div>';
  try {
    const data = await api('/api/admin/activities?status=pending');
    if (!data.activities.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>No pending submissions. All caught up!</p></div>';
      return;
    }
    el.innerHTML = data.activities.map(a => renderActivityCard(a, true)).join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── All activities ────────────────────────────────────────────
async function loadAll() {
  const el     = document.getElementById('all-list');
  const status = document.getElementById('all-filter-status').value;
  const sem    = document.getElementById('all-filter-sem').value;
  el.innerHTML = '<div class="empty-state"><div class="empty-icon">🔄</div><p>Loading…</p></div>';

  let url = '/api/admin/activities?';
  if (status) url += `status=${status}&`;
  if (sem)    url += `semester=${sem}&`;

  try {
    const data = await api(url);
    if (!data.activities.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No activities found.</p></div>';
      return;
    }
    el.innerHTML = data.activities.map(a => renderActivityCard(a, a.status === 'pending')).join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Students ──────────────────────────────────────────────────
async function loadStudents() {
  const tbody = document.getElementById('students-tbody');
  try {
    const data = await api('/api/admin/students');
    if (!data.students.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-muted" style="text-align:center; padding:2rem;">No students registered yet.</td></tr>';
      return;
    }
    tbody.innerHTML = data.students.map(s => `
      <tr>
        <td><span class="tag">${s.roll_number}</span></td>
        <td>
          <div style="font-weight:600;">${s.name}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${s.email || 'N/A'}</div>
        </td>
        <td>${s.department}</td>
        <td>${s.batch_year}</td>
        <td style="font-size:0.8rem; color:var(--text-secondary);">${fmtDate(s.created_at)}</td>
        <td style="font-size:0.8rem; color:var(--text-secondary);">${s.last_login_at ? fmtDate(s.last_login_at) : 'Never'}</td>
        <td>${s.total_activities}</td>
        <td><span class="points-bubble">${s.verified_points}</span></td>
        <td>
          <div class="d-flex gap-1" style="flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" onclick="filterByStudent(${s.id}, '${s.name}')">Certificates</button>
            <button class="btn btn-ghost btn-sm" onclick="viewStudentTimeline(${s.id})">📜 History</button>
          </div>
        </td>
      </tr>`).join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function viewStudentTimeline(studentId) {
  const modal = document.getElementById('student-history-modal');
  const content = document.getElementById('sh-modal-content');
  modal.classList.remove('hidden');
  content.innerHTML = '<div class="empty-state"><div class="empty-icon">🔄</div><p>Loading audit history…</p></div>';

  try {
    const data = await api(`/api/admin/students/${studentId}/history`);
    const { student, activities, logs } = data;

    document.getElementById('sh-modal-title').textContent = `📜 ${student.name} (${student.roll_number})`;

    content.innerHTML = `
      <div style="background:rgba(255,255,255,0.03); border-radius:8px; padding:1rem; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.06);">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; font-size:0.85rem;">
          <div><strong>Roll Number:</strong> ${student.roll_number}</div>
          <div><strong>Email:</strong> ${student.email || 'N/A'}</div>
          <div><strong>Department:</strong> ${student.department}</div>
          <div><strong>Batch Year:</strong> ${student.batch_year}</div>
          <div><strong>Joined Date:</strong> ${fmtDate(student.created_at)}</div>
          <div><strong>Last Active:</strong> ${student.last_login_at ? fmtDate(student.last_login_at) : 'Never'}</div>
        </div>
      </div>

      <h4 style="margin-top:1rem; margin-bottom:0.6rem; color:var(--accent-purple, #a855f7);">📜 Event Audit Timeline</h4>
      ${!logs.length ? '<p class="text-muted" style="font-size:0.82rem;">No recorded activity logs yet.</p>' : `
        <div style="border-left:2px solid var(--border-color, rgba(255,255,255,0.1)); padding-left:1rem; margin-left:0.5rem;">
          ${logs.map(l => `
            <div style="margin-bottom:0.75rem; position:relative;">
              <div style="font-size:0.75rem; color:var(--text-muted); mb-1;">${fmtDate(l.created_at)}</div>
              <div style="font-weight:600; color:var(--text-primary); font-size:0.85rem;">${l.description}</div>
              <span class="tag" style="font-size:0.7rem; margin-top:0.2rem; display:inline-block;">${l.event_type}</span>
            </div>
          `).join('')}
        </div>
      `}

      <h4 style="margin-top:1.5rem; margin-bottom:0.6rem; color:var(--accent-cyan, #38bdf8);">📄 Uploaded Certificates (${activities.length})</h4>
      ${!activities.length ? '<p class="text-muted" style="font-size:0.82rem;">No certificates uploaded yet.</p>' : `
        <div style="max-height:220px; overflow-y:auto;">
          ${activities.map(a => `
            <div class="activity-card mb-1" style="padding:0.6rem 0.8rem;">
              <div class="ac-body">
                <div class="ac-title" style="font-size:0.85rem;">${CATEGORY_LABELS[a.category] || a.category} (${a.semester})</div>
                <div class="ac-meta" style="font-size:0.78rem;">Submitted: ${fmtDate(a.submitted_at)} · ${a.calculated_points} pts</div>
              </div>
              <div class="ac-right">
                ${statusBadge(a.status)}
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  } catch (err) {
    toast(err.message, 'error');
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`;
  }
}

function filterByStudent(id, name) {
  showSection('all');
  document.getElementById('all-filter-status').value = '';
  document.getElementById('all-filter-sem').value    = '';
  // Append student filter manually
  loadAllForStudent(id);
  toast(`Showing activities for ${name}`, 'info');
}

async function loadAllForStudent(studentId) {
  const el = document.getElementById('all-list');
  el.innerHTML = '<div class="empty-state"><div class="empty-icon">🔄</div><p>Loading…</p></div>';
  try {
    const data = await api(`/api/admin/activities?student_id=${studentId}`);
    if (!data.activities.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No activities found.</p></div>';
      return;
    }
    el.innerHTML = data.activities.map(a => renderActivityCard(a, a.status === 'pending')).join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Activity card renderer ─────────────────────────────────────
function renderActivityCard(a, showActions) {
  return `
    <div class="activity-card mb-1">
      <div class="ac-icon" style="background:${catColor(a.category)};">${catIcon(a.category)}</div>
      <div class="ac-body">
        <div class="ac-title">
          ${CATEGORY_LABELS[a.category] || a.category}
          <span class="tag" style="margin-left:0.4rem;">${a.semester}</span>
        </div>
        <div class="ac-meta">
          <strong>${a.student_name}</strong> · ${a.roll_number} · ${a.department}
        </div>
        <div class="ac-meta">
          ${a.sub_category.replace(/_/g,' ')}
          ${a.level ? '· Level ' + a.level : ''}
          ${a.achievement ? '· ' + a.achievement : ''}
          · Submitted ${fmtDate(a.submitted_at)}
        </div>
        ${a.admin_remarks ? `<div style="font-size:0.78rem; color:var(--accent-amber); margin-top:0.2rem;">💬 ${a.admin_remarks}</div>` : ''}
      </div>
      <div class="ac-right">
        <span class="points-bubble">${a.calculated_points} pts</span>
        ${statusBadge(a.status)}
        <div class="d-flex gap-1" style="margin-top:0.25rem; flex-wrap:wrap; justify-content:flex-end;">
          ${a.document_path
            ? `<button class="btn btn-ghost btn-sm" onclick="adminViewDoc('${a.document_path}')">📄 Doc</button>`
            : '<span class="text-muted" style="font-size:0.78rem;">No doc</span>'}
          ${showActions
            ? `<button class="btn btn-secondary btn-sm" onclick="openVerifyModal(${a.id})">Review</button>`
            : ''}
        </div>
      </div>
    </div>`;
}

// ── Verify/Reject Modal ───────────────────────────────────────
function openVerifyModal(id) {
  currentActivityId = id;
  document.getElementById('modal-remarks').value = '';
  document.getElementById('verify-modal').classList.remove('hidden');
}

function closeVerifyModal() {
  document.getElementById('verify-modal').classList.add('hidden');
  currentActivityId = null;
}

async function verifyActivity(status) {
  if (!currentActivityId) return;
  const remarks = document.getElementById('modal-remarks').value.trim();

  try {
    await api(`/api/admin/activities/${currentActivityId}`, 'PATCH', { status, admin_remarks: remarks });
    toast(`Activity ${status} successfully`, 'success');
    closeVerifyModal();
    loadPendingCount();
    // Reload whichever section is visible
    const visible = document.querySelector('main section:not(.hidden)');
    if (visible?.id === 'section-pending') loadPending();
    if (visible?.id === 'section-all')     loadAll();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Document view ──────────────────────────────────────────────
function adminViewDoc(path) {
  const filename = path.split('/').pop();
  // Use /uploads/ static path — no auth header needed for img/iframe src
  const url = `/uploads/${filename}`;
  const body  = document.getElementById('doc-modal-body');
  const modal = document.getElementById('doc-modal');

  const ext = filename.split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','webp'].includes(ext)) {
    body.innerHTML = `<img src="${url}" style="max-width:100%; border-radius:var(--radius-md);" alt="Document" />`;
  } else {
    body.innerHTML = `<iframe src="${url}" style="width:100%; height:500px; border:none; border-radius:var(--radius-md);"></iframe>`;
  }
  modal.classList.remove('hidden');
}

// ── CSV Export ────────────────────────────────────────────────
async function exportCSV() {
  const sem    = document.getElementById('export-sem').value;
  const status = document.getElementById('export-status').value;

  if (!sem) return toast('Please select a semester', 'error');

  const btn = event.currentTarget;
  setLoading(btn, true);
  try {
    await apiDownload(`/api/admin/export/${sem}?status_filter=${status}`);
    toast(`CSV for ${sem} downloaded successfully!`, 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}
