const fs = require('fs');
const path = require('path');

const studentFile = path.join(__dirname, 'src/app/pages/admin/StudentManagement.jsx');
let content = fs.readFileSync(studentFile, 'utf8');

// Replace profiles upsert
content = content.replace(
  /const \{ error: profileError \} = await db\.from\("profiles"\)\.upsert\(\{\n          id: userId,\n          role: "student",\n          first_name: student\.first_name,\n          last_name: student\.last_name,\n          middle_name: student\.middle_name,\n          lrn: normalizedLRN,\n          year_level: student\.year_level,\n          section: student\.section,\n          email: email,\n          status: "Active",\n          must_change_password: true,\n          is_verified: false\n        \}, \{ onConflict: "id" \}\);/g,
  `const { error: profileError } = await adminApi.db("profiles", "upsert", {
          payload: {
            id: userId,
            role: "student",
            first_name: student.first_name,
            last_name: student.last_name,
            middle_name: student.middle_name,
            lrn: normalizedLRN,
            year_level: student.year_level,
            section: student.section,
            email: email,
            status: "Active",
            must_change_password: true,
            is_verified: false
          },
          onConflict: "id"
        });`
);

// Replace masterlist update
content = content.replace(
  /const \{ error: masterlistError \} = await db\.from\("student_masterlist"\)\n          \.update\(\{ account_created: true \}\)\n          \.eq\("id", student\.id\);/g,
  `const { error: masterlistError } = await adminApi.db("student_masterlist", "update", {
          payload: { account_created: true },
          eq: { column: "id", value: student.id }
        });`
);

fs.writeFileSync(studentFile, content, 'utf8');
console.log('done fixing student management db calls');
