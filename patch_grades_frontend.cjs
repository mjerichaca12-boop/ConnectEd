const fs = require('fs');
const file = 'src/app/pages/teacher/GradesManagement.jsx';
let code = fs.readFileSync(file, 'utf8');

const injectionPoint = '.on("postgres_changes", { event: "INSERT", schema: "public", table: "submissions" }';

const newListeners = `
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "teacher_assessment_grades" }, (payload) => {
        const row = payload.new;
        if (!row || String(row.teacher_id) !== String(teacherId)) return;
        setAssessmentGradesMap(prev => {
          const next = { ...prev };
          if (!next[row.assessment_id]) next[row.assessment_id] = {};
          next[row.assessment_id][row.student_id] = { grade: row.grade_value, status: row.status };
          return next;
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "teacher_assessment_grades" }, (payload) => {
        const row = payload.new;
        if (!row || String(row.teacher_id) !== String(teacherId)) return;
        setAssessmentGradesMap(prev => {
          const next = { ...prev };
          if (!next[row.assessment_id]) next[row.assessment_id] = {};
          next[row.assessment_id][row.student_id] = { grade: row.grade_value, status: row.status };
          return next;
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "teacher_assessment_grades" }, (payload) => {
        const row = payload.old;
        if (!row || String(row.teacher_id) !== String(teacherId)) return;
        setAssessmentGradesMap(prev => {
          const next = { ...prev };
          if (next[row.assessment_id]) {
            delete next[row.assessment_id][row.student_id];
          }
          return next;
        });
      })
      `;

if (!code.includes('table: "teacher_assessment_grades"')) {
  code = code.replace(injectionPoint, newListeners + injectionPoint);
  fs.writeFileSync(file, code);
  console.log('Injected Grades listeners!');
} else {
  console.log('Already injected.');
}
