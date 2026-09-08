import { describe, it, expect } from 'vitest';

// Function simulating the exact optimistic deduplication logic from ConversationScreen
export function getEffectiveSendingMessages(sendingMessages: any[], serverMessages: any[]) {
    return sendingMessages.filter(temp => {
        if (temp.status === 'error') return true;
        const alreadyInServerMessages = (serverMessages || []).some((m: any) => {
            if (m.id === temp.id) return true;
            const sameSender = m.sender_id === temp.sender_id;
            const sameContent = (m.content === temp.content || m.message_text === temp.content);
            const closeTime = Math.abs(new Date(m.created_at || 0).getTime() - new Date(temp.created_at || 0).getTime()) < 30000;
            return sameSender && sameContent && closeTime;
        });
        return !alreadyInServerMessages;
    });
}

// Function simulating the exact displayMessages ordering for inverted FlatList
export function getDisplayMessages(serverMessages: any[], effectiveSendingMessages: any[]) {
    return [...(serverMessages || []), ...effectiveSendingMessages].reverse();
}

describe('Optimistic Message Deduplication and Smooth Rendering', () => {
    const currentUserId = 'user-abc';
    const partnerId = 'user-xyz';
    const now = new Date('2026-09-07T10:00:00.000Z');

    const existingMessages = [
        {
            id: 'msg-1',
            sender_id: partnerId,
            content: 'Hello there!',
            created_at: new Date(now.getTime() - 60000).toISOString(),
            status: 'sent',
        },
        {
            id: 'msg-2',
            sender_id: currentUserId,
            content: 'Hi! How can I help?',
            created_at: new Date(now.getTime() - 30000).toISOString(),
            status: 'sent',
        },
    ];

    it('immediately shows optimistic message without vanishing when sending', () => {
        const tempMessage = {
            id: 'temp_12345',
            sender_id: currentUserId,
            content: 'I have a question about the assignment',
            created_at: now.toISOString(),
            status: 'sending',
        };

        const effective = getEffectiveSendingMessages([tempMessage], existingMessages);
        expect(effective.length).toBe(1);
        expect(effective[0].id).toBe('temp_12345');
        expect(effective[0].status).toBe('sending');

        const display = getDisplayMessages(existingMessages, effective);
        // Inverted list: newest message is at index 0 (bottom)
        expect(display.length).toBe(3);
        expect(display[0].id).toBe('temp_12345');
        expect(display[0].content).toBe('I have a question about the assignment');
    });

    it('suppresses duplicate when server confirms message (by ID or sender+content+time)', () => {
        const tempMessage = {
            id: 'temp_12345',
            sender_id: currentUserId,
            content: 'I have a question about the assignment',
            created_at: now.toISOString(),
            status: 'sending',
        };

        const confirmedServerMessages = [
            ...existingMessages,
            {
                id: 'real-server-id-999',
                sender_id: currentUserId,
                content: 'I have a question about the assignment',
                created_at: new Date(now.getTime() + 500).toISOString(), // 500ms later
                status: 'sent',
            },
        ];

        // While temp_12345 is still in sendingMessages, effectiveSendingMessages detects it in serverMessages
        const effective = getEffectiveSendingMessages([tempMessage], confirmedServerMessages);
        expect(effective.length).toBe(0);

        const display = getDisplayMessages(confirmedServerMessages, effective);
        expect(display.length).toBe(3);
        expect(display[0].id).toBe('real-server-id-999');
        expect(display[0].status).toBe('sent');
    });

    it('never has a zero-message vanishing gap between send and server response', () => {
        const tempMessage = {
            id: 'temp_12345',
            sender_id: currentUserId,
            content: 'Smooth message transition',
            created_at: now.toISOString(),
            status: 'sending',
        };

        // State 1: User sends message -> shown optimistically
        let serverMessages = [...existingMessages];
        let sendingList = [tempMessage];
        let display = getDisplayMessages(serverMessages, getEffectiveSendingMessages(sendingList, serverMessages));
        expect(display[0].id).toBe('temp_12345');

        // State 2: Server saves message and updates query cache -> message still present
        const savedMessage = {
            id: 'server-id-555',
            sender_id: currentUserId,
            content: 'Smooth message transition',
            created_at: now.toISOString(),
            status: 'sent',
        };
        serverMessages = [...serverMessages, savedMessage];

        // Even before sendingList is cleared, display contains it once
        display = getDisplayMessages(serverMessages, getEffectiveSendingMessages(sendingList, serverMessages));
        expect(display.filter(m => m.content === 'Smooth message transition').length).toBe(1);
        expect(display[0].id).toBe('server-id-555');

        // State 3: sendingList cleans up -> display still contains it once
        sendingList = [];
        display = getDisplayMessages(serverMessages, getEffectiveSendingMessages(sendingList, serverMessages));
        expect(display.filter(m => m.content === 'Smooth message transition').length).toBe(1);
        expect(display[0].id).toBe('server-id-555');
    });

    it('preserves failed message with status "error" for retry', () => {
        const failedMessage = {
            id: 'temp_failed_1',
            sender_id: currentUserId,
            content: 'Message that failed to reach network',
            created_at: now.toISOString(),
            status: 'error',
        };

        const effective = getEffectiveSendingMessages([failedMessage], existingMessages);
        expect(effective.length).toBe(1);
        expect(effective[0].status).toBe('error');

        const display = getDisplayMessages(existingMessages, effective);
        expect(display[0].id).toBe('temp_failed_1');
        expect(display[0].status).toBe('error');
    });

    it('supports multiple rapid-fire messages sent in parallel', () => {
        const msgA = {
            id: 'temp_a',
            sender_id: currentUserId,
            content: 'First quick message',
            created_at: new Date(now.getTime() + 100).toISOString(),
            status: 'sending',
        };
        const msgB = {
            id: 'temp_b',
            sender_id: currentUserId,
            content: 'Second quick message',
            created_at: new Date(now.getTime() + 300).toISOString(),
            status: 'sending',
        };

        const effective = getEffectiveSendingMessages([msgA, msgB], existingMessages);
        expect(effective.length).toBe(2);

        const display = getDisplayMessages(existingMessages, effective);
        expect(display.length).toBe(4);
        // Latest (msgB) is at index 0, followed by msgA at index 1
        expect(display[0].id).toBe('temp_b');
        expect(display[1].id).toBe('temp_a');
    });
});
