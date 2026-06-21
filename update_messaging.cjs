const fs = require('fs');

function updateFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // 1. Update State
  code = code.replace(
    /const \[attachmentFile, setAttachmentFile\] = useState\(null\);/,
    'const [attachmentFiles, setAttachmentFiles] = useState([]);'
  );

  // 2. Add message mapping logic for attachments and status
  code = code.replace(
    /fileUrl: String\(row\?\.file_url \|\| ""\)\.trim\(\),/,
    `fileUrl: String(row?.file_url || "").trim(),
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
      : [],`
  );

  // 3. Update select queries
  code = code.replace(
    /\.select\("id, sender_id, receiver_id, message_text, timestamp, created_at, file_url, file_name, file_type, file_size, is_read"\)/g,
    '.select("id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size, is_read, status, message_attachments(id, file_url, file_name, file_type, file_size)")'
  );
  code = code.replace(
    /\.select\("id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size, is_read"\)/g,
    '.select("id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size, is_read, status, message_attachments(id, file_url, file_name, file_type, file_size)")'
  );

  // 4. Update Realtime listener
  code = code.replace(
    /\.on\("postgres_changes", \{ event: "INSERT", schema: "public", table: MESSAGE_TABLE \}, async \(payload\) => \{/,
    `.on("postgres_changes", { event: "*", schema: "public", table: MESSAGE_TABLE }, async (payload) => {
        if (payload.eventType === "UPDATE") {
          const updatedMsg = payload.new;
          setConversations(current => current.map(conv => {
            const hasMsg = (conv.messages || []).some(m => String(m.id) === String(updatedMsg.id));
            if (!hasMsg) return conv;
            return {
              ...conv,
              messages: conv.messages.map(m => String(m.id) === String(updatedMsg.id) ? { ...m, status: updatedMsg.status, isRead: updatedMsg.is_read } : m)
            };
          }));
          return;
        }
        // Handle INSERT`
  );

  // 5. Update handleSend logic
  const handleSendRegex = /const handleSend = async \(e\) => \{[\s\S]*?setPageError\(""\);\s*\n\s*\};/;
  const handleSendReplacement = `const handleSend = async (e) => {
    e.preventDefault();
    const text = String(messageInput || "").trim();
    const activeConversation = selectedConv;
    const currentTeacherId = typeof teacherId !== 'undefined' ? teacherId : (typeof adminId !== 'undefined' ? adminId : null);
    if ((!text && attachmentFiles.length === 0) || !activeConversation || !currentTeacherId || !supabase) return;

    const recipientIds = activeConversation.isGroup
      ? buildStableIdList(activeConversation.participantIds)
      : [String(activeConversation.participantId || "").trim()].filter(Boolean);

    if (recipientIds.length === 0) { setPageError("No recipients found."); return; }

    const now = new Date().toISOString();
    let uploadedAttachments = [];

    if (attachmentFiles.length > 0) {
      if (typeof setIsUploadingAttachment !== 'undefined') setIsUploadingAttachment(true);
      if (typeof setIsUploading !== 'undefined') setIsUploading(true);
      for (const file of attachmentFiles) {
        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
          setPageError("File too large. Max 10MB.");
          if (typeof setIsUploadingAttachment !== 'undefined') setIsUploadingAttachment(false);
          if (typeof setIsUploading !== 'undefined') setIsUploading(false);
          return;
        }
        const cleanedName = sanitizeAttachmentFileName(file.name);
        const filePath = \`\${currentTeacherId}/\${activeConversation.id}/\${Date.now()}_\${cleanedName}\`;
        const uploadResult = await supabase.storage
          .from(MESSAGE_ATTACHMENT_BUCKET)
          .upload(filePath, file, { cacheControl: "3600", upsert: false });
        if (!uploadResult.error) {
          const publicUrlResult = supabase.storage.from(MESSAGE_ATTACHMENT_BUCKET).getPublicUrl(filePath);
          uploadedAttachments.push({
            file_url: String(publicUrlResult?.data?.publicUrl || "").trim(),
            file_name: cleanedName,
            file_type: String(file.type || "application/octet-stream").trim(),
            file_size: Number(file.size || 0),
          });
        }
      }
      if (typeof setIsUploadingAttachment !== 'undefined') setIsUploadingAttachment(false);
      if (typeof setIsUploading !== 'undefined') setIsUploading(false);
    }

    const messageText = text || (uploadedAttachments.length > 0 ? \`Sent \${uploadedAttachments.length} attachment(s)\` : "");
    
    let insertPayload;
    if (activeConversation.isGroup) {
      insertPayload = [{
        sender_id: currentTeacherId,
        receiver_id: null,
        conversation_id: activeConversation.id,
        message_text: messageText,
        content: messageText,
        timestamp: now,
        status: "sent"
      }];
    } else {
      insertPayload = recipientIds.map((recipientId) => ({
        sender_id: currentTeacherId,
        receiver_id: recipientId,
        conversation_id: null,
        message_text: messageText,
        content: messageText,
        timestamp: now,
        status: "sent"
      }));
    }

    let data, error;
    try {
      const result = await db
        .from(MESSAGE_TABLE)
        .insert(insertPayload)
        .select("id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size, is_read, status");
      data = result.data;
      error = result.error;
    } catch (err) {
      error = err;
    }

    if (error) {
      console.warn("DB insert failed:", error);
    } else if (data && uploadedAttachments.length > 0) {
      const attachmentPayloads = [];
      for (const msgRow of data) {
        for (const att of uploadedAttachments) {
          attachmentPayloads.push({
            message_id: msgRow.id,
            ...att
          });
        }
      }
      if (attachmentPayloads.length > 0) {
        await db.from("message_attachments").insert(attachmentPayloads);
      }
    }

    const msg = {
      id: String(data?.[0]?.id || \`\${Date.now()}_\${Math.random()}\`),
      from: window.location.pathname.includes("admin") ? "admin" : "teacher",
      senderName: window.location.pathname.includes("admin") ? (typeof adminName !== 'undefined' ? adminName : 'Admin') : (typeof teacherName !== 'undefined' ? teacherName : 'Teacher'),
      text: messageText,
      time: String(data?.[0]?.timestamp || now),
      status: "sent",
      attachments: uploadedAttachments.map(a => ({
        id: Math.random().toString(),
        url: a.file_url,
        name: a.file_name,
        type: a.file_type,
        size: a.file_size,
        kind: a.file_type.startsWith('image/') ? 'image' : a.file_type.startsWith('video/') ? 'video' : 'document'
      }))
    };

    markMessageSeen(msg.id);

    const updated = conversations.map((c) =>
      c.id === activeConversation.id
        ? { ...c, messages: [...(c.messages || []), msg], lastMessageTime: msg.time }
        : c
    );
    saveConversations(updated);
    setMessageInput("");
    setAttachmentFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPageError("");
  };`;
  code = code.replace(handleSendRegex, handleSendReplacement);

  // 6. Update handleAttachmentChange
  const handleAttachmentChangeRegex = /const handleAttachmentChange = \(event\) => \{[\s\S]*?\n\s*\};/;
  const handleAttachmentChangeReplacement = `const handleAttachmentChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    if (attachmentFiles.length + files.length > 10) {
      setPageError("Maximum 10 attachments allowed per message.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const validFiles = [];
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setPageError("One or more files exceed the 10MB limit.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      validFiles.push(file);
    }
    setAttachmentFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPageError("");
  };`;
  code = code.replace(handleAttachmentChangeRegex, handleAttachmentChangeReplacement);

  // Replace clearAttachment
  const clearAttachmentRegex = /const clearAttachment = \(\) => \{[\s\S]*?\n\s*\};/;
  const clearAttachmentReplacement = `const removeAttachment = (index) => {
    setAttachmentFiles(prev => prev.filter((_, i) => i !== index));
  };`;
  code = code.replace(clearAttachmentRegex, clearAttachmentReplacement);

  // 7. Update UI for rendering multiple attachments in chat input
  const inputUiRegex = /\{attachmentFile && \([\s\S]*?clearAttachment[\s\S]*?<\/div>\s*\n\s*\)\}/;
  const inputUiReplacement = `{attachmentFiles.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-2">
              {attachmentFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-gray-200 shadow-sm">
                  <Paperclip className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm text-gray-700 max-w-[150px] truncate">{file.name}</span>
                  <button type="button" onClick={() => removeAttachment(idx)} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}`;
  code = code.replace(inputUiRegex, inputUiReplacement);

  // Update disabled checks for the submit button
  code = code.replace(/!\s*messageInput\.trim\(\)\s*&&\s*!attachmentFile/g, '!messageInput.trim() && attachmentFiles.length === 0');
  
  // Also fix getMessagePreview
  code = code.replace(/if \(message\?\.fileName\) return `Sent \${message.fileName}`;/g, `if (message?.attachments?.length > 0) return \`Sent \${message.attachments.length} attachment(s)\`;`);
  code = code.replace(/attachmentKind:\s*attachmentFile\s*\?\s*getAttachmentKindFromFile\(attachmentFile\)\s*:\s*"",/g, `attachmentKind: attachmentFiles.length > 0 ? getAttachmentKindFromFile(attachmentFiles[0]) : "",`);

  // Update file input to support multiple
  code = code.replace(/<input ref=\{fileInputRef\} type="file" className="hidden" onChange=\{handleAttachmentChange\} accept="\*\/\*" \/>/, '<input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleAttachmentChange} accept="*/*" />');
  code = code.replace(/<input\s+type="file"\s+className="hidden"\s+ref=\{fileInputRef\}\s+onChange=\{handleAttachmentChange\}\s+accept="\*\/\*"\s*\/>/, '<input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleAttachmentChange} accept="*/*" />');

  // 8. Update UI for rendering message bubbles (attachments and status)
  const attachmentRenderRegex = /\{\(msg\.fileUrl \|\| msg\.fileName\) && \([\s\S]*?<\/div>\s*\n\s*\)\}/;
  const attachmentRenderReplacement = `{((msg.attachments && msg.attachments.length > 0) || msg.fileUrl || msg.fileName) && (
                            <div className="mt-2 space-y-2">
                              {!msg.attachments?.length && (msg.fileUrl || msg.fileName) && (
                                <div className={\`flex items-center gap-2 p-2 rounded-lg \${
                                  (typeof isTeacher !== 'undefined' ? isTeacher : (typeof isAdmin !== 'undefined' ? isAdmin : false)) ? "bg-emerald-700/50" : "bg-gray-100"
                                }\`}>
                                  {msg.attachmentKind === "image" ? <img src={msg.fileUrl} alt="attachment" className="max-w-[200px] rounded-md" /> :
                                   msg.attachmentKind === "video" ? <Video className="w-5 h-5" /> :
                                   <FileText className="w-5 h-5" />}
                                  <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm truncate hover:underline flex-1">
                                    {msg.fileName || "Attachment"}
                                  </a>
                                </div>
                              )}
                              
                              {msg.attachments?.map((att, idx) => (
                                <div key={idx} className={\`flex items-center gap-2 p-2 rounded-lg \${
                                  (typeof isTeacher !== 'undefined' ? isTeacher : (typeof isAdmin !== 'undefined' ? isAdmin : false)) ? "bg-emerald-700/50" : "bg-gray-100"
                                }\`}>
                                  {att.kind === "image" ? (
                                    <img src={att.url} alt="attachment" className="max-w-[200px] max-h-[200px] rounded-md object-contain" />
                                  ) : att.kind === "video" ? (
                                    <Video className="w-5 h-5" />
                                  ) : (
                                    <FileText className="w-5 h-5" />
                                  )}
                                  {att.kind !== "image" && (
                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-sm truncate hover:underline flex-1">
                                      {att.name || "Attachment"}
                                    </a>
                                  )}
                                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-black/10 rounded" title="Download">
                                    <Download className="w-4 h-4" />
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}`;
  code = code.replace(attachmentRenderRegex, attachmentRenderReplacement);

  // Add Message Status
  const timeRenderRegex = /<span className="text-xs opacity-70 mt-1 block">([\s\S]*?)<\/span>/g;
  code = code.replace(timeRenderRegex, (match, timeExp) => {
    return '<div className="flex items-center gap-1 mt-1 justify-end">' +
             '<span className="text-[10px] opacity-70">' +
               '{' + timeExp.replace(/[{}]/g, '') + '}' +
             '</span>' +
             '{(typeof isTeacher !== \'undefined\' ? isTeacher : (typeof isAdmin !== \'undefined\' ? isAdmin : false)) && (' +
               '<span className="opacity-70">' +
                 '{msg.status === \'read\' || msg.isRead ? <CheckCheck className="w-3 h-3 text-blue-300" /> : ' +
                  'msg.status === \'delivered\' ? <CheckCheck className="w-3 h-3 text-emerald-200" /> : ' +
                  '<CheckCheck className="w-3 h-3" />}' +
               '</span>' +
             ')}' +
           '</div>';
  });

  fs.writeFileSync(filePath, code);
  console.log('Updated ' + filePath);
}

try {
  updateFile('src/app/pages/teacher/TeacherMessages.jsx');
  updateFile('src/app/pages/admin/AdminMessages.jsx');
} catch (e) {
  console.error(e);
}
