const fs = require('fs');

function updateMapping(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // Inject attachments mapping right after attachmentKind
  const attachmentKindRegex = /attachmentKind:\s*attachmentKind,/g;
  const attachmentKindReplacement = `attachmentKind: attachmentKind,
            status: String(row?.status || "sent").trim(),
            attachments: Array.isArray(row?.message_attachments) 
              ? row.message_attachments.map(a => ({
                  id: a.id,
                  url: a.file_url,
                  name: a.file_name,
                  type: a.file_type,
                  size: a.file_size,
                  kind: a.file_type?.startsWith('image/') ? 'image' : a.file_type?.startsWith('video/') ? 'video' : 'document'
                }))
              : [],`;

  code = code.replace(attachmentKindRegex, attachmentKindReplacement);

  fs.writeFileSync(filePath, code);
  console.log('Updated mapping ' + filePath);
}

try {
  updateMapping('src/app/pages/admin/AdminMessages.jsx');
  updateMapping('src/app/pages/teacher/TeacherMessages.jsx');
} catch (e) {
  console.error(e);
}
