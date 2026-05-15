import Groq from "groq-sdk";

const apiKey = process.env.VITE_GROQ_API_KEY;
console.log("API Key found:", apiKey ? "Yes (length: " + apiKey.length + ")" : "No");

if (!apiKey) {
  console.error("No API key found in env");
  process.exit(1);
}

const groq = new Groq({ apiKey });

async function main() {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: "Say hello" }],
      model: "llama-3.3-70b-versatile",
    });
    console.log("Success:", chatCompletion.choices[0].message.content);
  } catch (error) {
    console.error("Error details:", error);
  }
}

main();
