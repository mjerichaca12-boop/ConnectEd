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

    const trimmedEmail = String(email).trim().toLowerCase();

    // 1. Look up user in profiles table first by email
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, email, role")
      .ilike("email", trimmedEmail)
      .maybeSingle();

    let targetUserId = profile?.id;
    let targetAuthEmail = profile?.email;

    // 2. If not found by email, search by username
    if (!profile) {
      const { data: profileByUsername } = await supabase
        .from("profiles")
        .select("id, username, email, role")
        .ilike("username", trimmedEmail)
        .maybeSingle();

      if (profileByUsername) {
        targetUserId = profileByUsername.id;
        targetAuthEmail = profileByUsername.email;
      }
    }

    // If no user found in database, return success for security (prevent email enumeration)
    if (!targetUserId) {
      return res.status(200).json({ success: true, message: "If an account exists, a reset email has been sent." });
    }

    // 3. Get the auth user from Supabase Auth admin API to ensure we have the exact auth email
    let authUser = null;
    const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(targetUserId);
    if (!getUserError && userData?.user) {
      authUser = userData.user;
    }

    const authEmailToUse = authUser?.email || targetAuthEmail || `${profile?.username}@temp.local`;

    // 4. Generate password recovery link via Supabase Admin API
    const finalRedirectUrl = redirectTo || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/reset-password` : "http://localhost:5173/reset-password");

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: authEmailToUse,
      options: {
        redirectTo: finalRedirectUrl
      }
    });

    if (linkError) {
      console.error("Failed to generate recovery link:", linkError);
      return res.status(500).json({ error: linkError.message || "Failed to generate password reset link" });
    }

    const actionLink = linkData?.properties?.action_link;

    // 5. Send Email via Resend if RESEND_API_KEY is available
    const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || process.env.VITE_EMAIL_FROM || "ConnectEd LMS <onboarding@resend.dev>";

    if (resendApiKey && actionLink) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [trimmedEmail],
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

      if (!resendRes.ok) {
        const resendErrText = await resendRes.text();
        console.error("Resend API error:", resendErrText);
      } else {
        const resendData = await resendRes.json();
        console.log("Password reset email sent via Resend:", resendData);
        return res.status(200).json({ success: true, message: "Password reset email sent via Resend." });
      }
    }

    // Fallback if RESEND_API_KEY is not set or failed:
    // Try Supabase auth recovery
    const { error: fallbackError } = await supabase.auth.admin.resetPasswordForEmail(authEmailToUse, {
      redirectTo: finalRedirectUrl
    });

    if (fallbackError) {
      console.error("Fallback resetPasswordForEmail error:", fallbackError);
    }

    return res.status(200).json({ success: true, message: "Reset request processed." });
  } catch (error) {
    console.error("send-password-reset handler error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
