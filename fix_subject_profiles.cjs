const fs = require('fs');
const path = require('path');

const subjectFile = path.join(__dirname, 'src/app/pages/admin/SubjectManagement.jsx');
let content = fs.readFileSync(subjectFile, 'utf8');

if (!content.includes('import { adminApi }')) {
  content = content.replace(
    /import \{ supabase \} from "\.\.\/\.\.\/lib\/supabaseClient";/g,
    `import { supabase } from "../../lib/supabaseClient";\nimport { adminApi } from "../../lib/adminApi";`
  );
}

content = content.replace(
  /const \{ error: updateError \} = await supabase\n        \.from\("profiles"\)\n        \.update\(\{ subjects: assignedSubjectIds \}\)\n        \.eq\("id", teacherId\);/g,
  `const { error: updateError } = await adminApi.db("profiles", "update", {
        payload: { subjects: assignedSubjectIds },
        eq: { column: "id", value: teacherId }
      });`
);

fs.writeFileSync(subjectFile, content, 'utf8');
console.log('done fixing subject management profiles update');
