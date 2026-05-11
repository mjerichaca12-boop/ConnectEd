const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('Starting ConnectEd Backend and Unstoppable Tunnel...');

// 1. Start the Backend Server
const backend = spawn('node', ['index.js'], { stdio: 'inherit' });

backend.on('error', (err) => {
    console.error('Failed to start backend:', err);
});

let tunnel;

function startTunnel() {
    console.log('-> Launching SSH Tunnel to localhost.run...');
    tunnel = spawn('ssh', [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ServerAliveInterval=60', // Keep connection active
        '-R', '80:127.0.0.1:3000',
        'nokey@localhost.run'
    ]);

    tunnel.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(output);
        
        // Look for the URL in the output
        const match = output.match(/https?:\/\/[a-z0-9]+\.lhr\.life/);
        if (match) {
            const url = match[0];
            console.log('\n=================================================');
            console.log('ACTIVE TUNNEL URL:', url);
            console.log('=================================================\n');
            
            // AUTOMATICALLY UPDATE THE MOBILE .env FILE!
            const envPath = path.join(__dirname, '../mobile/.env');
            try {
                if (fs.existsSync(envPath)) {
                    let envContent = fs.readFileSync(envPath, 'utf8');
                    envContent = envContent.replace(/EXPO_PUBLIC_BACKEND_URL=.*/g, `EXPO_PUBLIC_BACKEND_URL=${url}`);
                    fs.writeFileSync(envPath, envContent);
                    console.log('✅ Successfully auto-updated mobile/.env with the new tunnel URL!');
                    console.log('⚠️ IMPORTANT: Please completely close and restart your Expo server (npm start -c) to apply the new URL!');
                }
            } catch (err) {
                console.error('Failed to auto-update .env file:', err);
            }
        }
    });

    tunnel.stderr.on('data', (data) => {
        console.log(data.toString());
    });

    tunnel.on('close', (code) => {
        console.log(`\n❌ Tunnel sequence broke with exit code ${code}. Reconnecting in 3 seconds...\n`);
        setTimeout(startTunnel, 3000); // Auto-reconnect!
    });
}

// 2. Start the tunnel sequence
startTunnel();

// Process cleanup
process.on('SIGINT', () => {
    backend.kill();
    if (tunnel) tunnel.kill();
    process.exit();
});

// Keep process alive
setInterval(() => {}, 1000);
