const fs = require('fs');
const path = require('path');

const studentFile = path.join(__dirname, 'src/app/pages/admin/StudentManagement.jsx');
let content = fs.readFileSync(studentFile, 'utf8');

if (!content.includes('const [gradeSectionsMap, setGradeSectionsMap] = useState({});')) {
  content = content.replace(
    /const \[errorMessage, setErrorMessage\] = useState\(""\);/g,
    `const [errorMessage, setErrorMessage] = useState("");\n  const [gradeSectionsMap, setGradeSectionsMap] = useState({});`
  );
  fs.writeFileSync(studentFile, content, 'utf8');
}
console.log('done');
