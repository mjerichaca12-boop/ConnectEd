const fs = require('fs');
const path = require('path');

const studentFile = path.join(__dirname, 'src/app/pages/admin/StudentManagement.jsx');
let content = fs.readFileSync(studentFile, 'utf8');

content = content.replace(
  /console\.error\(\`Failed to generate account for \$\{student\.lrn\}:\`, JSON\.stringify\(err, null, 2\)\);/g,
  `console.error(\`Failed to generate account for \$\{student.lrn\}:\`, err.message || err);`
);

fs.writeFileSync(studentFile, content, 'utf8');
console.log('done');
