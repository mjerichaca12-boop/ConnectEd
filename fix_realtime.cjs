const fs = require('fs');

function updateRealtime(filePath, isTeacher) {
  let code = fs.readFileSync(filePath, 'utf8');

  // We need to find the postgres_changes callback for INSERT
  const realtimeRegex = /const newMsg = payload\.new;\s*if \(!newMsg\) return;\s*(?:appendIncomingMessage|appendMessage)\(newMsg/;
  
  if (isTeacher) {
    const replacement = `const newMsg = payload.new;
        if (!newMsg) return;
        
        // Fetch attachments for this new message to show immediately in real-time
        const { data: attData } = await supabase
          .from("message_attachments")
          .select("id, file_url, file_name, file_type, file_size")
          .eq("message_id", newMsg.id);
          
        if (attData && attData.length > 0) {
          newMsg.message_attachments = attData;
        }

        appendIncomingMessage(newMsg`;
    code = code.replace(realtimeRegex, replacement);
  } else {
    // AdminMessages.jsx uses appendMessage
    const adminRegex = /const newMsg = payload\.new;\s*if \(!newMsg\) return;\s*appendMessage\(newMsg/;
    const replacement = `const newMsg = payload.new;
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
    code = code.replace(adminRegex, replacement);
  }

  fs.writeFileSync(filePath, code);
  console.log('Updated real-time ' + filePath);
}

try {
  updateRealtime('src/app/pages/admin/AdminMessages.jsx', false);
  updateRealtime('src/app/pages/teacher/TeacherMessages.jsx', true);
} catch (e) {
  console.error(e);
}
