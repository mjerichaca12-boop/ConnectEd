import { supabase } from "../../lib/supabase";

export async function getMyChats() {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Not authenticated");
    const currentUserId = userData.user.id;

    // Fetch all messages involving the current user (sent or received)
    const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

    if (error) {
        console.error('[getMyChats] error fetching messages:', error);
        return [];
    }

    if (!messages || messages.length === 0) {
        return [];
    }

    // Group messages by partner_id to find latest message and unread count
    const partnerMap = new Map<string, { latestMessage: any; unreadCount: number }>();

    messages.forEach(msg => {
        const partnerId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
        
        // Skip if partnerId is empty or is the current user themselves
        if (!partnerId || partnerId === currentUserId) return;

        const currentGroup = partnerMap.get(partnerId);
        
        // Update latest message
        let latest = currentGroup?.latestMessage;
        if (!latest || new Date(msg.created_at) > new Date(latest.created_at)) {
            latest = msg;
        }

        // Count unread messages sent by the partner to current user
        let unreadInc = 0;
        if (msg.receiver_id === currentUserId && !msg.is_read) {
            unreadInc = 1;
        }

        partnerMap.set(partnerId, {
            latestMessage: latest,
            unreadCount: (currentGroup?.unreadCount || 0) + unreadInc
        });
    });

    const partnerIds = Array.from(partnerMap.keys());
    if (partnerIds.length === 0) return [];

    // Fetch profiles of all partners in one query
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, middle_name, role, avatar_url')
        .in('id', partnerIds);

    if (profilesError) {
        console.error('[getMyChats] error fetching profiles:', profilesError);
        return [];
    }

    const profileMap = new Map<string, any>();
    profiles?.forEach(p => {
        const fullName = `${p.first_name || ''} ${p.middle_name || ''} ${p.last_name || ''}`.trim().replace(/\s+/g, ' ') || "Unknown User";
        profileMap.set(p.id, {
            ...p,
            full_name: fullName
        });
    });

    // Construct unified chat items
    const chats = partnerIds.map(partnerId => {
        const group = partnerMap.get(partnerId)!;
        const profile = profileMap.get(partnerId);
        
        return {
            partner_id: partnerId,
            partner_name: profile?.full_name || "Unknown User",
            partner_role: profile?.role || "student",
            avatar_url: profile?.avatar_url,
            content: group.latestMessage.content || group.latestMessage.message_text,
            message_text: group.latestMessage.content || group.latestMessage.message_text,
            created_at: group.latestMessage.created_at,
            unread_count: group.unreadCount,
            chat_type: 'direct'
        };
    });

    // Sort by created_at descending (latest message first)
    chats.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return chats;
}
