const fs = require('fs');
const file = 'src/app/pages/teacher/ClassDetail.jsx';
let content = fs.readFileSync(file, 'utf8');

const startMat = content.indexOf('{activeTab === "materials" && (');
const startAnn = content.indexOf('{activeTab === "announcements" && (');

if (startMat !== -1 && startAnn !== -1) {
  content = content.slice(0, startMat) + content.slice(startAnn);
}

const startQuiz = content.indexOf('{activeTab === "quiz" && (');
const endQuiz = content.indexOf('{/* ••••• ADD STUDENT MODAL ••••• */}');

if (startQuiz !== -1 && endQuiz !== -1) {
  content = content.slice(0, startQuiz) + content.slice(endQuiz);
}

content = content.replace('useState("students")', 'useState("lessons")');

// I also need to remove the comment block for announcements if I removed the tab. Wait, I kept announcements tab.
// I will also replace the old comment for announcements to ensure everything looks clean.

fs.writeFileSync(file, content);
console.log('Successfully pruned ClassDetail.jsx');
