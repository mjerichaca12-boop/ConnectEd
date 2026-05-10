type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

export const sendEmail = async ({ to, subject, html }: EmailPayload) => {
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    throw new Error("Missing RESEND_API_KEY or EMAIL_FROM environment variables.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject,
      html
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Email send failed: ${errorBody || response.statusText}`);
  }
};
