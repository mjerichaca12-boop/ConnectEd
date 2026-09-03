const Groq = require("groq-sdk");
require("dotenv").config();

async function testGroq() {
    const apiKey = process.env.GROQ_API_KEY;
    console.log('Testing Groq with key starting with:', apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING');
    
    if (!apiKey || apiKey === 'gsk_replace_me_with_actual_key') {
        console.error('ERROR: Groq API Key is missing or default!');
        return;
    }

    const groq = new Groq({ apiKey });

    try {
        console.log('Sending test message to Groq...');
        const response = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "Say hello!" }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 100,
        });

        console.log('SUCCESS! Groq replied:', response.choices[0]?.message?.content);
    } catch (error) {
        console.error('FAILED! Groq API Error:', error.message);
        if (error.message.includes('401')) {
            console.error('-> Hint: Your API key is invalid or unauthorized.');
        } else if (error.message.includes('429')) {
            console.error('-> Hint: You have exceeded your Groq rate limits.');
        }
    }
}

testGroq();
