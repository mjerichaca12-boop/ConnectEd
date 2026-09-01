const fs = require('fs');

function patchGradesManagement() {
  const file = 'src/app/pages/teacher/GradesManagement.jsx';
  let code = fs.readFileSync(file, 'utf8');

  // 1. Update normalizeSubmission
  code = code.replace(
    /const normalizeSubmission = \(row\) => \(\{\n  assessmentId: String\(row\?\.assessment_id \|\| ""\)\.trim\(\),\n  studentId: String\(row\?\.student_id \|\| ""\)\.trim\(\),\n  responseText: String\(row\?\.response_text \|\| row\?\.answer_text \|\| row\?\.response \|\| ""\)\.trim\(\),\n  fileUrl: String\(row\?\.file_url \|\| ""\)\.trim\(\),\n  fileName: String\(row\?\.file_name \|\| ""\)\.trim\(\),\n  filePath: String\(row\?\.file_path \|\| ""\)\.trim\(\),\n  submittedAt: row\?\.submitted_at \|\| row\?\.updated_at \|\| row\?\.created_at \|\| null,\n\}\);/g,
    const normalizeSubmission = (row) => ({
  assessmentId: String(row?.assessment_id || "").trim(),
  studentId: String(row?.student_id || "").trim(),
  responseText: String(row?.response_text || row?.answer_text || row?.response || "").trim(),
  fileUrl: String(row?.file_url || "").trim(),
  fileName: String(row?.file_name || "").trim(),
  filePath: String(row?.file_path || "").trim(),
  submittedAt: row?.submitted_at || row?.updated_at || row?.created_at || null,
  status: String(row?.status || "Submitted").trim(),
});
  );

  // 2. Update fetchAssessmentSubmissions query
  code = code.replace(
    /select\("id, assessment_id, student_id, response_text, file_url, file_name, file_path, submitted_at, updated_at, created_at"\)/g,
    select("id, assessment_id, student_id, response_text, file_url, file_name, file_path, submitted_at, updated_at, created_at, status")
  );

  // 3. Update StudentGradebookModal usage
  code = code.replace(
    /<StudentGradebookModal\s*\n\s*student=\{selectedStudentForModal\}\s*\n\s*assessmentItems=\{assessmentItems\}\s*\n\s*submissions=\{assessmentSubmissionsMap\}\s*\n\s*grades=\{gradesCache\?\.\[selectedClass\]\?\.\[selectedStudentForModal\.id\] \|\| \{\}\}\s*\n\s*onClose=\{/g,
    <StudentGradebookModal
          student={selectedStudentForModal}
          assessmentItems={assessmentItems}
          submissions={assessmentSubmissionsMap}
          grades={assessmentGradesMap}
          studentOverallGrades={gradesCache?.[selectedClass]?.[selectedStudentForModal.id] || {}}
          onClose={
  );

  fs.writeFileSync(file, code);
  console.log("Patched GradesManagement.jsx");
}

function patchModal() {
  const file = 'src/app/pages/teacher/components/StudentGradebookModal.jsx';
  let code = fs.readFileSync(file, 'utf8');

  // Fix props
  code = code.replace(
    /grades\n\}\) \{/g,
    grades,
  studentOverallGrades
}) {
  );

  // Fix loop bindings
  code = code.replace(
    /const submission = submissions\?\.\[activity\.id\];\n\s*const grade = grades\?\.\[activity\.id\];\n\n\s*const mappedActivity = \{\n\s*\.\.\.activity,\n\s*score: grade\?\.score,\n\s*status: submission\?\.status \|\| "Not Submitted",\n\s*submitted_at: submission\?\.submitted_at,\n\s*content: submission\?\.content,\n\s*attachment: submission\?\.files\?\.\[0\]\n\s*\};/g,
    const submission = submissions?.[activity.id]?.[student.id];
    const grade = grades?.[activity.id]?.[student.id];

    const mappedActivity = {
      ...activity,
      score: typeof grade === 'object' ? grade.grade : grade,
      status: submission?.status || "Not Submitted",
      submitted_at: submission?.submittedAt,
      content: submission?.responseText,
      attachment: submission?.fileUrl ? { url: submission.fileUrl, name: submission.fileName } : null
    };
  );

  // Fix calculateAverage bindings
  code = code.replace(
    /const grade = grades\?\.\[a\.id\];\n\s*totalScore \+= Number\(grade\?\.score \|\| 0\);/g,
    const grade = grades?.[a.id]?.[student.id];
      const numericGrade = typeof grade === 'object' ? grade.grade : grade;
      totalScore += Number(numericGrade || 0);
  );

  // Fix overall grade binding
  code = code.replace(
    /const overallGrade = grades\?\.overallGrade \|\| 0;/g,
    const overallGrade = studentOverallGrades?.overallGrade || 0;
  );

  fs.writeFileSync(file, code);
  console.log("Patched StudentGradebookModal.jsx");
}

patchGradesManagement();
patchModal();

