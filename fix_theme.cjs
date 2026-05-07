const fs = require('fs');
const path = require('path');

const dirs = [
  'src/app/pages/admin',
  'src/app/pages/teacher',
  'src/app/components' // including components since things like modals are there
];

function processFile(filePath) {
  // Ignore these specific files we already fixed manually or that don't need these global replaces
  if (filePath.includes('Login.jsx') || 
      filePath.includes('Landing.jsx') ||
      filePath.includes('TeacherDashboard.jsx') ||
      filePath.includes('AdminDashboard.jsx') ||
      filePath.includes('TeacherSidebar.jsx') ||
      filePath.includes('AdminSidebar.jsx') ||
      filePath.includes('Navigation.jsx') ||
      filePath.includes('AboutSection.jsx') ||
      filePath.includes('ConfirmDialog.jsx')
     ) {
    // We already fixed these manually, we skip full generic replace to be safe.
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Backgrounds
  content = content.replace(/bg-gray-950/g, 'bg-gray-50');
  content = content.replace(/bg-gray-900\/60/g, 'bg-white');
  content = content.replace(/bg-gray-900\/50/g, 'bg-gray-50');
  content = content.replace(/bg-gray-900/g, 'bg-white');
  content = content.replace(/bg-gray-800/g, 'bg-gray-200');
  content = content.replace(/bg-black\/20/g, 'bg-gray-50');
  content = content.replace(/bg-white\/5/g, 'bg-gray-50');
  content = content.replace(/bg-white\/4/g, 'bg-gray-50');
  content = content.replace(/bg-white\/10/g, 'bg-gray-100');
  content = content.replace(/bg-white\/8/g, 'bg-gray-100');

  // Text colors
  content = content.replace(/text-white/g, 'text-gray-900');
  content = content.replace(/text-gray-400/g, 'text-gray-600');
  content = content.replace(/text-gray-300/g, 'text-gray-700');
  content = content.replace(/text-emerald-400/g, 'text-green-600');
  content = content.replace(/text-emerald-500/g, 'text-green-600');
  
  // Specific fix for text-gray-900 on buttons, which might be wrong now
  // We'll leave it for now, can fix buttons manually if needed.

  // Borders
  content = content.replace(/border-white\/10/g, 'border-gray-200');
  content = content.replace(/border-white\/8/g, 'border-gray-200');
  content = content.replace(/border-white\/5/g, 'border-gray-100');
  content = content.replace(/border-emerald-500\/30/g, 'border-green-300');
  content = content.replace(/border-emerald-500\/20/g, 'border-green-200');
  
  // Custom backgrounds for states
  content = content.replace(/bg-blue-500\/10/g, 'bg-blue-50');
  content = content.replace(/bg-emerald-500\/10/g, 'bg-green-50');
  content = content.replace(/bg-red-500\/10/g, 'bg-red-50');
  content = content.replace(/bg-purple-500\/10/g, 'bg-purple-50');
  content = content.replace(/bg-amber-500\/10/g, 'bg-amber-50');
  
  content = content.replace(/border-blue-500\/20/g, 'border-blue-200');
  content = content.replace(/border-red-500\/20/g, 'border-red-200');
  content = content.replace(/border-purple-500\/20/g, 'border-purple-200');
  content = content.replace(/border-amber-500\/20/g, 'border-amber-200');

  // Accents
  content = content.replace(/emerald/g, 'green');

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log('Updated', filePath);
  }
}

function walk(dir) {
  let list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    let stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      walk(file);
    } else if (file.endsWith('.jsx')) {
      processFile(file);
    }
  });
}

dirs.forEach(d => walk(d));
console.log('Done inner pages');
