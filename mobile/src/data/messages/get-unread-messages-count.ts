import { getMyChats } from "./get-my-chats";

/**
 * Calculates the total number of unread messages across all active direct and group conversations.
 * Uses `getMyChats` as the single authoritative source of truth to ensure the TabBar badge
 * count is always 100% consistent with the conversation list and decreases immediately when seen.
 */
export async function getUnreadMessagesCount(): Promise<number> {
    try {
        const chats = await getMyChats();
        if (!Array.isArray(chats) || chats.length === 0) {
            return 0;
        }

        const totalUnread = chats.reduce((sum, chat) => {
            const count = typeof chat.unread_count === 'number' && chat.unread_count > 0
                ? chat.unread_count
                : (chat.unread ? 1 : 0);
            return sum + count;
        }, 0);

        return totalUnread;
    } catch (e) {
        console.warn('[UnreadCount] Unexpected error fetching unread message count:', e);
        return 0;
    }
}

