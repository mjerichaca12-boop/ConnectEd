const fs = require('fs');
const path = require('path');

const logPath = 'C:/Users/lych0/.gemini/antigravity/brain/32cd4ecf-6f6c-45a6-813d-124cf4b877b7/.system_generated/logs/transcript.jsonl';

if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'USER_INPUT' && obj.content && obj.content.includes('MAKE THE NOTIFICATION BELL FULLY FUNCTIONAL')) {
        fs.writeFileSync('C:/Users/lych0/Downloads/ConnectEd/full_prompt.txt', obj.content, 'utf8');
        console.log('Successfully wrote full prompt to full_prompt.txt');
        break;
      }
    } catch (e) {
      // Ignore
    }
  }
} else {
  console.log('Log file not found');
}
