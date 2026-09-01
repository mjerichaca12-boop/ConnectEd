const fs = require('fs');
const path = require('path');

const adminApiFile = path.join(__dirname, 'src/app/lib/adminApi.js');
let content = fs.readFileSync(adminApiFile, 'utf8');

content = content.replace(
  /const token = session\?\.access_token;/g,
  `const token = session?.access_token;\n      if (!token) {\n        throw new Error("Your session has expired. Please log in again.");\n      }`
);

fs.writeFileSync(adminApiFile, content, 'utf8');
console.log('done');
