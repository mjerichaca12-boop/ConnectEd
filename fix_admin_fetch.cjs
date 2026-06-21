const fs = require('fs');

function fixAdminFetch(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // Fix the DB select for direct messages
  const oldSelectRegex = /\.select\("id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size"\)\s*\.or\(adminFilter\)/;
  
  const newSelectReplacement = `.select("id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size, is_read, status, message_attachments(id, file_url, file_name, file_type, file_size)")
          .or(adminFilter)`;

  code = code.replace(oldSelectRegex, newSelectReplacement);
  
  // Also re-apply realtime fix for AdminMessages if missing
  const adminRegex = /const newMsg = payload\.new;\s*if \(!newMsg\) return;\s*appendMessage\(newMsg/;
  if (adminRegex.test(code)) {
    const realtimeReplacement = `const newMsg = payload.new;
        if (!newMsg) return;
        
        // Fetch attachments for this new message to show immediately in real-time
        const { data: attData } = await db
          .from("message_attachments")
          .select("id, file_url, file_name, file_type, file_size")
          .eq("message_id", newMsg.id);
          
        if (attData && attData.length > 0) {
          newMsg.message_attachments = attData;
        }

        appendMessage(newMsg`;
    code = code.replace(adminRegex, realtimeReplacement);
  }

  fs.writeFileSync(filePath, code);
  console.log('Updated AdminMessages fetch and realtime.');
}

try {
  fixAdminFetch('src/app/pages/admin/AdminMessages.jsx');
} catch (e) {
  console.error(e);
}
