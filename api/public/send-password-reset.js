import { createClient } from "@supabase/supabase-js";

function buildConnectEdEmailHtml({
  badgeType = "success",
  title,
  subtitle,
  credentials = null,
  rejectionReason = null,
  loginUrl = "https://getconnectedlms.online/login",
  buttonText = "Log In to ConnectEd",
  showButton = true,
  securityNotice = null,
  footerText = "This is an automated notification from ConnectEd LMS."
}) {
  let badgeHtml = "";
  if (badgeType === "success") {
    badgeHtml = `
      <div style="background-color: #d1fae5; width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 20px auto; text-align: center; line-height: 56px;">
        <span style="color: #059669; font-size: 26px; font-weight: bold; line-height: 56px; display: inline-block;">✓</span>
      </div>
    `;
  } else if (badgeType === "rejection") {
    badgeHtml = `
      <div style="background-color: #fee2e2; width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 20px auto; text-align: center; line-height: 56px;">
        <span style="color: #dc2626; font-size: 22px; font-weight: bold; line-height: 56px; display: inline-block;">✕</span>
      </div>
    `;
  }

  let credentialsHtml = "";
  if (credentials) {
    credentialsHtml = `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #10b981; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: left;">
        <p style="margin: 0 0 12px 0; color: #0f172a; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Account Credentials</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155;">
          ${credentials.fullName ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b; width: 140px;">Full Name:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${credentials.fullName}</td>
          </tr>` : ""}
          ${credentials.username ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Username:</td>
            <td style="padding: 6px 0;">
              <code style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 15px; font-weight: 700; color: #0f172a; background-color: #e2e8f0; padding: 3px 8px; border-radius: 4px; display: inline-block;">${credentials.username}</code>
            </td>
          </tr>` : ""}
          ${credentials.tempPassword ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Temporary Password:</td>
            <td style="padding: 6px 0;">
              <code style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 15px; font-weight: 700; color: #059669; background-color: #d1fae5; padding: 3px 8px; border-radius: 4px; display: inline-block;">${credentials.tempPassword}</code>
            </td>
          </tr>` : ""}
          ${credentials.lrn ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">LRN:</td>
            <td style="padding: 6px 0; color: #334155;">${credentials.lrn}</td>
          </tr>` : ""}
          ${credentials.gradeSection ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Grade & Section:</td>
            <td style="padding: 6px 0; color: #334155;">${credentials.gradeSection}</td>
          </tr>` : ""}
        </table>
      </div>
    `;
  }

  let rejectionHtml = "";
  if (rejectionReason) {
    rejectionHtml = `
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 18px 20px; margin: 24px 0; text-align: left;">
        <p style="margin: 0 0 6px 0; color: #991b1b; font-size: 14px; font-weight: 700;">Reason for Rejection:</p>
        <p style="margin: 0; color: #7f1d1d; font-size: 14px; line-height: 1.5;">${rejectionReason}</p>
      </div>
    `;
  }

  let buttonHtml = "";
  if (showButton && loginUrl) {
    buttonHtml = `
      <div style="text-align: center; margin: 28px 0;">
        <a href="${loginUrl}" style="background-color: #16a34a; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 12px 32px; border-radius: 8px; display: inline-block; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
          ${buttonText}
        </a>
      </div>
    `;
  }

  let securityHtml = "";
  if (securityNotice) {
    securityHtml = `
      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 14px 18px; margin: 20px 0; text-align: left;">
        <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
          <strong>🔒 Security Reminder:</strong> ${securityNotice}
        </p>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="background-color: #f8fafc; width: 100%; padding: 40px 16px; box-sizing: border-box;">
    <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 40px 36px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: center;">
      ${badgeHtml}
      <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin-top: 0; margin-bottom: 12px; text-align: center; letter-spacing: -0.5px;">${title}</h2>
      ${subtitle ? `<p style="color: #475569; font-size: 15px; line-height: 1.6; margin-top: 0; margin-bottom: 24px; text-align: center;">${subtitle}</p>` : ''}
      
      ${credentialsHtml}
      ${rejectionHtml}
      ${buttonHtml}
      ${securityHtml}
      
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 32px 0 20px 0;" />
      <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; text-align: center; margin: 0;">
        ${footerText}
      </p>
    </div>
  </div>
</body>
</html>`;
}

const DEFAULT_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg";

const isServiceRoleToken = (token) => {
  if (!token || typeof token !== "string") return false;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return false;
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    return payload?.role === "service_role";
  } catch (_) {
    return false;
  }
};

// Helper to initialize Supabase client
const getSupabaseClients = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pyeckxqaowusxcmeuolk.supabase.co";
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!isServiceRoleToken(serviceRoleKey)) {
    serviceRoleKey = DEFAULT_SERVICE_ROLE_KEY;
  }

  if (!supabaseUrl) {
    throw new Error("Supabase URL is not configured.");
  }

  const adminClient = (supabaseUrl && serviceRoleKey)
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  const publicClient = (supabaseUrl && anonKey)
    ? createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : adminClient;

  if (!adminClient && !publicClient) {
    throw new Error("Supabase client credentials are not configured.");
  }

  return { adminClient, publicClient, supabaseUrl };
};

export default async function handler(req, res) {
  const timestamp = new Date().toISOString();

  // 1. Method check (Part 12)
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, redirectTo } = req.body || {};

    // 2. Validate email input (Part 8 & Part 9)
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    // 3. Initialize Supabase clients (Part 10 & 11)
    const { adminClient, publicClient } = getSupabaseClients();
    const dbClient = adminClient || publicClient;

    // Determine production redirect URL (Part 14)
    const requestHost = req.headers["x-forwarded-host"] || req.headers["host"] || "";
    const protocol = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
    const fallbackOrigin = requestHost ? `${protocol}://${requestHost}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

    let finalRedirectUrl = "";
    if (redirectTo && typeof redirectTo === "string" && (redirectTo.startsWith("http://") || redirectTo.startsWith("https://"))) {
      finalRedirectUrl = redirectTo;
    } else if (fallbackOrigin) {
      finalRedirectUrl = `${fallbackOrigin.replace(/\/$/, "")}/reset-password`;
    } else {
      finalRedirectUrl = "https://getconnectedlms.online/reset-password";
    }

    // 4. Look up user in profiles table first (Part 13 - Prevent Enumeration)
    let profile = null;
    if (dbClient) {
      const { data: profByEmail } = await dbClient
        .from("profiles")
        .select("id, username, email, role")
        .ilike("email", trimmedEmail)
        .maybeSingle();

      if (profByEmail) {
        profile = profByEmail;
      } else {
        const { data: profByUsername } = await dbClient
          .from("profiles")
          .select("id, username, email, role")
          .ilike("username", trimmedEmail)
          .maybeSingle();
        if (profByUsername) profile = profByUsername;
      }
    }

    // Security (Part 13): Return generic success if account not found
    const genericSuccessResponse = {
      success: true,
      message: "If an account exists for this email address, password reset instructions will be sent."
    };

    if (!profile || !profile.id) {
      console.log(`[${timestamp}] Password reset requested for non-existent profile (${trimmedEmail})`);
      return res.status(200).json(genericSuccessResponse);
    }

    let realEmail = profile.email || trimmedEmail;
    if (realEmail.endsWith("@temp.local") && emailRegex.test(trimmedEmail) && !trimmedEmail.endsWith("@temp.local")) {
      realEmail = trimmedEmail;
      if (dbClient) {
        await dbClient.from("profiles").update({ email: realEmail }).eq("id", profile.id);
      }
    }

    // Sync email in auth.users if admin client is available
    if (adminClient && profile.id) {
      try {
        const { data: userData } = await adminClient.auth.admin.getUserById(profile.id);
        const authUser = userData?.user;
        if (authUser && (authUser.email !== realEmail || authUser.email.endsWith("@temp.local"))) {
          console.log(`[${timestamp}] Syncing auth email for user ${profile.id} to ${realEmail}`);
          await adminClient.auth.admin.updateUserById(profile.id, {
            email: realEmail,
            email_confirm: true
          });
        }
      } catch (syncErr) {
        console.warn(`[${timestamp}] Auth email sync warning:`, syncErr?.message || syncErr);
      }
    }

    // 5. Attempt Resend API direct delivery if configured
    const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || process.env.VITE_EMAIL_FROM || "ConnectEd LMS <onboarding@resend.dev>";

    if (adminClient && resendApiKey) {
      try {
        const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
          type: "recovery",
          email: realEmail,
          options: { redirectTo: finalRedirectUrl }
        });

        if (!linkError && linkData?.properties?.action_link) {
          const actionLink = linkData.properties.action_link;
          const resetEmailHtml = buildConnectEdEmailHtml({
            badgeType: "info",
            title: "Reset Your Password",
            subtitle: "You requested a password reset for your <strong>ConnectEd LMS</strong> account. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.",
            showButton: true,
            buttonText: "Change Password",
            loginUrl: actionLink,
            footerText: "If you didn't request a password reset, you can safely ignore this email. Your password will not be changed."
          });

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
              html: resetEmailHtml
            })
          });

          if (resendRes.ok) {
            console.log(`[${timestamp}] Password reset email sent via Resend API to ${realEmail}`);
            return res.status(200).json(genericSuccessResponse);
          }
        }
      } catch (resendErr) {
        console.warn(`[${timestamp}] Resend API attempt error:`, resendErr?.message || resendErr);
      }
    }

    // 6. Standard Supabase Auth reset via client.auth.resetPasswordForEmail (Part 10 fix: NOT admin.resetPasswordForEmail!)
    const activeAuthClient = (adminClient || publicClient)?.auth;
    if (activeAuthClient && typeof activeAuthClient.resetPasswordForEmail === "function") {
      const { error: resetError } = await activeAuthClient.resetPasswordForEmail(realEmail, {
        redirectTo: finalRedirectUrl
      });

      if (resetError) {
        console.error(`[${timestamp}] resetPasswordForEmail error:`, resetError.message);
        // Do not fail with 500 if user reset fails; return generic success or safe response
        return res.status(200).json(genericSuccessResponse);
      }
    }

    console.log(`[${timestamp}] Password reset link successfully generated for ${realEmail}`);
    return res.status(200).json(genericSuccessResponse);

  } catch (error) {
    // Safe server-side error logging (Part 15)
    console.error(`[${timestamp}] send-password-reset unexpected error:`, error?.message || error);
    return res.status(500).json({ error: "Unable to process password reset request right now. Please try again later." });
  }
}
