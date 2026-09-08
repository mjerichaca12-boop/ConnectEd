import AsyncStorage from '@react-native-async-storage/async-storage';

const CONVERSATION_READS_STORAGE_KEY = '@connected_conversation_reads';

export interface ConversationReadMap {
    [conversationOrPartnerId: string]: string; // ISO timestamp of last read time
}

/**
 * Retrieve local persisted map of last read timestamps by conversation or partner ID.
 */
export async function getLocalConversationReads(userId?: string): Promise<ConversationReadMap> {
    try {
        const key = userId ? `@connected_conversation_reads_${userId}` : CONVERSATION_READS_STORAGE_KEY;
        const json = await AsyncStorage.getItem(key);
        if (!json) {
            // Also check generic key for backward compatibility
            if (userId) {
                const generic = await AsyncStorage.getItem(CONVERSATION_READS_STORAGE_KEY);
                if (generic) {
                    const parsedGeneric = JSON.parse(generic);
                    return typeof parsedGeneric === 'object' && parsedGeneric !== null ? parsedGeneric : {};
                }
            }
            return {};
        }
        const parsed = JSON.parse(json);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
        return {};
    }
}

/**
 * Record that a conversation has been read at the specified timestamp (defaults to now).
 */
export async function recordConversationRead(conversationOrPartnerId: string, timestamp?: string, userId?: string): Promise<void> {
    try {
        if (!conversationOrPartnerId) return;
        const key = userId ? `@connected_conversation_reads_${userId}` : CONVERSATION_READS_STORAGE_KEY;
        const current = await getLocalConversationReads(userId);
        const readTime = timestamp || new Date().toISOString();
        current[conversationOrPartnerId] = readTime;
        await AsyncStorage.setItem(key, JSON.stringify(current));
        // Also mirror to generic key for backward compatibility
        if (userId) {
            await AsyncStorage.setItem(CONVERSATION_READS_STORAGE_KEY, JSON.stringify(current));
        }
    } catch (e) {
        console.warn('[MessageStorage] Failed to save conversation read timestamp:', e);
    }
}

/**
 * Clear all stored conversation read timestamps (e.g. on user logout).
 */
export async function clearLocalConversationReads(userId?: string): Promise<void> {
    try {
        await AsyncStorage.removeItem(CONVERSATION_READS_STORAGE_KEY);
        if (userId) {
            await AsyncStorage.removeItem(`@connected_conversation_reads_${userId}`);
        }
    } catch (e) {
        console.warn('[MessageStorage] Failed to clear conversation reads:', e);
    }
}
