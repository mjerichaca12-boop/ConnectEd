const fs = require('fs');
const path = require('path');

const dirsToMigrate = [
  'src/app/pages/teacher',
  'src/app/pages/admin',
  'src/app/pages'
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let original = content;

  // Basic layout updates
  content = content.replace(/className="min-h-screen bg-gray-50 flex"/g, 'className="min-h-screen bg-gray-950 flex relative overflow-hidden"');
  content = content.replace(/className="min-h-screen bg-gray-100 flex"/g, 'className="min-h-screen bg-gray-950 flex relative overflow-hidden"');
  content = content.replace(/<main className="flex-1 overflow-y-auto custom-scrollbar relative z-10">/g, '<main className="flex-1 overflow-y-auto scrollbar-hide relative z-10">');
  content = content.replace(/<main className="flex-1 overflow-y-auto custom-scrollbar">/g, '<main className="flex-1 overflow-y-auto scrollbar-hide relative z-10">');
  content = content.replace(/bg-gray-50/g, 'bg-gray-950');
  
  // Top bar updates
  content = content.replace(/bg-white border-b border-gray-200 sticky top-0/g, 'bg-gray-950/80 backdrop-blur-md border-b border-white/8 sticky top-0');
  content = content.replace(/text-gray-900/g, 'text-white');
  content = content.replace(/text-gray-800/g, 'text-gray-200');
  content = content.replace(/text-gray-700/g, 'text-gray-300');
  content = content.replace(/text-gray-600/g, 'text-gray-400');
  // Avoid replacing gray-500 because it looks fine in dark mode
  
  // Cards and boxes
  content = content.replace(/bg-white rounded-xl p-6 border border-gray-200 shadow-sm/g, 'bg-gray-900/60 rounded-xl p-6 border border-white/8');
  content = content.replace(/bg-white rounded-xl p-6 shadow-sm/g, 'bg-gray-900/60 rounded-xl p-6 border border-white/8');
  content = content.replace(/bg-white rounded-2xl p-6 border border-gray-200 shadow-sm/g, 'bg-gray-900/60 rounded-2xl p-6 border border-white/8');
  content = content.replace(/bg-white rounded-xl p-4 border border-gray-200/g, 'bg-gray-900/60 rounded-xl p-4 border border-white/8');
  content = content.replace(/bg-white border/g, 'bg-gray-900 border-white/10');
  content = content.replace(/border-gray-200/g, 'border-white/10');
  content = content.replace(/border-gray-300/g, 'border-white/10');
  content = content.replace(/bg-white/g, 'bg-gray-900/60');
  
  // Inputs
  content = content.replace(/pl-10 pr-4 py-3 border border-white\/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent/g, 'w-full bg-black/20 text-white placeholder-gray-500 pl-10 pr-4 py-3 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-500/50');
  
  // Tables
  content = content.replace(/divide-gray-200/g, 'divide-white/5');
  content = content.replace(/hover:bg-white\/5/g, 'hover:bg-white/5'); // reset if repeated

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated: ${filePath}`);
  }
}

function walkArgs(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkArgs(fullPath);
        } else if (fullPath.endsWith('.jsx')) {
            processFile(fullPath);
        }
    }
}

dirsToMigrate.forEach(dir => {
    try { walkArgs(path.join('c:\\Users\\Jericha Mae Aguirre\\OneDrive\\Desktop\\CAPSTONE\\ConnectEd\\ConnectEd', dir)); } catch(e){}
});
