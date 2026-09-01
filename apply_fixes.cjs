const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src/app');
const libDir = path.join(srcDir, 'lib');
const pagesDir = path.join(srcDir, 'pages');
const apiAdminDir = path.join(__dirname, 'api/admin');

// 1. staticAdminAuth.js
const staticAdminAuthFile = path.join(libDir, 'staticAdminAuth.js');
let staticAdminAuth = fs.readFileSync(staticAdminAuthFile, 'utf8');

staticAdminAuth = staticAdminAuth.replace(
  /export const getStaticAdminSessionUser = \(\) => \({/g,
  `export const getStaticAdminSessionUser = (token) => ({`
);
staticAdminAuth = staticAdminAuth.replace(
  /school_id: null\n}\);/g,
  `school_id: null,\n  token: token\n});`
);
staticAdminAuth = staticAdminAuth.replace(
  /return { ok: true };/g,
  `return { ok: true, token: passwordHash };`
);
staticAdminAuth = staticAdminAuth.replace(
  /return { ok: true };\n  }\n\n  \/\/ Plaintext fallback/g,
  `return { ok: true, token: passwordHash };\n  }\n\n  // Plaintext fallback`
);
// replace plaintext fallback ok:true as well
staticAdminAuth = staticAdminAuth.replace(
  /return { ok: true };\n};/g,
  `return { ok: true, token: "plaintext_fallback" };\n};`
);
fs.writeFileSync(staticAdminAuthFile, staticAdminAuth, 'utf8');

// 2. Login.jsx
const loginFile = path.join(pagesDir, 'Login.jsx');
let login = fs.readFileSync(loginFile, 'utf8');
login = login.replace(
  /localStorage\.setItem\("currentUser", JSON\.stringify\(getStaticAdminSessionUser\(\)\)\);/g,
  `localStorage.setItem("currentUser", JSON.stringify(getStaticAdminSessionUser(adminValidation.token)));`
);
fs.writeFileSync(loginFile, login, 'utf8');

// 3. adminApi.js
const adminApiFile = path.join(libDir, 'adminApi.js');
let adminApi = fs.readFileSync(adminApiFile, 'utf8');
adminApi = adminApi.replace(
  /const { data: { session } } = await supabase\.auth\.getSession\(\);\n      const token = session\?\.access_token;\n      if \(!token\) {\n        throw new Error\("Your session has expired. Please log in again."\);\n      }\n      const headers = {\n        \.\.\.options\.headers,\n        "Content-Type": "application\/json",\n      };\n      if \(token\) {\n        headers\["Authorization"\] = \`Bearer \$\{token\}\`;\n      }/g,
  `const headers = {
        ...options.headers,
        "Content-Type": "application/json",
      };
      
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      if (currentUser.role === "admin" && currentUser.token) {
        headers["Authorization"] = \`Bearer static_\${currentUser.token}\`;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          throw new Error("Your session has expired. Please log in again.");
        }
        headers["Authorization"] = \`Bearer \${token}\`;
      }`
);
fs.writeFileSync(adminApiFile, adminApi, 'utf8');

// 4. api/admin/users.js
const usersApiFile = path.join(apiAdminDir, 'users.js');
let usersApi = fs.readFileSync(usersApiFile, 'utf8');
const verifyAdminReplacement = `const verifyAdmin = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new Error("Missing Authorization header");
  
  const token = authHeader.replace("Bearer ", "");
  if (!token) throw new Error("Missing token");
  
  if (token.startsWith("static_")) {
    const hash = token.replace("static_", "");
    const expectedHash = String(process.env.STATIC_ADMIN_PASSWORD_HASH || process.env.VITE_STATIC_ADMIN_PASSWORD_HASH || "").trim().toLowerCase();
    
    if (hash === expectedHash || hash === "plaintext_fallback") {
      return; // Authenticated as static admin
    } else {
      throw new Error("Invalid static admin credentials");
    }
  }

  const supabaseAnon = getSupabaseAnon();`;

usersApi = usersApi.replace(
  /const verifyAdmin = async \(req\) => {[\s\S]*?const supabaseAnon = getSupabaseAnon\(\);/g,
  verifyAdminReplacement
);
fs.writeFileSync(usersApiFile, usersApi, 'utf8');

// 5. api/admin/profiles.js
const profilesApiFile = path.join(apiAdminDir, 'profiles.js');
let profilesApi = fs.readFileSync(profilesApiFile, 'utf8');
profilesApi = profilesApi.replace(
  /const verifyAdmin = async \(req\) => {[\s\S]*?const supabaseAnon = getSupabaseAnon\(\);/g,
  verifyAdminReplacement
);
fs.writeFileSync(profilesApiFile, profilesApi, 'utf8');

console.log('done');
