const fs = require('fs');
const path = require('path');

const envPath = path.resolve('C:/Users/lych0/Downloads/ConnectEd/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) env[key.trim()] = valueParts.join('=').trim();
});

async function run() {
  try {
    const url = `${env.VITE_SUPABASE_URL}/rest/v1/`;
    console.log('Fetching OpenAPI spec from:', url);
    const response = await fetch(url, {
      headers: {
        'apikey': env.VITE_SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.VITE_SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
    if (!response.ok) {
      console.error('Failed to fetch OpenAPI spec:', response.status);
      return;
    }
    const spec = await response.json();
    console.log('Paths in OpenAPI spec:');
    const rpcs = Object.keys(spec.paths).filter(p => p.startsWith('/rpc/'));
    console.log(rpcs);
  } catch (e) {
    console.error('Error fetching OpenAPI:', e);
  }
}
run();
