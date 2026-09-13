import { createClient } from "@supabase/supabase-js";
import { buildConnectEdEmailHtml } from "../admin/emailTemplates.js";

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
