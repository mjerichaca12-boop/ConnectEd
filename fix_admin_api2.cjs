const fs = require('fs');
const path = require('path');

const adminApiFile = path.join(__dirname, 'src/app/lib/adminApi.js');
let adminApi = fs.readFileSync(adminApiFile, 'utf8');

adminApi = adminApi.replace(
  /const \{ data: \{ session \} \} = await supabase\.auth\.getSession\(\);\n      const token = session\?\.access_token;\n      if \(!token\) \{\n        throw new Error\("Your session has expired. Please log in again."\);\n      \}\n      const headers = \{\n        \.\.\.options\.headers,\n        "Content-Type": "application\/json",\n      \};\n      if \(token\) \{\n        headers\["Authorization"\] = `Bearer \$\{token\}`;\n      \}/g,
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
console.log('done adminApi');
