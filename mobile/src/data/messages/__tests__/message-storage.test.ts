import { describe, it, expect, vi, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    getLocalConversationReads,
    recordConversationRead,
    clearLocalConversationReads,
} from '../message-storage';

vi.mock('@react-native-async-storage/async-storage', () => {
    let store: Record<string, string> = {};
    return {
        default: {
            getItem: vi.fn(async (key: string) => store[key] || null),
            setItem: vi.fn(async (key: string, value: string) => {
                store[key] = value;
            }),
            removeItem: vi.fn(async (key: string) => {
                delete store[key];
            }),
            clear: vi.fn(async () => {
                store = {};
            }),
        }
    };
});

describe('message-storage', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
        vi.clearAllMocks();
    });

    it('returns empty object when no conversation reads have been stored', async () => {
        const reads = await getLocalConversationReads();
        expect(reads).toEqual({});
    });

    it('records and retrieves conversation read timestamp', async () => {
        const testPartnerId = 'partner-user-123';
        const testTimestamp = '2026-09-08T10:00:00.000Z';

        await recordConversationRead(testPartnerId, testTimestamp);
        const reads = await getLocalConversationReads();

        expect(reads[testPartnerId]).toBe(testTimestamp);
    });

    it('preserves other conversation reads when recording a new one', async () => {
        const partnerA = 'partner-a';
        const partnerB = 'partner-b';
        const timeA = '2026-09-08T09:00:00.000Z';
        const timeB = '2026-09-08T10:30:00.000Z';

        await recordConversationRead(partnerA, timeA);
        await recordConversationRead(partnerB, timeB);

        const reads = await getLocalConversationReads();
        expect(reads[partnerA]).toBe(timeA);
        expect(reads[partnerB]).toBe(timeB);
    });

    it('supports user-scoped storage', async () => {
        const userId1 = 'user-uuid-1';
        const partner = 'partner-1';

        await recordConversationRead(partner, '2026-09-08T08:00:00.000Z', userId1);
        const readsUser1 = await getLocalConversationReads(userId1);
        expect(readsUser1[partner]).toBe('2026-09-08T08:00:00.000Z');

        await clearLocalConversationReads(userId1);
        const clearedUser1 = await getLocalConversationReads(userId1);
        expect(clearedUser1).toEqual({});
    });

    it('clears all local conversation reads', async () => {
        await recordConversationRead('partner-1', '2026-09-08T08:00:00.000Z');
        await clearLocalConversationReads();

        const reads = await getLocalConversationReads();
        expect(reads).toEqual({});
    });
});
