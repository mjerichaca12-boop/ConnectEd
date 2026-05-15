const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:3000";

export async function sendChatMessage(messages: { role: 'user' | 'assistant', content: string }[], role: string = 'student') {
    try {
        const response = await fetch(`${BACKEND_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messages, role }),
        });

        if (!response.ok) {
            throw new Error('Failed to send message');
        }

        const data = await response.json();
        return data.reply;
    } catch (error) {
        console.error('Chat API Error:', error);
        throw error;
    }
}
