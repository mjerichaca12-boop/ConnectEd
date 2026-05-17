const fs = require('fs');
const path = require('path');
const os = require('os');

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const localIp = getLocalIp();
const backendPort = 3001;
const backendUrl = `http://${localIp}:${backendPort}`;

console.log(`📡 Detected Local IP: ${localIp}`);
console.log(`🔗 Backend URL: ${backendUrl}`);

// Files to update
const files = [
    {
        path: path.join(__dirname, '../.env'),
        pattern: /VITE_BACKEND_URL=.*/g,
        replacement: `VITE_BACKEND_URL=${backendUrl}`
    },
    {
        path: path.join(__dirname, '../mobile/.env'),
        pattern: /EXPO_PUBLIC_BACKEND_URL=.*/g,
        replacement: `EXPO_PUBLIC_BACKEND_URL=${backendUrl}`
    }
];

files.forEach(file => {
    if (fs.existsSync(file.path)) {
        try {
            let content = fs.readFileSync(file.path, 'utf8');
            if (file.pattern.test(content)) {
                content = content.replace(file.pattern, file.replacement);
            } else {
                content += `\n${file.replacement.split('=')[0]}=${file.replacement.split('=')[1]}`;
            }
            fs.writeFileSync(file.path, content);
            console.log(`✅ Updated: ${path.relative(process.cwd(), file.path)}`);
        } catch (err) {
            console.error(`❌ Failed to update ${file.path}:`, err.message);
        }
    } else {
        // Create if doesn't exist (optional, but let's do it for mobile)
        if (file.path.includes('mobile')) {
            fs.writeFileSync(file.path, `EXPO_PUBLIC_BACKEND_URL=${backendUrl}\n`);
            console.log(`✅ Created: ${path.relative(process.cwd(), file.path)}`);
        }
    }
});

console.log('\n🚀 Done! You can now start your servers.');
