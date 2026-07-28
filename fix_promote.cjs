const fs = require('fs');
const path = require('path');

const studentFile = path.join(__dirname, 'src/app/pages/admin/StudentManagement.jsx');
let content = fs.readFileSync(studentFile, 'utf8');

content = content.replace(
  /const handleGenerateAccounts = async \(\) => \{/g,
  `const handleGenerateAccounts = async (specificIds = null) => {`
);

content = content.replace(
  /const selected = masterlist\.filter\(m => selectedMasterlistIds\.has\(m\.id\) && !m\.account_created\);/g,
  `const idsToProcess = specificIds ? new Set(specificIds) : selectedMasterlistIds;
    const selected = masterlist.filter(m => idsToProcess.has(m.id) && !m.account_created);`
);

content = content.replace(
  /onClick=\{\(\) => handlePromoteMasterlist\(\[student\.id\]\)\}\s*disabled=\{isPromotingMasterlist\}/g,
  `onClick={() => handleGenerateAccounts([student.id])}\n                                      disabled={isGenerating}`
);

fs.writeFileSync(studentFile, content, 'utf8');
console.log('done');
