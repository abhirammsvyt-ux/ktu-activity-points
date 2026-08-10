/* ═══════════════════════════════════════════════════════════
   student.js — Student Portal Logic
   ═══════════════════════════════════════════════════════════ */

let currentUser = {};

document.addEventListener('DOMContentLoaded', () => {
  currentUser = guardAuth('student');
  document.getElementById('sidebar-name').textContent = currentUser.name;
  document.getElementById('sidebar-roll').textContent = currentUser.roll_number;
  loadDashboard();
});

// ── Section navigation ────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.remove('hidden');
  document.getElementById(`nav-${name}`).classList.add('active');

  if (name === 'dashboard') loadDashboard();
  if (name === 'history') loadHistory();
}

// ── Dashboard ─────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await api('/api/activities/my');
    const acts = data.activities;

    document.getElementById('stat-total-acts').textContent = acts.length;
    document.getElementById('stat-verified').textContent   = acts.filter(a => a.status === 'verified').length;
    document.getElementById('stat-pending').textContent    = acts.filter(a => a.status === 'pending').length;

    const verifiedPts = acts
      .filter(a => a.status === 'verified')
      .reduce((s, a) => s + a.calculated_points, 0);
    document.getElementById('stat-total-pts').textContent = verifiedPts;

    renderSemesterBreakdown(data.semester_summary);
  } catch (err) {
    console.error(err);
  }
}

function renderSemesterBreakdown(summary) {
  const el = document.getElementById('semester-breakdown');
  const sems = Object.keys(summary).sort();
  if (!sems.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>No activities submitted yet.<br>
           <a href="#" onclick="showSection('submit')">Submit your first activity →</a>
        </p>
      </div>`;
    return;
  }

  const maxPts = Math.max(...sems.map(s => summary[s].verified_points), 1);

  el.innerHTML = sems.map(sem => {
    const { activities, total_points, verified_points } = summary[sem];
    const pct = Math.round((verified_points / Math.max(maxPts, 80)) * 100);
    return `
      <div style="margin-bottom:1rem;">
        <div class="d-flex justify-between align-center mb-1">
          <div style="font-weight:600;">${sem}</div>
          <div style="font-size:0.82rem; color:var(--text-secondary);">
            ${activities.length} activities · ${verified_points} verified pts
          </div>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

// ── Dynamic form fields ───────────────────────────────────────
const CATEGORY_FIELDS = {
  national_initiatives: `
    <div class="form-group">
      <label class="form-label" for="f-sub">Initiative Type *</label>
      <select id="f-sub" class="form-control" required>
        <option value="">Select</option>
        <option value="ncc">NCC</option>
        <option value="nss">NSS</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Bonus Achievements (select all that apply)</label>
      <div class="checkbox-group">
        <label class="checkbox-item"><input type="checkbox" name="extra" value="c_certificate"> C-Certificate/Outstanding</label>
        <label class="checkbox-item"><input type="checkbox" name="extra" value="best_nss_university"> Best NSS University</label>
        <label class="checkbox-item"><input type="checkbox" name="extra" value="pre_rd_camp"> Pre-RD Camp</label>
        <label class="checkbox-item"><input type="checkbox" name="extra" value="rd_camp"> RD Camp</label>
        <label class="checkbox-item"><input type="checkbox" name="extra" value="best_nss_state_national"> Best NSS State/National</label>
        <label class="checkbox-item"><input type="checkbox" name="extra" value="international_exchange"> Int. Youth Exchange</label>
      </div>
    </div>`,

  sports: `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="f-sub">Activity Type *</label>
        <select id="f-sub" class="form-control" required>
          <option value="">Select</option>
          <option value="sports">Sports / Games</option>
          <option value="cultural_music">Cultural – Music</option>
          <option value="cultural_arts">Cultural – Arts</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="f-level">Level *</label>
        <select id="f-level" class="form-control" required onchange="previewPoints()">
          <option value="">Select Level</option>
          <option value="I">I – College</option>
          <option value="II">II – Zonal</option>
          <option value="III">III – State / University</option>
          <option value="IV">IV – National</option>
          <option value="V">V – International</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="f-achievement">Achievement *</label>
      <select id="f-achievement" class="form-control" required onchange="previewPoints()">
        <option value="participation">Participation</option>
        <option value="1st">1st Prize</option>
        <option value="2nd">2nd Prize</option>
        <option value="3rd">3rd Prize</option>
      </select>
    </div>`,

  professional: `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="f-sub">Sub-Category *</label>
        <select id="f-sub" class="form-control" required onchange="onProfessionalSubChange()">
          <option value="">Select</option>
          <option value="tech_fest_quiz">Tech Fest / Quiz</option>
          <option value="mooc">MOOC with Assessment</option>
          <option value="society_competition">Professional Society Competition</option>
          <option value="conference_seminar">Conference / Seminar</option>
          <option value="paper_presentation">Paper Presentation</option>
          <option value="poster_presentation">Poster Presentation</option>
          <option value="industrial_training">Industrial Training / Internship (≥5 days)</option>
          <option value="industrial_visit">Industrial Visit</option>
          <option value="foreign_language">Foreign Language (TOEFL/IELTS)</option>
        </select>
      </div>
      <div class="form-group" id="prof-level-group" style="display:none;">
        <label class="form-label" for="f-level">Level *</label>
        <select id="f-level" class="form-control" onchange="previewPoints()">
          <option value="">Select Level</option>
          <option value="I">I – College</option>
          <option value="II">II – Zonal</option>
          <option value="III">III – State / University</option>
          <option value="IV">IV – National</option>
          <option value="V">V – International</option>
        </select>
      </div>
    </div>
    <div class="form-group" id="prof-inst-group" style="display:none;">
      <label class="form-label" for="f-inst">Institution Type *</label>
      <select id="f-inst" class="form-control" onchange="previewPoints()">
        <option value="iit_nit">IIT / NIT</option>
        <option value="ktu">KTU / Affiliated College</option>
      </select>
    </div>
    <div class="form-group" id="prof-cert-group" style="display:none;">
      <label class="checkbox-item" style="cursor:pointer;">
        <input type="checkbox" id="f-cert-recognition" onchange="previewPoints()">
        Certificate of Recognition received
      </label>
    </div>`,

  entrepreneurship: `
    <div class="form-group">
      <label class="form-label" for="f-sub">Achievement Type *</label>
      <select id="f-sub" class="form-control" required onchange="previewPoints()">
        <option value="">Select</option>
        <option value="startup_registered">Start-up Legally Registered</option>
        <option value="patent_filed">Patent – Filed</option>
        <option value="patent_published">Patent – Published</option>
        <option value="patent_approved">Patent – Approved</option>
        <option value="patent_licensed">Patent – Licensed</option>
        <option value="prototype_awards">Prototype / Awards / Innovative Tech</option>
        <option value="venture_capital">Venture Capital / Startup Employment</option>
        <option value="societal_innovation">Societal Innovation</option>
      </select>
    </div>`,

  leadership: `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="f-sub">Leadership Type *</label>
        <select id="f-sub" class="form-control" required onchange="previewPoints()">
          <option value="">Select</option>
          <option value="society_club">Society / Chapter / Fest / Hobby Club</option>
          <option value="elected_representative">Elected Representative</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="f-achievement">Your Role *</label>
        <select id="f-achievement" class="form-control" required onchange="previewPoints()">
          <option value="">Select Role</option>
        </select>
      </div>
    </div>`,
};

function onCategoryChange() {
  const cat = document.getElementById('f-category').value;
  const df  = document.getElementById('dynamic-fields');
  df.innerHTML = CATEGORY_FIELDS[cat] || '';
  document.getElementById('doc-section').style.display = cat ? 'block' : 'none';
  document.getElementById('points-preview').classList.add('hidden');

  // Attach change listeners for live preview
  df.querySelectorAll('select, input[type="checkbox"]').forEach(el =>
    el.addEventListener('change', previewPoints)
  );
  if (cat === 'leadership') populateLeadershipRoles();
}

function onProfessionalSubChange() {
  const sub = document.getElementById('f-sub')?.value;
  const needsLevel = ['tech_fest_quiz', 'society_competition'].includes(sub);
  const needsInst  = ['conference_seminar', 'paper_presentation', 'poster_presentation'].includes(sub);
  const needsCert  = ['paper_presentation', 'poster_presentation'].includes(sub);

  const lvlGrp  = document.getElementById('prof-level-group');
  const instGrp = document.getElementById('prof-inst-group');
  const certGrp = document.getElementById('prof-cert-group');

  if (lvlGrp)  lvlGrp.style.display  = needsLevel ? 'block' : 'none';
  if (instGrp) instGrp.style.display = needsInst  ? 'block' : 'none';
  if (certGrp) certGrp.style.display = needsCert  ? 'block' : 'none';

  previewPoints();
}

function populateLeadershipRoles() {
  const subEl  = document.getElementById('f-sub');
  const roleEl = document.getElementById('f-achievement');
  if (!subEl || !roleEl) return;

  subEl.addEventListener('change', () => {
    const sub = subEl.value;
    roleEl.innerHTML = '<option value="">Select Role</option>';
    const roles = sub === 'society_club'
      ? [['core_coordinator','Core Coordinator (15 pts)'], ['sub_coordinator','Sub-Coordinator (10 pts)'], ['volunteer','Volunteer (5 pts)']]
      : [['chairman','Chairman (30 pts)'], ['secretary','Secretary (25 pts)'], ['council_member','Council Member (15 pts)']];
    roles.forEach(([v, l]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = l;
      roleEl.appendChild(o);
    });
    previewPoints();
  });
}

// ── Points preview ────────────────────────────────────────────
async function previewPoints() {
  const body = buildActivityPayload();
  if (!body || !body.category || !body.sub_category) {
    document.getElementById('points-preview').classList.add('hidden');
    return;
  }

  try {
    // We use client-side estimation matching the engine rules
    const { points, breakdown } = clientEstimatePoints(body);
    document.getElementById('preview-pts').textContent       = points + ' pts';
    document.getElementById('preview-breakdown').textContent = breakdown;
    document.getElementById('points-preview').classList.remove('hidden');
  } catch (e) {
    document.getElementById('points-preview').classList.add('hidden');
  }
}

function clientEstimatePoints(body) {
  const levelIndex = { I:0, II:1, III:2, IV:3, V:4 };
  const idx = levelIndex[body.level];
  const extras = body.extra_details || {};

  switch (body.category) {
    case 'national_initiatives': {
      let pts = 60, cap = 60, notes = [];
      if (extras.c_certificate || extras.outstanding) { pts += 20; cap = Math.max(cap,80); notes.push('+20 bonus'); }
      if (extras.best_nss_university || extras.pre_rd_camp) { pts += 10; cap = Math.max(cap,70); notes.push('+10 bonus'); }
      if (extras.rd_camp || extras.best_nss_state_national || extras.international_exchange) { pts += 20; cap = Math.max(cap,80); notes.push('+20 bonus'); }
      return { points: Math.min(pts, cap), breakdown: `Base 60 ${notes.join(', ')} → cap ${cap}` };
    }
    case 'sports': {
      const base = [8,15,25,40,60][idx] ?? 0;
      const prize = { '1st':[10,10,10,20,20], '2nd':[8,8,8,16,16], '3rd':[5,5,5,12,12] };
      const bonus = prize[body.achievement]?.[idx] ?? 0;
      const cap   = (idx >= 3 && bonus > 0) ? 80 : 60;
      return { points: Math.min(base + bonus, cap), breakdown: `Base ${base} + Prize ${bonus}, cap ${cap}` };
    }
    case 'professional': {
      const m = {
        tech_fest_quiz:     { pts: [10,20,30,40,50], cap:50, useLevel:true },
        mooc:               { pts: 50, cap:50 },
        society_competition:{ pts: [10,15,20,30,40], cap:40, useLevel:true },
        conference_seminar: { iit_nit:{ pts:15,cap:30 }, ktu:{ pts:6,cap:12 } },
        paper_presentation: { iit_nit:{ pts:20,cap:40,bonus:10 }, ktu:{ pts:8,cap:16,bonus:2 } },
        poster_presentation:{ iit_nit:{ pts:10,cap:20,bonus:10 }, ktu:{ pts:4,cap:8,bonus:2 } },
        industrial_training:{ pts:20, cap:20 },
        industrial_visit:   { pts:5,  cap:10 },
        foreign_language:   { pts:50, cap:50 },
      };
      const rule = m[body.sub_category];
      if (!rule) return { points:0, breakdown:'–' };
      if (rule.useLevel) {
        const pts = Array.isArray(rule.pts) ? (rule.pts[idx] ?? 0) : rule.pts;
        return { points: Math.min(pts, rule.cap), breakdown:`${pts} pts (cap ${rule.cap})` };
      }
      if (rule.iit_nit) {
        const t = body.institution_type === 'iit_nit' ? rule.iit_nit : rule.ktu;
        const bonus = (extras.cert_of_recognition && t.bonus) ? t.bonus : 0;
        return { points: Math.min(t.pts + bonus, t.cap), breakdown: `${t.pts} + recog. ${bonus} → cap ${t.cap}` };
      }
      return { points: Math.min(rule.pts, rule.cap), breakdown: `${rule.pts} pts` };
    }
    case 'entrepreneurship': {
      const lk = { startup_registered:60, patent_filed:30, patent_published:35, patent_approved:50,
                   patent_licensed:80, prototype_awards:60, venture_capital:80, societal_innovation:50 };
      const p = lk[body.sub_category] ?? 0;
      return { points: p, breakdown: `Fixed ${p} pts` };
    }
    case 'leadership': {
      const society  = { core_coordinator:15, sub_coordinator:10, volunteer:5 };
      const elected  = { chairman:30, secretary:25, council_member:15 };
      const role = body.achievement;
      if (body.sub_category === 'society_club') {
        return { points: Math.min(society[role] ?? 0, 40), breakdown: `${society[role] ?? 0} pts (cap 40)` };
      }
      return { points: Math.min(elected[role] ?? 0, 60), breakdown: `${elected[role] ?? 0} pts (cap 60)` };
    }
    default: return { points:0, breakdown:'–' };
  }
}

// ── Build form payload ─────────────────────────────────────────
function buildActivityPayload() {
  const extras = {};
  document.querySelectorAll('input[name="extra"]:checked').forEach(cb => {
    extras[cb.value] = true;
  });
  const certEl = document.getElementById('f-cert-recognition');
  if (certEl?.checked) extras.cert_of_recognition = true;

  return {
    semester:         document.getElementById('f-semester')?.value || '',
    category:         document.getElementById('f-category')?.value || '',
    sub_category:     document.getElementById('f-sub')?.value || '',
    level:            document.getElementById('f-level')?.value || null,
    achievement:      document.getElementById('f-achievement')?.value || null,
    institution_type: document.getElementById('f-inst')?.value || null,
    document_type:    document.getElementById('f-doc-type')?.value || '',
    extra_details:    extras,
  };
}

// ── Submit activity ───────────────────────────────────────────
async function submitActivity(e) {
  e.preventDefault();
  const payload = buildActivityPayload();
  const fileEl  = document.getElementById('f-doc');

  if (!fileEl.files[0]) return toast('Please upload a supporting document', 'error');

  const formData = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    formData.append(k, k === 'extra_details' ? JSON.stringify(v) : (v ?? ''));
  });
  formData.append('document', fileEl.files[0]);

  const btn = document.getElementById('btn-submit');
  setLoading(btn, true);
  try {
    const res = await api('/api/activities', 'POST', formData, true);
    toast(`Activity submitted! Estimated points: ${res.calculated_points}`, 'success');
    document.getElementById('activity-form').reset();
    document.getElementById('dynamic-fields').innerHTML = '';
    document.getElementById('doc-section').style.display = 'none';
    document.getElementById('points-preview').classList.add('hidden');
    document.getElementById('file-chosen').style.display = 'none';
    loadDashboard();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

// ── File upload UX ────────────────────────────────────────────
function onFileChange(input) {
  const el = document.getElementById('file-chosen');
  if (input.files[0]) {
    el.textContent = `📎 ${input.files[0].name}`;
    el.style.display = 'block';
  }
}

// ── Activity history ──────────────────────────────────────────
async function loadHistory() {
  const sem = document.getElementById('filter-sem')?.value || '';
  const el  = document.getElementById('history-list');
  el.innerHTML = '<div class="empty-state"><div class="empty-icon">🔄</div><p>Loading…</p></div>';

  try {
    const data = await api(`/api/activities/my${sem ? '?semester='+sem : ''}`);
    const acts = data.activities;

    if (!acts.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>No activities found.</p></div>`;
      return;
    }

    el.innerHTML = acts.map(a => `
      <div class="activity-card mb-1">
        <div class="ac-icon" style="background:${catColor(a.category)};">${catIcon(a.category)}</div>
        <div class="ac-body">
          <div class="ac-title">${CATEGORY_LABELS[a.category] || a.category}</div>
          <div class="ac-meta">
            ${a.sub_category.replace(/_/g,' ')}
            ${a.level ? '· Level ' + a.level : ''}
            ${a.achievement ? '· ' + a.achievement : ''}
            · ${a.semester}
            · ${fmtDate(a.submitted_at)}
          </div>
          ${a.admin_remarks ? `<div style="font-size:0.78rem; color:var(--accent-amber); margin-top:0.2rem;">💬 ${a.admin_remarks}</div>` : ''}
        </div>
        <div class="ac-right">
          <span class="points-bubble">${a.calculated_points} pts</span>
          ${statusBadge(a.status)}
          ${a.document_path
            ? `<button class="btn btn-ghost btn-sm" onclick="viewDoc('${a.document_path}')">📄 View</button>`
            : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── View uploaded document ────────────────────────────────────
function viewDoc(path) {
  const filename = path.split('/').pop();
  const url = `/uploads/${filename}`;
  const body = document.getElementById('modal-body');
  const modal = document.getElementById('doc-modal');

  const ext = filename.split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','webp'].includes(ext)) {
    body.innerHTML = `<img src="${url}" style="max-width:100%; border-radius:var(--radius-md);" alt="Document" />`;
  } else {
    body.innerHTML = `<iframe src="${url}" style="width:100%; height:480px; border:none; border-radius:var(--radius-md);"></iframe>`;
  }
  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('doc-modal').classList.add('hidden');
}
