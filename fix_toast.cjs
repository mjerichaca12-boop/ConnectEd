const fs = require('fs');

function fixClassDetailAnnouncements(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // Remove state declarations
  code = code.replace(/const \[annError,\s*setAnnError\]\s*=\s*useState\([^)]*\);\s*\n?/g, '');
  code = code.replace(/const \[annSuccess,\s*setAnnSuccess\]\s*=\s*useState\([^)]*\);\s*\n?/g, '');

  // Replace setAnnSuccess with toast.success
  code = code.replace(/setAnnSuccess\(([^)]+)\);/g, (match, arg) => {
    if (arg.trim() === '""' || arg.trim() === "''") {
      return '';
    }
    return `toast.success(${arg});`;
  });

  // Replace setAnnError with toast.error
  code = code.replace(/setAnnError\(([^)]+)\);/g, (match, arg) => {
    if (arg.trim() === '""' || arg.trim() === "''") {
      return '';
    }
    return `toast.error(${arg});`;
  });

  // Remove the inline UI elements
  // {annError && <p className="text-sm text-red-600 mt-2">{annError}</p>}
  code = code.replace(/\{annError\s*&&\s*<p[^>]*>\{annError\}<\/p>\}\s*\n?/g, '');
  
  // {annSuccess && <p className="text-sm text-green-600 mt-2">{annSuccess}</p>}
  code = code.replace(/\{annSuccess\s*&&\s*<p[^>]*>\{annSuccess\}<\/p>\}\s*\n?/g, '');

  // {annError && ( <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2"> <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" /> <span>{annError}</span> </div> )}
  code = code.replace(/\{annError\s*&&\s*\([\s\S]*?<span>\{annError\}<\/span>[\s\S]*?<\/div>\s*\)\}\s*\n?/g, '');

  // If there are any stray {annSuccess && ...} or {annError && ...} blocks left, we can clean them up, but the above should cover it.
  
  // Ensure the module compiles without unused variable warnings if any are left
  // Actually, wait, let's also remove any `annError` or `annSuccess` variables from the dependencies array of hooks if they are there. But they shouldn't be.
  
  fs.writeFileSync(filePath, code);
  console.log('Updated ClassDetail.jsx toast messages.');
}

try {
  fixClassDetailAnnouncements('src/app/pages/teacher/ClassDetail.jsx');
} catch (e) {
  console.error(e);
}
