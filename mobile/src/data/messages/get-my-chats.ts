import { supabase } from "../../lib/supabase";

export async function getMyChats() {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Not authenticated");
    const currentUserId = userData.user.id;

    // 1. Fetch all conversation_ids for group chats the user is participating in
    const { data: participantRows, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('profile_id', currentUserId);

    if (participantError) {
        console.error('[getMyChats] error fetching conversation participants:', participantError);
    }

    const groupConversationIds = (participantRows || []).map(r => r.conversation_id);

    // 2. Fetch all messages involving the current user (direct messages) or in group chats they belong to
    let queryFilter = `sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`;
    if (groupConversationIds.length > 0) {
        queryFilter += `,conversation_id.in.(${groupConversationIds.join(',')})`;
    }

    const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .or(queryFilter);

    if (error) {
        console.error('[getMyChats] error fetching messages:', error);
        return [];
    }

    // Group messages by partner_id (direct) or conversation_id (group)
    const partnerMap = new Map<string, { latestMessage: any; unreadCount: number }>();
    const groupMap = new Map<string, { latestMessage: any; unreadCount: number }>();

    (messages || []).forEach(msg => {
        if (msg.conversation_id) {
            // Group message
            const currentGroup = groupMap.get(msg.conversation_id);
            let latest = currentGroup?.latestMessage;
            if (!latest || new Date(msg.created_at) > new Date(latest.created_at)) {
                latest = msg;
            }

            let unreadInc = 0;
            if (msg.sender_id !== currentUserId && !msg.is_read) {
                unreadInc = 1;
            }

            groupMap.set(msg.conversation_id, {
                latestMessage: latest,
                unreadCount: (currentGroup?.unreadCount || 0) + unreadInc
            });
        } else {
            // Direct message
            const partnerId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
            if (!partnerId || partnerId === currentUserId) return;

            const currentGroup = partnerMap.get(partnerId);
            let latest = currentGroup?.latestMessage;
            if (!latest || new Date(msg.created_at) > new Date(latest.created_at)) {
                latest = msg;
            }

            let unreadInc = 0;
            if (msg.receiver_id === currentUserId && !msg.is_read) {
                unreadInc = 1;
            }

            partnerMap.set(partnerId, {
                latestMessage: latest,
                unreadCount: (currentGroup?.unreadCount || 0) + unreadInc
            });
        }
    });

    // Ensure all group chats user is in are represented even if they have no messages
    groupConversationIds.forEach(groupId => {
        if (!groupMap.has(groupId)) {
            groupMap.set(groupId, {
                latestMessage: {
                    content: "Group created",
                    created_at: new Date().toISOString()
                },
                unreadCount: 0
            });
        }
    });

    // 3. Load direct chat profiles
    const partnerIds = Array.from(partnerMap.keys());
    let chats: any[] = [];
    if (partnerIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, middle_name, role, avatar_url')
            .in('id', partnerIds);

        if (profilesError) {
            console.error('[getMyChats] error fetching profiles:', profilesError);
        } else if (profiles) {
            const profileMap = new Map<string, any>();
            profiles.forEach(p => {
                const fullName = `${p.first_name || ''} ${p.middle_name || ''} ${p.last_name || ''}`.trim().replace(/\s+/g, ' ') || "Unknown User";
                profileMap.set(p.id, {
                    ...p,
                    full_name: fullName
                });
            });

            chats = partnerIds.map(partnerId => {
                const group = partnerMap.get(partnerId)!;
                const profile = profileMap.get(partnerId);
                
                return {
                    id: partnerId,
                    partner_id: partnerId,
                    name: profile?.full_name || "Unknown User",
                    partner_name: profile?.full_name || "Unknown User",
                    role: profile?.role || "student",
                    partner_role: profile?.role || "student",
                    avatar_url: profile?.avatar_url,
                    message: group.latestMessage.content || group.latestMessage.message_text || "",
                    content: group.latestMessage.content || group.latestMessage.message_text || "",
                    time: group.latestMessage.created_at,
                    created_at: group.latestMessage.created_at,
                    unread: group.unreadCount > 0,
                    unread_count: group.unreadCount,
                    chat_type: 'direct'
                };
            });
        }
    }

    // 4. Load group chat names from groupchats table
    const groupIds = Array.from(groupMap.keys());
    let groupChats: any[] = [];
    if (groupIds.length > 0) {
        const { data: groups, error: groupsError } = await supabase
            .from('groupchats')
            .select('id, name')
            .in('id', groupIds);

        if (groupsError) {
            console.error('[getMyChats] error fetching groupchats:', groupsError);
        } else if (groups) {
            const groupMetadataMap = new Map<string, any>();
            groups.forEach(g => {
                groupMetadataMap.set(g.id, g);
            });

            groupChats = groupIds.map(groupId => {
                const group = groupMap.get(groupId)!;
                const meta = groupMetadataMap.get(groupId);
                
                return {
                    id: groupId,
                    partner_id: groupId,
                    name: meta?.name || "Group Chat",
                    partner_name: meta?.name || "Group Chat",
                    role: "group",
                    partner_role: "group",
                    avatar_url: null,
                    message: group.latestMessage.content || group.latestMessage.message_text || "",
                    content: group.latestMessage.content || group.latestMessage.message_text || "",
                    time: group.latestMessage.created_at,
                    created_at: group.latestMessage.created_at,
                    unread: group.unreadCount > 0,
                    unread_count: group.unreadCount,
                    chat_type: 'group'
                };
            });
        }
    }

    // 5. Combine and sort
    const allChats = [...chats, ...groupChats];
    allChats.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return allChats;
}
