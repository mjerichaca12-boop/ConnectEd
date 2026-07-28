const fs = require('fs');
const path = require('path');

const adminApiFile = path.join(__dirname, 'src/app/lib/adminApi.js');
let content = fs.readFileSync(adminApiFile, 'utf8');

content = content.replace(
  /const err = new Error\(errorMsg\);\n\s*err\.status = status;\n\s*throw err;/g,
  `console.error("[adminApi] API Error:", errorMsg);
        const err = new Error(errorMsg);
        err.status = status;
        throw err;`
);

fs.writeFileSync(adminApiFile, content, 'utf8');
console.log('done');
