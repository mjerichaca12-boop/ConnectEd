const fs = require('fs');
const path = require('path');

const studentFile = path.join(__dirname, 'src/app/pages/admin/StudentManagement.jsx');
let content = fs.readFileSync(studentFile, 'utf8');

content = content.replace(
  /const \{ data, error \} = await db\s*\.from\("profiles"\)\s*\.update\(buildPayload\(editFormData\)\)\s*\.eq\("id", selectedStudent\.id\)\s*\.select\(.*?\)\s*\.single\(\);/,
  `const { data, error } = await adminApi.updateProfile(
        selectedStudent.id,
        buildPayload(editFormData)
      );`
);

fs.writeFileSync(studentFile, content, 'utf8');

const teacherFile = path.join(__dirname, 'src/app/pages/admin/TeacherManagement.jsx');
let content2 = fs.readFileSync(teacherFile, 'utf8');

content2 = content2.replace(
  /const \{ data, error \} = await db\.from\("profiles"\)\.update\(payload\)\.eq\("id", selectedTeacher\.id\)\.select\(teacherSelectColumns\)\.single\(\);/,
  `const { data, error } = await adminApi.updateProfile(selectedTeacher.id, payload);`
);

content2 = content2.replace(
  /const \{ error: profileError \} = await db\.from\("profiles"\)\.update\(\{\s*must_change_password: resetSettings\.forceChange,\s*last_password_reset: new Date\(\)\.toISOString\(\)\s*\}\)\.eq\("id", selectedTeacher\.id\);/,
  `const { error: profileError } = await adminApi.updateProfile(selectedTeacher.id, {
        must_change_password: resetSettings.forceChange,
        last_password_reset: new Date().toISOString()
      });`
);

fs.writeFileSync(teacherFile, content2, 'utf8');
console.log('done');
