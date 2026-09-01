const fs = require('fs');
const path = require('path');
const files = [];
function getFiles(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) getFiles(p);
    else if (p.endsWith('.jsx') || p.endsWith('.js')) files.push(p);
  });
}
getFiles('C:/Users/lych0/Downloads/ConnectEd/src');
const tables = new Set();
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const regex = /\.from\(['"]([^'"]+)['"]\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    tables.add(match[1]);
  }
});
console.log(Array.from(tables).sort());
