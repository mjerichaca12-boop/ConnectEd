const fs = require('fs');
const path = require('path');

const usersApiFile = path.join(__dirname, 'api/admin/users.js');
let usersApi = fs.readFileSync(usersApiFile, 'utf8');

usersApi = usersApi.replace(
  /\n  const supabaseAdmin = getSupabaseAdmin\(\);\n\n  try {/g,
  `\n  try {\n    const supabaseAdmin = getSupabaseAdmin();`
);
fs.writeFileSync(usersApiFile, usersApi, 'utf8');

const profilesApiFile = path.join(__dirname, 'api/admin/profiles.js');
let profilesApi = fs.readFileSync(profilesApiFile, 'utf8');

profilesApi = profilesApi.replace(
  /\n  const supabaseAdmin = getSupabaseAdmin\(\);\n\n  try {/g,
  `\n  try {\n    const supabaseAdmin = getSupabaseAdmin();`
);
fs.writeFileSync(profilesApiFile, profilesApi, 'utf8');

console.log('done fixing 500');
