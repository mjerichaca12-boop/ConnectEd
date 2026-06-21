const fs = require('fs');

function updateAdmin(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // 5. Update handleSend logic
  const handleSendRegex = /const handleSend = async \(e\) => \{[\s\S]*?setIsUploading\(false\);\s*\n\s*\};/;
  const handleSendReplacement = `const handleSend = async (e) => {
    e.preventDefault();
    const text = String(messageInput || "").trim();
    const activeConversation = selectedConv;
    const adminSenderId = adminId || HARDCODED_ADMIN_ID;
    if ((!text && attachmentFiles.length === 0) || !activeConversation || !adminSenderId || !supabase) return;

    setIsUploading(true);

    const recipientIds = activeConversation.isGroup
      ? buildStableIdList(activeConversation.participantIds)
      : [String(activeConversation.participantId || "").trim()].filter(Boolean);

    if (recipientIds.length === 0) { setPageError("No recipients found."); setIsUploading(false); return; }

    const now = new Date().toISOString();
    let uploadedAttachments = [];

    if (attachmentFiles.length > 0) {
      for (const file of attachmentFiles) {
        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
          setPageError("File too large. Max 10MB.");
          setIsUploading(false);
          return;
        }
        const cleanedName = sanitizeAttachmentFileName(file.name);
        const filePath = \`\${adminSenderId}/\${activeConversation.participantId || "group"}/\${Date.now()}_\${cleanedName}\`;
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
    }

    const messageText = text || (uploadedAttachments.length > 0 ? \`Sent \${uploadedAttachments.length} attachment(s)\` : "");
    
    let insertPayload;
    if (activeConversation.isGroup) {
      insertPayload = [{
        sender_id: adminSenderId,
        receiver_id: null,
        conversation_id: activeConversation.id,
        message_text: messageText,
        content: messageText,
        timestamp: now,
        status: "sent"
      }];
    } else {
      insertPayload = recipientIds.map((recipientId) => ({
        sender_id: adminSenderId,
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
        .from("messages")
        .insert(insertPayload)
        .select("id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size, is_read, status");
      data = result.data;
      error = result.error;
    } catch (err) {
      error = err;
    }

    if (error) {
      console.error("[AdminMessages] Supabase insert failed:", error);
      setPageError(\`Failed to send: \${error.message}\`);
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

    if (data && data.length > 0) {
      const msg = {
        id: String(data[0].id || \`\${Date.now()}_\${Math.random()}\`),
        from: "admin",
        senderName: adminName || 'Admin',
        text: messageText,
        time: String(data[0].timestamp || now),
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
    }

    setMessageInput("");
    setAttachmentFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPageError("");
    setIsUploading(false);
  };`;
  code = code.replace(handleSendRegex, handleSendReplacement);

  // 6. Update handleAttachmentChange
  const handleAttachmentChangeRegex = /const handleAttachmentChange = \(e\) => \{[\s\S]*?\n\s*\};/;
  const handleAttachmentChangeReplacement = `const handleAttachmentChange = (e) => {
    const files = Array.from(e.target.files || []);
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

  fs.writeFileSync(filePath, code);
  console.log('Updated ' + filePath);
}

try {
  updateAdmin('src/app/pages/admin/AdminMessages.jsx');
} catch (e) {
  console.error(e);
}
