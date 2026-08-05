/**
 * KTU Activity Points Engine
 * Implements the full rules matrix for all 5 categories.
 *
 * @param {Object} activityData - The activity submission data
 * @returns {{ points: number, breakdown: string }}
 */
function calculatePoints(activityData) {
  const {
    category,
    sub_category,
    level,           // 'I' | 'II' | 'III' | 'IV' | 'V'
    achievement,     // 'participation' | '1st' | '2nd' | '3rd'
    institution_type,// 'iit_nit' | 'ktu' (for cat 3 presentations)
    extra_details,   // parsed JSON object with boolean flags
  } = activityData;

  const extras = typeof extra_details === 'string'
    ? JSON.parse(extra_details || '{}')
    : (extra_details || {});

  const levelIndex = { I: 0, II: 1, III: 2, IV: 3, V: 4 };
  const idx = levelIndex[level];

  switch (category) {
    case 'national_initiatives':
      return calcNationalInitiatives(sub_category, extras);

    case 'sports':
      return calcSports(idx, achievement);

    case 'professional':
      return calcProfessional(sub_category, idx, institution_type, extras);

    case 'entrepreneurship':
      return calcEntrepreneurship(sub_category);

    case 'leadership':
      return calcLeadership(sub_category, achievement);

    default:
      return { points: 0, breakdown: 'Unknown category' };
  }
}

// ──────────────────────────────────────────────────────────────
// 1. NATIONAL INITIATIVES (NCC / NSS)
// ──────────────────────────────────────────────────────────────
function calcNationalInitiatives(sub_category, extras) {
  const validSubs = ['ncc', 'nss'];
  if (!validSubs.includes(sub_category)) {
    return { points: 0, breakdown: 'Invalid sub-category for National Initiatives' };
  }

  let base = 60;
  let cap  = 60;
  let bonusNotes = [];

  // Bonuses are additive; cap raises accordingly
  if (extras.c_certificate || extras.outstanding) {
    base += 20;
    cap = Math.max(cap, 80);
    bonusNotes.push('C-Certificate/Outstanding +20');
  }
  if (extras.best_nss_university || extras.pre_rd_camp) {
    base += 10;
    cap = Math.max(cap, 70);
    bonusNotes.push('Best NSS University/Pre-RD Camp +10');
  }
  if (extras.rd_camp || extras.best_nss_state_national || extras.international_exchange) {
    base += 20;
    cap = Math.max(cap, 80);
    bonusNotes.push('RD Camp/Best NSS National/Int. Exchange +20');
  }

  const points = Math.min(base, cap);
  const breakdown = `${sub_category.toUpperCase()} Base=60, Bonuses=[${bonusNotes.join(', ')}], Cap=${cap} → ${points} pts`;
  return { points, breakdown };
}

// ──────────────────────────────────────────────────────────────
// 2. SPORTS, GAMES & CULTURAL (Music / Arts)
// ──────────────────────────────────────────────────────────────
function calcSports(idx, achievement) {
  if (idx === undefined || idx < 0 || idx > 4) {
    return { points: 0, breakdown: 'Invalid level for Sports/Cultural' };
  }

  const baseMatrix  = [8, 15, 25, 40, 60];
  const prizeMatrix = {
    '1st': [10, 10, 10, 20, 20],
    '2nd': [8,   8,  8, 16, 16],
    '3rd': [5,   5,  5, 12, 12],
  };

  const base       = baseMatrix[idx];
  const prizeBonus = achievement && achievement !== 'participation'
    ? (prizeMatrix[achievement]?.[idx] ?? 0)
    : 0;

  // Cap logic: Level IV (idx=3) or V (idx=4) AND has prize → cap = 80, else 60
  const isHighLevelWinner = (idx >= 3) && prizeBonus > 0;
  const cap    = isHighLevelWinner ? 80 : 60;
  const points = Math.min(base + prizeBonus, cap);

  const breakdown = `Level ${['I','II','III','IV','V'][idx]}, Base=${base}, Prize=${prizeBonus}, Cap=${cap} → ${points} pts`;
  return { points, breakdown };
}

// ──────────────────────────────────────────────────────────────
// 3. PROFESSIONAL SELF INITIATIVES
// ──────────────────────────────────────────────────────────────
function calcProfessional(sub_category, idx, institution_type, extras) {
  switch (sub_category) {
    case 'tech_fest_quiz': {
      const matrix = [10, 20, 30, 40, 50];
      if (idx === undefined) return { points: 0, breakdown: 'Level required for Tech Fest/Quiz' };
      const points = Math.min(matrix[idx] ?? 0, 50);
      return { points, breakdown: `Tech Fest/Quiz Level=${['I','II','III','IV','V'][idx]}, Points=${points}` };
    }

    case 'mooc': {
      return { points: 50, breakdown: 'MOOC with Assessment: 50 pts' };
    }

    case 'society_competition': {
      const matrix = [10, 15, 20, 30, 40];
      if (idx === undefined) return { points: 0, breakdown: 'Level required for Society Competition' };
      const points = Math.min(matrix[idx] ?? 0, 40);
      return { points, breakdown: `Society Competition Level=${['I','II','III','IV','V'][idx]}, Points=${points}` };
    }

    case 'conference_seminar': {
      if (institution_type === 'iit_nit') {
        return { points: 15, breakdown: 'Conference/Seminar at IIT/NIT: 15 pts (cap 30)' };
      }
      return { points: 6, breakdown: 'Conference/Seminar at KTU/Affiliated: 6 pts (cap 12)' };
    }

    case 'paper_presentation': {
      if (institution_type === 'iit_nit') {
        const bonus  = extras.cert_of_recognition ? 10 : 0;
        const points = Math.min(20 + bonus, 40);
        return { points, breakdown: `Paper @ IIT/NIT: 20 + Recognition Bonus=${bonus} → ${points} pts (cap 40)` };
      }
      const bonus  = extras.cert_of_recognition ? 2 : 0;
      const points = Math.min(8 + bonus, 16);
      return { points, breakdown: `Paper @ KTU: 8 + Recognition Bonus=${bonus} → ${points} pts (cap 16)` };
    }

    case 'poster_presentation': {
      if (institution_type === 'iit_nit') {
        const bonus  = extras.cert_of_recognition ? 10 : 0;
        const points = Math.min(10 + bonus, 20);
        return { points, breakdown: `Poster @ IIT/NIT: 10 + Recognition Bonus=${bonus} → ${points} pts (cap 20)` };
      }
      const bonus  = extras.cert_of_recognition ? 2 : 0;
      const points = Math.min(4 + bonus, 8);
      return { points, breakdown: `Poster @ KTU: 4 + Recognition Bonus=${bonus} → ${points} pts (cap 8)` };
    }

    case 'industrial_training': {
      return { points: 20, breakdown: 'Industrial Training/Internship ≥5 days: 20 pts' };
    }

    case 'industrial_visit': {
      return { points: 5, breakdown: 'Industrial Visit: 5 pts (cap 10)' };
    }

    case 'foreign_language': {
      return { points: 50, breakdown: 'Foreign Language (TOEFL/IELTS): 50 pts' };
    }

    default:
      return { points: 0, breakdown: 'Unknown Professional sub-category' };
  }
}

// ──────────────────────────────────────────────────────────────
// 4. ENTREPRENEURSHIP & INNOVATION
// ──────────────────────────────────────────────────────────────
function calcEntrepreneurship(sub_category) {
  const lookup = {
    startup_registered:  { points: 60, note: 'Start-up legally registered' },
    patent_filed:        { points: 30, note: 'Patent Filed' },
    patent_published:    { points: 35, note: 'Patent Published' },
    patent_approved:     { points: 50, note: 'Patent Approved' },
    patent_licensed:     { points: 80, note: 'Patent Licensed' },
    prototype_awards:    { points: 60, note: 'Prototype Tested/Awards/Innovative Tech' },
    venture_capital:     { points: 80, note: 'Venture Capital / Startup Employment' },
    societal_innovation: { points: 50, note: 'Societal Innovation' },
  };

  const entry = lookup[sub_category];
  if (!entry) return { points: 0, breakdown: 'Unknown Entrepreneurship sub-category' };
  return { points: entry.points, breakdown: `${entry.note}: ${entry.points} pts` };
}

// ──────────────────────────────────────────────────────────────
// 5. LEADERSHIP & MANAGEMENT
// ──────────────────────────────────────────────────────────────
function calcLeadership(sub_category, role) {
  // sub_category: 'society_club' | 'elected_representative'
  if (sub_category === 'society_club') {
    const rolePoints = { core_coordinator: 15, sub_coordinator: 10, volunteer: 5 };
    const points = Math.min(rolePoints[role] ?? 0, 40);
    return { points, breakdown: `Society/Club ${role}: ${points} pts (cap 40)` };
  }

  if (sub_category === 'elected_representative') {
    const rolePoints = { chairman: 30, secretary: 25, council_member: 15 };
    const points = Math.min(rolePoints[role] ?? 0, 60);
    return { points, breakdown: `Elected ${role}: ${points} pts (cap 60)` };
  }

  return { points: 0, breakdown: 'Unknown Leadership sub-category' };
}

// ──────────────────────────────────────────────────────────────
// CATEGORY-LEVEL CAPS
// Enforce per-category accumulation caps on the admin side
// ──────────────────────────────────────────────────────────────
const CATEGORY_CAPS = {
  national_initiatives: 80,
  sports:               80,
  professional:        Infinity, // sub-caps applied per sub-category
  entrepreneurship:    Infinity,
  leadership:           60,
};

module.exports = { calculatePoints, CATEGORY_CAPS };
