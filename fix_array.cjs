const fs = require('fs');
const path = require('path');

const studentFile = path.join(__dirname, 'src/app/pages/admin/StudentManagement.jsx');
let content = fs.readFileSync(studentFile, 'utf8');

content = content.replace(
  /const idsToProcess = specificIds \? new Set\(specificIds\) : selectedMasterlistIds;/g,
  `const idsToProcess = Array.isArray(specificIds) ? new Set(specificIds) : selectedMasterlistIds;`
);

fs.writeFileSync(studentFile, content, 'utf8');
console.log('done');
