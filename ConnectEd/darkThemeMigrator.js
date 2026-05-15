const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src/app/pages/teacher');

const replacements = [
  { regex: /min-h-screen\s+bg-gray-50/g, replacement: 'min-h-screen bg-gray-950' },
  { regex: /bg-white\/80\s+backdrop-blur-md\s+border-b\s+border-gray-200/g, replacement: 'bg-gray-950/80 backdrop-blur-md border-b border-white/8' },
  { regex: /(?<!-)bg-white(?![\\/\\w-])/g, replacement: 'bg-gray-900/60' },
  { regex: /(?<!-)bg-gray-50(?![\\/\\w-])/g, replacement: 'bg-black/20' },
  { regex: /(?<!-)bg-gray-100(?![\\/\\w-])/g, replacement: 'bg-white/5' },
  { regex: /(?<!-)text-gray-900(?![\\/\\w-])/g, replacement: 'text-white' },
  { regex: /(?<!-)text-gray-800(?![\\/\\w-])/g, replacement: 'text-gray-200' },
  { regex: /(?<!-)text-gray-700(?![\\/\\w-])/g, replacement: 'text-gray-300' },
  { regex: /(?<!-)text-gray-600(?![\\/\\w-])/g, replacement: 'text-gray-400' },
  { regex: /(?<!-)border-gray-100(?![\\/\\w-])/g, replacement: 'border-white/5' },
  { regex: /(?<!-)border-gray-200(?![\\/\\w-])/g, replacement: 'border-white/10' },
  { regex: /(?<!-)border-gray-300(?![\\/\\w-])/g, replacement: 'border-white/20' },
  { regex: /(?<!-)divide-gray-100(?![\\/\\w-])/g, replacement: 'divide-white/5' },
  { regex: /(?<!-)divide-gray-200(?![\\/\\w-])/g, replacement: 'divide-white/10' },
  { regex: /(?<!-)hover:bg-gray-50(?![\\/\\w-])/g, replacement: 'hover:bg-white/5' },
  { regex: /(?<!-)hover:bg-gray-100(?![\\/\\w-])/g, replacement: 'hover:bg-white/10' },
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  replacements.forEach(({ regex, replacement }) => {
    content = content.replace(regex, replacement);
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated: ' + path.basename(filePath));
  }
}

const files = fs.readdirSync(directoryPath);
for (const file of files) {
  const fullPath = path.join(directoryPath, file);
  if (fullPath.endsWith('.jsx')) {
    processFile(fullPath);
  }
}

console.log('Done.');
