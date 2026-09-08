import { supabase } from "../../lib/supabase";
import { getLocalConversationReads } from "./message-storage";

export async function getUnreadMessagesCount(): Promise<number> {
    try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) return 0;
        const currentUserId = userData.user.id;

        // Load read tracking timestamps from local storage and remote DB
        const readMap = new Map<string, number>();
        try {
            const localReads = await getLocalConversationReads(currentUserId);
            Object.entries(localReads).forEach(([k, iso]) => {
                const t = new Date(iso).getTime();
                if (!isNaN(t)) readMap.set(k, t);
            });
        } catch {}

        try {
            const { data: remoteReads } = await supabase
                .from('conversation_reads')
                .select('counterpart_id, conversation_id, last_read_at')
                .eq('user_id', currentUserId);

            (remoteReads || []).forEach(r => {
                const t = new Date(r.last_read_at).getTime();
                if (!isNaN(t)) {
                    if (r.counterpart_id) {
                        const prev = readMap.get(r.counterpart_id) || 0;
                        if (t > prev) readMap.set(r.counterpart_id, t);
                    }
                    if (r.conversation_id) {
                        const prev = readMap.get(r.conversation_id) || 0;
                        if (t > prev) readMap.set(r.conversation_id, t);
                    }
                }
            });
        } catch {}

        // If there are recorded reads, query unread rows and filter out messages sent before last_read_at
        if (readMap.size > 0) {
            // 1. Direct unread messages
            let directRes = await supabase
                .from('messages')
                .select('id, sender_id, created_at, is_read')
                .eq('receiver_id', currentUserId)
                .or('is_read.eq.false,is_read.is.null');

            if (directRes.error) {
                directRes = await supabase
                    .from('messages')
                    .select('id, sender_id, created_at, is_read')
                    .eq('receiver_id', currentUserId)
                    .eq('is_read', false);
            }

            const unreadDirect = (directRes.data || []).filter(msg => {
                const lastRead = readMap.get(msg.sender_id) || 0;
                const msgTime = new Date(msg.created_at).getTime();
                return !(lastRead > 0 && msgTime <= lastRead);
            }).length;

            // 2. Group unread messages
            let unreadGroup = 0;
            const { data: participantRows } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('profile_id', currentUserId);

            const groupIds = (participantRows || []).map(r => r.conversation_id).filter(Boolean);
            if (groupIds.length > 0) {
                let groupRes = await supabase
                    .from('messages')
                    .select('id, conversation_id, sender_id, created_at, is_read')
                    .in('conversation_id', groupIds)
                    .neq('sender_id', currentUserId)
                    .or('is_read.eq.false,is_read.is.null');

                if (groupRes.error) {
                    groupRes = await supabase
                        .from('messages')
                        .select('id, conversation_id, sender_id, created_at, is_read')
                        .in('conversation_id', groupIds)
                        .neq('sender_id', currentUserId)
                        .eq('is_read', false);
                }

                unreadGroup = (groupRes.data || []).filter(msg => {
                    const lastRead = readMap.get(msg.conversation_id) || 0;
                    const msgTime = new Date(msg.created_at).getTime();
                    return !(lastRead > 0 && msgTime <= lastRead);
                }).length;
            }

            return unreadDirect + unreadGroup;
        }

        // Fast path when no local reads recorded: query count exact head
        let { count: directCount, error: directErr } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', currentUserId)
            .or('is_read.eq.false,is_read.is.null');

        if (directErr) {
            // Fallback to eq('is_read', false) if or filter syntax differs
            const fallback = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('receiver_id', currentUserId)
                .eq('is_read', false);
            directCount = fallback.count;
            if (fallback.error) {
                console.warn('[UnreadCount] Direct count error (non-fatal):', fallback.error.message);
            }
        }

        // 2. Group unread messages
        let groupCount = 0;
        try {
            const { data: participantRows } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('profile_id', currentUserId);

            const groupIds = (participantRows || []).map(r => r.conversation_id).filter(Boolean);
            if (groupIds.length > 0) {
                let { count: gc, error: gcErr } = await supabase
                    .from('messages')
                    .select('*', { count: 'exact', head: true })
                    .in('conversation_id', groupIds)
                    .neq('sender_id', currentUserId)
                    .or('is_read.eq.false,is_read.is.null');

                if (gcErr) {
                    const fallback = await supabase
                        .from('messages')
                        .select('*', { count: 'exact', head: true })
                        .in('conversation_id', groupIds)
                        .neq('sender_id', currentUserId)
                        .eq('is_read', false);
                    gc = fallback.count;
                }

                if (typeof gc === 'number') {
                    groupCount = gc;
                }
            }
        } catch (e) {
            console.warn('[UnreadCount] Group count error (non-fatal):', e);
        }

        return (directCount || 0) + groupCount;
    } catch (e) {
        console.warn('[UnreadCount] Unexpected error fetching unread message count:', e);
        return 0;
    }
}
