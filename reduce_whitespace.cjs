const fs = require('fs');

const landingFiles = [
  'src/app/pages/Landing.jsx',
  'src/app/components/HeroSection.jsx',
  'src/app/components/CoreModules.jsx',
  'src/app/components/UserRoles.jsx',
  'src/app/components/HowItWorks.jsx',
  'src/app/components/AboutSection.jsx',
  'src/app/components/FinalCTA.jsx',
  'src/app/components/Navigation.jsx'
];

function reduceWhitespace(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Reduce large vertical padding/margin
    content = content.replace(/\bpy-24\b/g, 'py-12');
    content = content.replace(/\bpy-20\b/g, 'py-10');
    content = content.replace(/\bpy-16\b/g, 'py-8');
    content = content.replace(/\bpy-12\b/g, 'py-6');
    content = content.replace(/\bmt-24\b/g, 'mt-12');
    content = content.replace(/\bmt-20\b/g, 'mt-10');
    content = content.replace(/\bmt-16\b/g, 'mt-8');
    content = content.replace(/\bmb-24\b/g, 'mb-12');
    content = content.replace(/\bmb-20\b/g, 'mb-10');
    content = content.replace(/\bmb-16\b/g, 'mb-8');
    content = content.replace(/\bgap-16\b/g, 'gap-8');
    content = content.replace(/\bgap-24\b/g, 'gap-12');
    content = content.replace(/\bgap-20\b/g, 'gap-10');

    if (content !== original) {
      fs.writeFileSync(filePath, content);
      console.log('Reduced whitespace in', filePath);
    }
  } catch(e) {
    console.log("Could not process", filePath, e.message);
  }
}

landingFiles.forEach(f => reduceWhitespace(f));
