const fs = require('fs');
const path = require('path');

const STORE_PATH = process.env.VERCEL
  ? path.join('/tmp', 'ktu_points_store.json')
  : path.join(__dirname, '..', 'ktu_points_store.json');

class JsDatabase {
  constructor() {
    this.data = {
      students: [],
      admins: [],
      activities: [],
      password_resets: [],
      seq: { students: 0, admins: 0, activities: 0, password_resets: 0 }
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = { ...this.data, ...parsed };
      }
    } catch (e) {
      console.warn('[JsDB] Load store warning:', e.message);
    }
  }

  save() {
    try {
      fs.writeFileSync(STORE_PATH, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.warn('[JsDB] Save store warning:', e.message);
    }
  }

  exec(sql) {
    // DDL compatibility execution
    return true;
  }

  prepare(sql) {
    const self = this;
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    return {
      get(params = []) {
        const arr = Array.isArray(params) ? params : [params];
        
        // PRAGMA table_info
        if (cleanSql.includes('PRAGMA table_info(students)')) {
          return [{ name: 'email' }];
        }

        // Students lookup by roll
        if (cleanSql.includes('SELECT id FROM students WHERE roll_number = ?')) {
          const found = self.data.students.find(s => s.roll_number === arr[0]);
          return found ? { id: found.id } : undefined;
        }

        // Students lookup by email
        if (cleanSql.includes('SELECT id FROM students WHERE email = ?')) {
          const found = self.data.students.find(s => s.email === arr[0]);
          return found ? { id: found.id } : undefined;
        }

        // Admin lookup by username
        if (cleanSql.includes('SELECT * FROM admins WHERE username = ?')) {
          return self.data.admins.find(a => a.username === arr[0]);
        }

        // Student lookup by roll OR email
        if (cleanSql.includes('SELECT * FROM students WHERE roll_number = ? OR email = ?')) {
          return self.data.students.find(s => s.roll_number === arr[0] || (s.email && s.email === arr[1]));
        }

        // Student lookup by email OR roll
        if (cleanSql.includes('SELECT * FROM students WHERE email = ? OR roll_number = ?')) {
          return self.data.students.find(s => (s.email && s.email === arr[0]) || s.roll_number === arr[1]);
        }

        // Password resets verification
        if (cleanSql.includes('SELECT * FROM password_resets')) {
          const email = arr[0];
          const otp = arr[1];
          const now = new Date().toISOString();
          const match = self.data.password_resets
            .filter(r => r.email === email && r.otp === otp && r.used === 0 && r.expires_at > now)
            .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
          return match;
        }

        // Activity lookup by ID
        if (cleanSql.includes('SELECT id FROM activities WHERE id = ?')) {
          const found = self.data.activities.find(a => a.id === Number(arr[0]));
          return found ? { id: found.id } : undefined;
        }

        // Count queries
        if (cleanSql.includes('SELECT COUNT(*) AS c FROM students')) {
          return { c: self.data.students.length };
        }
        if (cleanSql.includes('SELECT COUNT(*) AS c FROM activities WHERE status=\'pending\'') || cleanSql.includes("status='pending'")) {
          return { c: self.data.activities.filter(a => a.status === 'pending').length };
        }
        if (cleanSql.includes('SELECT COUNT(*) AS c FROM activities WHERE status=\'verified\'') || cleanSql.includes("status='verified'")) {
          return { c: self.data.activities.filter(a => a.status === 'verified').length };
        }
        if (cleanSql.includes('SELECT COUNT(*) AS c FROM activities WHERE status=\'rejected\'') || cleanSql.includes("status='rejected'")) {
          return { c: self.data.activities.filter(a => a.status === 'rejected').length };
        }
        if (cleanSql.includes('SELECT COUNT(*) AS c FROM activities')) {
          return { c: self.data.activities.length };
        }

        return undefined;
      },

      all(params = []) {
        const arr = Array.isArray(params) ? params : [params];

        // PRAGMA table_info
        if (cleanSql.includes('PRAGMA table_info(students)')) {
          return [
            { name: 'id' }, { name: 'roll_number' }, { name: 'name' },
            { name: 'email' }, { name: 'password_hash' }, { name: 'department' }, { name: 'batch_year' }
          ];
        }

        // Student activities query
        if (cleanSql.includes('FROM activities a JOIN students s ON s.id = a.student_id WHERE a.student_id = ?')) {
          const studentId = Number(arr[0]);
          const semFilter = arr[1];
          let list = self.data.activities.filter(a => a.student_id === studentId);
          if (semFilter) list = list.filter(a => a.semester === semFilter);
          const student = self.data.students.find(s => s.id === studentId) || {};
          return list.map(a => ({ ...a, student_name: student.name, roll_number: student.roll_number }))
                     .sort((a,b) => new Date(b.submitted_at) - new Date(a.submitted_at));
        }

        // Admin activities query
        if (cleanSql.includes('FROM activities a JOIN students s ON s.id = a.student_id')) {
          let list = [...self.data.activities];
          
          if (cleanSql.includes('a.status = ?')) {
            const statusVal = arr.find(p => ['pending','verified','rejected'].includes(p));
            if (statusVal) list = list.filter(a => a.status === statusVal);
          }
          if (cleanSql.includes('a.semester = ?')) {
            const semVal = arr.find(p => typeof p === 'string' && p.startsWith('S'));
            if (semVal) list = list.filter(a => a.semester === semVal);
          }
          if (cleanSql.includes('a.student_id = ?')) {
            const stId = arr.find(p => typeof p === 'number' || (!isNaN(p) && Number(p) > 0));
            if (stId) list = list.filter(a => a.student_id === Number(stId));
          }

          return list.map(a => {
            const s = self.data.students.find(st => st.id === a.student_id) || {};
            return {
              ...a,
              student_name: s.name || 'Student',
              roll_number: s.roll_number || 'N/A',
              department: s.department || 'N/A',
              batch_year: s.batch_year || 2024
            };
          }).sort((a,b) => new Date(b.submitted_at) - new Date(a.submitted_at));
        }

        // Admin students list
        if (cleanSql.includes('FROM students s LEFT JOIN activities a')) {
          return self.data.students.map(s => {
            const studentActs = self.data.activities.filter(a => a.student_id === s.id);
            const verifiedPts = studentActs.filter(a => a.status === 'verified').reduce((sum, a) => sum + (a.calculated_points || 0), 0);
            return {
              id: s.id,
              roll_number: s.roll_number,
              name: s.name,
              department: s.department,
              batch_year: s.batch_year,
              total_activities: studentActs.length,
              verified_points: verifiedPts
            };
          }).sort((a,b) => a.name.localeCompare(b.name));
        }

        // Group by semester stats
        if (cleanSql.includes('GROUP BY semester')) {
          const verified = self.data.activities.filter(a => a.status === 'verified');
          const groups = {};
          for (const a of verified) {
            if (!groups[a.semester]) groups[a.semester] = { semester: a.semester, count: 0, total_pts: 0 };
            groups[a.semester].count += 1;
            groups[a.semester].total_pts += a.calculated_points || 0;
          }
          return Object.values(groups).sort((a,b) => a.semester.localeCompare(b.semester));
        }

        // Group by category stats
        if (cleanSql.includes('GROUP BY category')) {
          const verified = self.data.activities.filter(a => a.status === 'verified');
          const groups = {};
          for (const a of verified) {
            if (!groups[a.category]) groups[a.category] = { category: a.category, count: 0 };
            groups[a.category].count += 1;
          }
          return Object.values(groups);
        }

        return [];
      },

      run(params = []) {
        const arr = Array.isArray(params) ? params : [params];

        // Insert Student
        if (cleanSql.includes('INSERT INTO students')) {
          self.data.seq.students += 1;
          const newStudent = {
            id: self.data.seq.students,
            roll_number: arr[0],
            name: arr[1],
            email: arr[2],
            password_hash: arr[3],
            department: arr[4],
            batch_year: arr[5],
            created_at: new Date().toISOString()
          };
          self.data.students.push(newStudent);
          self.save();
          return { lastInsertRowid: newStudent.id, changes: 1 };
        }

        // Insert Admin
        if (cleanSql.includes('INSERT INTO admins')) {
          self.data.seq.admins += 1;
          const newAdmin = {
            id: self.data.seq.admins,
            username: arr[0],
            password_hash: arr[1]
          };
          self.data.admins.push(newAdmin);
          self.save();
          return { lastInsertRowid: newAdmin.id, changes: 1 };
        }

        // Insert Activity
        if (cleanSql.includes('INSERT INTO activities')) {
          self.data.seq.activities += 1;
          const newAct = {
            id: self.data.seq.activities,
            student_id: Number(arr[0]),
            semester: arr[1],
            category: arr[2],
            sub_category: arr[3],
            level: arr[4],
            achievement: arr[5],
            institution_type: arr[6],
            document_path: arr[7],
            document_type: arr[8],
            extra_details: arr[9],
            calculated_points: Number(arr[10]) || 0,
            status: 'pending',
            admin_remarks: null,
            submitted_at: new Date().toISOString(),
            verified_at: null
          };
          self.data.activities.push(newAct);
          self.save();
          return { lastInsertRowid: newAct.id, changes: 1 };
        }

        // Insert Password Reset
        if (cleanSql.includes('INSERT INTO password_resets')) {
          self.data.seq.password_resets += 1;
          const newReset = {
            id: self.data.seq.password_resets,
            email: arr[0],
            otp: arr[1],
            expires_at: arr[2],
            used: 0,
            created_at: new Date().toISOString()
          };
          self.data.password_resets.push(newReset);
          self.save();
          return { lastInsertRowid: newReset.id, changes: 1 };
        }

        // Update Student Password
        if (cleanSql.includes('UPDATE students SET password_hash = ? WHERE email = ?')) {
          const passHash = arr[0];
          const email = arr[1];
          const st = self.data.students.find(s => s.email === email);
          if (st) st.password_hash = passHash;
          self.save();
          return { changes: 1 };
        }

        // Update Password Reset used
        if (cleanSql.includes('UPDATE password_resets SET used = 1 WHERE id = ?')) {
          const resetId = Number(arr[0]);
          const r = self.data.password_resets.find(rec => rec.id === resetId);
          if (r) r.used = 1;
          self.save();
          return { changes: 1 };
        }

        // Update Activity Status
        if (cleanSql.includes('UPDATE activities SET status = ?')) {
          const status = arr[0];
          const remarks = arr[1];
          const actId = Number(arr[2]);
          const act = self.data.activities.find(a => a.id === actId);
          if (act) {
            act.status = status;
            act.admin_remarks = remarks;
            act.verified_at = new Date().toISOString();
          }
          self.save();
          return { changes: 1 };
        }

        return { changes: 0 };
      }
    };
  }
}

module.exports = JsDatabase;
