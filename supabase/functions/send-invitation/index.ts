import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const INVITATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = (Deno.env.get("EMAIL_FROM") ?? "ConnectEd <noreply@rohs.space>").trim();
const DEV_EMAIL_LOG = (Deno.env.get("DEV_EMAIL_LOG") || "").toLowerCase() === "true";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const jsonResponse = (status: number, body: Record<string, unknown>) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
};

const generateToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const hashToken = async (token: string) => {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const sendEmail = async (to: string, subject: string, html: string) => {
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

const buildInvitationUrl = (origin: string, token: string) => {
  const base = origin.replace(/\/$/, "");
  return `${base}/set-password?token=${token}`;
};

const formatTeacherName = (teacher: {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
}) => {
  return [teacher.first_name, teacher.middle_name, teacher.last_name].filter(Boolean).join(" ").trim();
};

const buildInvitationEmailHtml = (name: string, invitationUrl: string) => {
  const safeName = name ? name.split(" ")[0] : "Teacher";
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #10b981;">Welcome to ConnectEd, ${safeName}!</h2>
      <p>Your access request has been approved. Please set your password to activate your account.</p>
      <p style="margin: 24px 0;">
        <a href="${invitationUrl}" style="background: #10b981; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
          Set Your Password
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">If the button does not work, copy and paste this link into your browser:</p>
      <p style="color: #666; font-size: 14px; word-break: break-all;">${invitationUrl}</p>
      <p style="color: #999; font-size: 12px;">This link expires in 24 hours.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">ConnectEd • Official School Management System</p>
    </div>
  `;
};

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
}

// Diagnostic: log presence of important env vars (do not log secrets)
console.log("send-invitation env:", {
  hasSupabaseUrl: !!supabaseUrl,
  hasServiceRoleKey: !!serviceRoleKey,
  hasResendKey: !!RESEND_API_KEY,
  hasPublicSiteUrl: !!Deno.env.get("PUBLIC_SITE_URL")
});
serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { 
        status: 200,
        headers: corsHeaders 
      });
    }

    if (req.method !== "POST") {
      return jsonResponse(405, { ok: false, message: "Method not allowed." });
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, {
        ok: false,
        message: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
      });
    }

    let payload: { email?: string; name?: string; adminId?: string } = {};
    try {
      payload = await req.json();
    } catch {
      return jsonResponse(400, { ok: false, message: "Invalid request payload." });
    }

    const email = String(payload.email || "").trim().toLowerCase();
    const name = String(payload.name || "").trim();
    const adminId = String(payload.adminId || "").trim();

    if (!email) {
      return jsonResponse(400, { ok: false, message: "Email is required." });
    }

    // Verify the access request exists and is approved.
    // First try the new schema (first_name/middle_name/last_name). If the column
    // doesn't exist in the database, fall back to the legacy schema (name, phone_number).
    let { data: accessRequest, error: requestError } = await supabase
      .from("teacher_access_requests")
      .select("id, profile_id, first_name, middle_name, last_name, status")
      .ilike("email", email)
      .single();

    if (requestError && /does not exist/.test(String(requestError.message || requestError))) {
      // Fallback to legacy schema
      console.log("send-invitation: falling back to legacy teacher_access_requests schema");
      const legacy = await supabase
        .from("teacher_access_requests")
        .select("id, profile_id, name, phone_number, status")
        .ilike("email", email)
        .single();

      accessRequest = legacy.data;
      requestError = legacy.error;
    }

    if (requestError || !accessRequest) {
      console.error("access-request lookup error:", requestError);
      const msg = requestError?.message || "Access request not found.";
      return jsonResponse(404, { ok: false, message: msg });
    }

    if (accessRequest.status !== "approved") {
      return jsonResponse(400, { ok: false, message: "Access request has not been approved." });
    }

    // Check if token already exists and is still valid
    const { data: existingToken } = await supabase
      .from("teacher_invitation_tokens")
      .select("id, expires_at, used_at")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existingToken && !existingToken.used_at) {
      const expiresAt = new Date(existingToken.expires_at);
      if (expiresAt > new Date()) {
        return jsonResponse(200, {
          ok: true,
          message: "Invitation already sent. Please check your email."
        });
      }
    }

    // Generate new invitation token
    const plainToken = generateToken();
    const tokenHash = await hashToken(plainToken);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();

    const { error: tokenInsertError } = await supabase
      .from("teacher_invitation_tokens")
      .insert({
        profile_id: accessRequest.profile_id || null,
        email,
        token_hash: tokenHash,
        token_plain: plainToken,
        expires_at: expiresAt,
        created_by: adminId || "system"
      });

    if (tokenInsertError) {
      return jsonResponse(500, { ok: false, message: "Failed to generate invitation token." });
    }

    // Update access request status to invited
    const { error: updateError } = await supabase
      .from("teacher_access_requests")
      .update({ status: "invited" })
      .ilike("email", email);

    if (updateError) {
      console.error("Failed to update access request status:", updateError);
    }

    // Send invitation email
    const origin = req.headers.get("origin") || Deno.env.get("PUBLIC_SITE_URL") || "";
    if (!origin) {
      return jsonResponse(500, { ok: false, message: "Missing PUBLIC_SITE_URL for invitation links." });
    }

    const displayName = name || formatTeacherName(accessRequest) || "Teacher";
    const invitationUrl = buildInvitationUrl(origin, plainToken);

    try {
      if (DEV_EMAIL_LOG) {
        console.log("DEV_EMAIL_LOG enabled - invitation URL:", invitationUrl);
      } else {
        await sendEmail(
          email,
          "Your ConnectEd Account Invitation",
          buildInvitationEmailHtml(displayName, invitationUrl)
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send invitation email.";
      return jsonResponse(500, { ok: false, message });
    }

    return jsonResponse(200, {
      ok: true,
      message: "Invitation email sent successfully.",
      expiresAt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error in send-invitation.";
    console.error("send-invitation error:", error);
    return jsonResponse(500, { ok: false, message });
  }
});
