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

    if (!fileUrl && row?.content) {
        try {
            const parsedContent = JSON.parse(row.content);
            if (parsedContent && typeof parsedContent === "object") {
                fileUrl = String(parsedContent.file_url || "").trim();
                fileName = String(parsedContent.file_name || "").trim();
                fileType = String(parsedContent.file_type || "").trim();
                fileSize = Number(parsedContent.file_size || 0);
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
        attachmentKind,
    };
};

export async function getMessages(id: string) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Not authenticated");

    // Try room first
    const { data: roomData, error: roomError } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', id)
        .order('created_at', { ascending: true });

    if (!roomError && roomData && roomData.length > 0) {
        return roomData.map(normalizeMessage);
    }

    // fallback to one-to-one
    // We remove the strict 'room_id is null' filter to allow visibility even if column is missing or schema is in transition
    const { data: directData, error: directError } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${userData.user.id},receiver_id.eq.${userData.user.id}`)
        .or(`sender_id.eq.${id},receiver_id.eq.${id}`)
        .order('created_at', { ascending: true });

    if (directError) {
        console.error('[messages] Direct fetch error:', directError);
        // If it fails because of missing room_id in previous tries, we at least return what we got
        return [];
    }
    return (directData || []).map(normalizeMessage);
}

export async function sendMessage(targetId: string, content: string, fileUrl?: string, fileType?: string, isRoom: boolean = false) {
    console.log('Sending message:', { targetId, content, fileUrl, fileType, isRoom });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Not authenticated");

    const finalContent = content?.trim() || (fileType === 'image' ? 'Sent a photo' : (fileType === 'document' ? 'Sent a document' : 'Message'));

    const insertData: any = {
        sender_id: userData.user.id,
        content: finalContent,
        message_text: finalContent,
        file_url: fileUrl || null,
        file_type: fileType || null
    };

    if (isRoom) {
        insertData.room_id = targetId;
    } else {
        insertData.receiver_id = targetId;
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
    return normalizeMessage(data);
}
