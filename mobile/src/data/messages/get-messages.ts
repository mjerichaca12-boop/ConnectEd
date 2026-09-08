import { supabase } from "../../lib/supabase";

const getAttachmentKindFromFileType = (fileType?: string) => {
    const normalizedType = String(fileType || "").toLowerCase();
    if (normalizedType.startsWith("image/")) return "image";
    if (normalizedType.startsWith("video/")) return "video";
    if (normalizedType) return "document";
    return "";
};

const normalizeMessage = (row: any) => {
    let fileUrl = String(row?.file_url || "").trim();
    let fileName = String(row?.file_name || "").trim();
    let fileType = String(row?.file_type || "").trim();
    let fileSize = Number(row?.file_size || 0);
    let content = String(row?.content || row?.message_text || "").trim();

    // Check message_attachments relation
    let attachments: any[] = [];
    if (Array.isArray(row?.message_attachments) && row.message_attachments.length > 0) {
        attachments = row.message_attachments.map((att: any) => ({
            id: att.id,
            file_url: String(att.file_url || "").trim(),
            file_name: String(att.file_name || "").trim(),
            file_type: String(att.file_type || "").trim(),
            file_size: Number(att.file_size || 0),
        })).filter((att: any) => Boolean(att.file_url));

        if (!fileUrl && attachments.length > 0) {
            fileUrl = attachments[0].file_url;
            fileName = fileName || attachments[0].file_name;
            fileType = fileType || attachments[0].file_type;
            fileSize = fileSize || attachments[0].file_size;
        }
    }

    if (!fileUrl && row?.content) {
        try {
            const parsedContent = JSON.parse(row.content);
            if (parsedContent && typeof parsedContent === "object") {
                fileUrl = String(parsedContent.file_url || "").trim();
                fileName = String(parsedContent.file_name || fileName || "").trim();
                fileType = String(parsedContent.file_type || fileType || "").trim();
                fileSize = Number(parsedContent.file_size || fileSize || 0);
                content = String(parsedContent.message_text || parsedContent.content || content).trim();
            }
        } catch {
            // Leave content as-is when it is plain text.
        }
    }

    const attachmentKind = getAttachmentKindFromFileType(fileType);

    return {
        ...row,
        content,
        message_text: String(row?.message_text || content || "").trim(),
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_type: fileType || null,
        file_size: Number.isFinite(fileSize) ? fileSize : 0,
        attachments: attachments.length > 0 ? attachments : (fileUrl ? [{ file_url: fileUrl, file_name: fileName, file_type: fileType, file_size: fileSize }] : []),
        attachmentKind,
    };
};

export async function getMessages(id: string, isRoom?: boolean) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Not authenticated");

    const SELECT_FIELDS = '*, message_attachments(id, file_url, file_name, file_type, file_size)';

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = UUID_REGEX.test(id);
    const isGroup = id.startsWith('group_');

    // If id is explicitly a group or room
    if (!isUuid || isGroup || isRoom) {
        let query = isUuid
            ? supabase.from('messages').select(SELECT_FIELDS).or(`conversation_id.eq.${id},room_id.eq.${id}`)
            : supabase.from('messages').select(SELECT_FIELDS).eq('conversation_id', id);

        let { data, error } = await query.order('created_at', { ascending: true }).limit(150);

        if (error && error.message?.includes('message_attachments')) {
            const fallbackQuery = isUuid
                ? supabase.from('messages').select('*').or(`conversation_id.eq.${id},room_id.eq.${id}`)
                : supabase.from('messages').select('*').eq('conversation_id', id);
            const fallback = await fallbackQuery.order('created_at', { ascending: true }).limit(150);
            data = fallback.data;
            error = fallback.error;
        }

        if (error) {
            console.error('[messages] Group fetch error:', error);
            return [];
        }
        return (data || []).map(normalizeMessage);
    }

    // Direct one-to-one chat: execute directly without trial-and-error delays
    let { data: directData, error: directError } = await supabase
        .from('messages')
        .select(SELECT_FIELDS)
        .or(`and(sender_id.eq.${userData.user.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${userData.user.id})`)
        .order('created_at', { ascending: true })
        .limit(150);

    if (directError && directError.message?.includes('message_attachments')) {
        const fallback = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${userData.user.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${userData.user.id})`)
            .order('created_at', { ascending: true })
            .limit(150);
        directData = fallback.data;
        directError = fallback.error;
    }

    if (directError) {
        console.error('[messages] Direct fetch error:', directError);
        return [];
    }
    return (directData || []).map(normalizeMessage);
}

export async function sendMessage(
    targetId: string, 
    content: string, 
    fileUrl?: string, 
    fileType?: string, 
    isRoom: boolean = false,
    customFileName?: string
) {
    console.log('Sending message:', { targetId, content, fileUrl, fileType, isRoom, customFileName });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Not authenticated");

    const finalContent = content?.trim() || (fileType === 'image' ? 'Sent a photo' : (fileType === 'document' ? 'Sent a document' : 'Message'));
    
    let fileName: string | null = customFileName || null;
    if (!fileName && fileUrl) {
        try {
            const decoded = decodeURIComponent(fileUrl);
            const parts = decoded.split('/');
            fileName = parts[parts.length - 1]?.split('?')[0]?.replace(/^\d+[-_]/, '') || 'attachment';
        } catch {
            fileName = 'attachment';
        }
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = UUID_REGEX.test(targetId);
    const isGroup = targetId.startsWith('group_');

    const insertData: any = {
        sender_id: userData.user.id,
        content: finalContent,
        message_text: finalContent,
        file_url: fileUrl || null,
        file_name: fileName,
        file_type: fileType || null,
        status: "sent"
    };

    if (isGroup || isRoom) {
        if (isGroup || !isUuid) {
            insertData.conversation_id = targetId;
            insertData.receiver_id = null;
        } else {
            insertData.room_id = targetId;
            insertData.receiver_id = null;
        }
    } else {
        insertData.receiver_id = targetId;
        insertData.conversation_id = null;
    }

    const { data, error } = await supabase
        .from('messages')
        .insert(insertData)
        .select()
        .single();

    if (error) {
        console.error('Send error:', error);
        throw error;
    }

    // Also insert into message_attachments for cross-platform consistency
    if (data?.id && fileUrl) {
        try {
            await supabase.from('message_attachments').insert({
                message_id: data.id,
                file_url: fileUrl,
                file_name: fileName || 'attachment',
                file_type: fileType || 'application/octet-stream'
            });
        } catch (attErr) {
            console.warn('Failed to insert into message_attachments:', attErr);
        }
    }

    return normalizeMessage(data);
}
