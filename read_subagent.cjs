const fs = require('fs');
const path = require('path');

const logPath = 'C:/Users/lych0/.gemini/antigravity/brain/a9465bd0-b5b3-47bb-9e17-718979317b94/.system_generated/logs/transcript.jsonl';

if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  console.log('Subagent log lines count:', lines.length);
  // Find all messages sent by the subagent or model responses
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.source === 'MODEL' && obj.content) {
        console.log(`--- STEP ${obj.step_index} MODEL CONTENT ---`);
        console.log(obj.content.substring(0, 1000));
        console.log('-----------------------------');
      }
    } catch (e) {}
  }
} else {
  console.log('Subagent log not found at:', logPath);
}
