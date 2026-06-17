import { supabase } from "../../lib/supabase";

export async function getMessages(id: string) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Not authenticated");

    // Try conversation first (unified web group chat)
    const { data: convData, error: convError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });

    if (!convError && convData && convData.length > 0) {
        return convData;
    }

    // Try room next (mobile group chat)
    const { data: roomData, error: roomError } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', id)
        .order('created_at', { ascending: true });

    if (!roomError && roomData && roomData.length > 0) {
        return roomData;
    }

    // fallback to one-to-one
    const { data: directData, error: directError } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${userData.user.id},receiver_id.eq.${userData.user.id}`)
        .or(`sender_id.eq.${id},receiver_id.eq.${id}`)
        .order('created_at', { ascending: true });

    if (directError) {
        console.error('[messages] Direct fetch error:', directError);
        return [];
    }
    return directData || [];
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
        if (targetId.startsWith('group_')) {
            insertData.conversation_id = targetId;
            insertData.receiver_id = null;
        } else {
            insertData.room_id = targetId;
            insertData.receiver_id = null;
        }
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
    return data;
}
