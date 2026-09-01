const fs = require('fs');
const path = require('path');

const adminApiFile = path.join(__dirname, 'src/app/lib/adminApi.js');
let adminApi = fs.readFileSync(adminApiFile, 'utf8');

adminApi = adminApi.replace(
  /  async deleteUser\(id\) \{\n    return this\.fetchWithToken\(\`\/api\/admin\/users\?id=\$\{id\}\`, \{ method: "DELETE" \}\);\n  \}/g,
  `  async deleteUser(id) {
    return this.fetchWithToken(\`/api/admin/users?id=\${id}\`, { method: "DELETE" });
  },

  async db(table, action, options = {}) {
    return this.fetchWithToken("/api/admin/db", {
      method: "POST",
      body: JSON.stringify({ table, action, ...options }),
    });
  }`
);

fs.writeFileSync(adminApiFile, adminApi, 'utf8');
console.log('done adminApi');
