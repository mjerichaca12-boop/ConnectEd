
async function test() {
    try {
        const res = await fetch('https://twelve-walls-sing.loca.lt/auth/send-otp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'true'
            },
            body: JSON.stringify({ email: 'test@example.com' })
        });
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Headers:', res.headers.raw());
        console.log('Body text:', text);
    } catch (err) {
        console.error('Error:', err);
    }
}
test();
