import { createClient } from "@supabase/supabase-js";

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin credentials are not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { email, redirectTo } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const trimmedInput = String(email).trim().toLowerCase();

    // 1. Look up user in profiles table first by email or username
    let { data: profile } = await supabase
      .from("profiles")
      .select("id, username, email, role")
      .ilike("email", trimmedInput)
      .maybeSingle();

    if (!profile) {
      const { data: profileByUsername } = await supabase
        .from("profiles")
        .select("id, username, email, role")
        .ilike("username", trimmedInput)
        .maybeSingle();

      if (profileByUsername) {
        profile = profileByUsername;
      }
    }

    // Security: if user is not found in database, return success message without leaking
    if (!profile || !profile.id) {
      return res.status(200).json({ success: true, message: "If an account exists, a reset email has been sent." });
    }

    // Determine the user's real email destination (must NOT be @temp.local)
    let realEmail = profile.email;
    if (!realEmail || realEmail.endsWith("@temp.local")) {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedInput) && !trimmedInput.endsWith("@temp.local")) {
        realEmail = trimmedInput;
        // Update profile email to realEmail
        await supabase.from("profiles").update({ email: realEmail }).eq("id", profile.id);
      } else {
        return res.status(400).json({ error: "Please enter a valid real email address." });
      }
    }

    // 2. Ensure auth.users has their REAL email (sync from profile if it was @temp.local)
    const { data: userData } = await supabase.auth.admin.getUserById(profile.id);
    const authUser = userData?.user;

    if (authUser && (authUser.email !== realEmail || authUser.email.endsWith("@temp.local"))) {
      console.log(`Syncing auth email for user ${profile.id} from ${authUser.email} to ${realEmail}`);
      const { error: syncError } = await supabase.auth.admin.updateUserById(profile.id, {
        email: realEmail,
        email_confirm: true
      });
      if (syncError) {
        console.error("Failed to sync auth email:", syncError);
      }
    }

    // 3. Generate password recovery link & send email
    const finalRedirectUrl = redirectTo || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/reset-password` : "http://localhost:5173/reset-password");

    // Try sending via Resend REST API directly if key is available
    const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || process.env.VITE_EMAIL_FROM || "ConnectEd LMS <onboarding@resend.dev>";

    if (resendApiKey) {
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email: realEmail,
        options: { redirectTo: finalRedirectUrl }
      });

      if (!linkError && linkData?.properties?.action_link) {
        const actionLink = linkData.properties.action_link;
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: emailFrom,
            to: [realEmail],
            subject: "Reset Your ConnectEd LMS Password",
            html: `
              <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; text-align: center;">
                <h2 style="color: #111827; margin-bottom: 16px; font-size: 24px; font-weight: 700;">Reset Your Password</h2>
                <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin-bottom: 32px;">
                  We received a request to reset your password for your <strong>ConnectEd LMS</strong> account. Click the button below to set a new password. This link will expire in 1 hour.
                </p>
                <a href="${actionLink}" style="display: inline-block; background-color: #10b981; color: #ffffff; font-weight: 600; font-size: 16px; text-decoration: none; padding: 14px 32px; border-radius: 8px; margin-bottom: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  Change Password
                </a>
                <p style="color: #6b7280; font-size: 13px; line-height: 1.4; margin-top: 24px;">
                  If the button above doesn't work, copy and paste this link into your browser:<br/>
                  <a href="${actionLink}" style="color: #10b981; word-break: break-all;">${actionLink}</a>
                </p>
                <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 32px 0 20px 0;" />
                <p style="color: #9ca3af; font-size: 13px; margin: 0;">
                  If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                </p>
              </div>
            `
          })
        });

        if (resendRes.ok) {
          console.log(`Password reset email sent via Resend API to ${realEmail}`);
          return res.status(200).json({ success: true, message: "Password reset email sent via Resend API." });
        } else {
          console.error("Resend API error:", await resendRes.text());
        }
      }
    }

    // 4. Fallback / Standard Supabase Auth Password Reset
    // Since we synced auth user email to realEmail above, this WILL send to realEmail (e.g. lych0721@gmail.com)
    const { error: resetError } = await supabase.auth.admin.resetPasswordForEmail(realEmail, {
      redirectTo: finalRedirectUrl
    });

    if (resetError) {
      console.error("resetPasswordForEmail error:", resetError);
      return res.status(500).json({ error: resetError.message });
    }

    console.log(`Password reset triggered via Supabase Auth for ${realEmail}`);
    return res.status(200).json({ success: true, message: "Password reset email sent." });

  } catch (error) {
    console.error("send-password-reset handler error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
