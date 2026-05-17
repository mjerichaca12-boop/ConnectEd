import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const INVITATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? Deno.env.get("resend_api_key") ?? "";
const EMAIL_FROM = (
  Deno.env.get("EMAIL_FROM") ??
  Deno.env.get("email_from") ??
  "ConnectEd <onboarding@resend.dev>"
).trim();
const DEV_EMAIL_LOG = (Deno.env.get("DEV_EMAIL_LOG") || "").toLowerCase() === "true";
const PUBLIC_SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? Deno.env.get("public-site-url") ?? "";

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

const shouldFallbackToLegacyRequestSchema = (error: { message?: string; details?: string } | null | undefined) => {
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  return (
    message.includes("could not find the 'first_name' column") ||
    message.includes("could not find the 'middle_name' column") ||
    message.includes("could not find the 'last_name' column") ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    details.includes("first_name") ||
    details.includes("middle_name") ||
    details.includes("last_name") ||
    details.includes("schema cache")
  );
};

const isMissingColumnError = (
  error: { message?: string; details?: string } | null | undefined,
  columnName: string
) => {
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  const key = columnName.toLowerCase();
  return (
    message.includes("could not find") && message.includes(`'${key}'`) ||
    message.includes("column") && message.includes(key) && message.includes("does not exist") ||
    details.includes(key)
  );
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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    throw new Error("Invalid invitation email address.");
  }

  const trySend = async (from: string) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        ok: false,
        status: response.status,
        errorBody: errorBody || response.statusText
      };
    }

    return { ok: true, status: response.status, errorBody: "" };
  };

  const primary = await trySend(EMAIL_FROM);
  if (primary.ok) return;

  console.error("Resend email error (primary sender):", primary.status, primary.errorBody);

  const fallbackSender = "ConnectEd <onboarding@resend.dev>";
  if (EMAIL_FROM !== fallbackSender) {
    const fallback = await trySend(fallbackSender);
    if (fallback.ok) {
      console.warn("send-invitation: email sent using fallback sender onboarding@resend.dev");
      return;
    }

    console.error("Resend email error (fallback sender):", fallback.status, fallback.errorBody);
    throw new Error(`Email send failed: ${fallback.errorBody}`);
  }

  throw new Error(`Email send failed: ${primary.errorBody}`);
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
  hasEmailFrom: !!EMAIL_FROM,
  hasPublicSiteUrl: !!PUBLIC_SITE_URL
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

    let payload: { requestId?: string; email?: string; name?: string; adminId?: string } = {};
    try {
      payload = await req.json();
    } catch {
      return jsonResponse(400, { ok: false, message: "Invalid request payload." });
    }

    const requestId = String(payload.requestId || "").trim();
    const email = String(payload.email || "").trim().toLowerCase();
    const name = String(payload.name || "").trim();
    const adminId = String(payload.adminId || "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse(400, { error: "A valid email address is required." });
    }

    // Verify the access request exists and is approved.
    // Try multiple possible table names and both new/legacy schemas.
    const REQUEST_TABLES = ["teacher_access_request", "teacher_request_access", "teacher_access_requests"];
    const newSchemaSelect = "id, profile_id, email, first_name, middle_name, last_name, status";
    const legacySchemaSelect = "id, profile_id, email, name, phone_number, status";

    let accessRequest: Record<string, unknown> | null = null;
    let requestError: { message?: string; details?: string } | null = null;
    let tableUsed: string | null = null;

    for (const table of REQUEST_TABLES) {
      try {
        let lookup = supabase.from(table).select(newSchemaSelect).limit(1);
        if (requestId) lookup = lookup.eq("id", requestId);
        else lookup = lookup.ilike("email", email);

        const result = await lookup;
        if (!result.error) {
          accessRequest = Array.isArray(result.data) ? result.data[0] : result.data ?? null;
          requestError = null;
          tableUsed = table;
          break;
        }

        // If column missing, try legacy schema on same table
        if (shouldFallbackToLegacyRequestSchema(result.error)) {
          let legacyLookup = supabase.from(table).select(legacySchemaSelect).limit(1);
          if (requestId) legacyLookup = legacyLookup.eq("id", requestId);
          else legacyLookup = legacyLookup.ilike("email", email);

          const legacyResult = await legacyLookup;
          if (!legacyResult.error) {
            accessRequest = Array.isArray(legacyResult.data) ? legacyResult.data[0] : legacyResult.data ?? null;
            requestError = null;
            tableUsed = table;
            break;
          }
          requestError = legacyResult.error as { message?: string; details?: string } | null;
        } else {
          requestError = result.error as { message?: string; details?: string } | null;
        }
      } catch (e) {
        requestError = e as any;
      }
    }

    if (requestError || !accessRequest) {
      console.error("access-request lookup error:", requestError);
      const msg = requestError?.message || "Access request not found.";
      return jsonResponse(404, { error: msg });
    }

    if ((accessRequest as any)?.status !== "approved") {
      return jsonResponse(400, { error: "Access request has not been approved." });
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

    const tokenInsertPayload = {
      profile_id: accessRequest.profile_id || null,
      email,
      token_hash: tokenHash,
      token_plain: plainToken,
      expires_at: expiresAt,
      created_by: adminId || "system"
    };

    let { error: tokenInsertError } = await supabase
      .from("teacher_invitation_tokens")
      .insert(tokenInsertPayload);

    if (tokenInsertError && isMissingColumnError(tokenInsertError, "profile_id")) {
      console.warn("send-invitation: retrying token insert without profile_id for legacy schema");
      const retryWithoutProfileId = await supabase
        .from("teacher_invitation_tokens")
        .insert({
          email,
          token_hash: tokenHash,
          token_plain: plainToken,
          expires_at: expiresAt,
          created_by: adminId || "system"
        });
      tokenInsertError = retryWithoutProfileId.error;
    }

    if (tokenInsertError && isMissingColumnError(tokenInsertError, "created_by")) {
      console.warn("send-invitation: retrying token insert without created_by for legacy schema");
      const retryWithoutCreatedBy = await supabase
        .from("teacher_invitation_tokens")
        .insert({
          email,
          token_hash: tokenHash,
          token_plain: plainToken,
          expires_at: expiresAt
        });
      tokenInsertError = retryWithoutCreatedBy.error;
    }

    if (tokenInsertError) {
      console.error("Failed to generate invitation token:", tokenInsertError);
      return jsonResponse(500, { error: tokenInsertError.message || "Failed to generate invitation token." });
    }

    // Update access request status to invited
    // Try to update the status in whichever table we used, or in all tables as a fallback.
    const updateTables = tableUsed ? [tableUsed] : REQUEST_TABLES;
    for (const t of updateTables) {
      const { error: updateError } = await supabase.from(t).update({ status: "invited" }).ilike("email", email);
      if (updateError) {
        console.warn("send-invitation: failed to update status on table", t, updateError.message);
      } else {
        break;
      }
    }

    // Send invitation email
    const referer = req.headers.get("referer") || "";
    const originFromReferer = (() => {
      try {
        return referer ? new URL(referer).origin : "";
      } catch {
        return "";
      }
    })();

    const origin = req.headers.get("origin") || PUBLIC_SITE_URL || originFromReferer || "";
    if (!origin) {
      return jsonResponse(500, { error: "Missing PUBLIC_SITE_URL for invitation links." });
    }

    const displayName = name || formatTeacherName(accessRequest) || "Teacher";
    const invitationUrl = buildInvitationUrl(origin, plainToken);

    try {
      if (DEV_EMAIL_LOG) {
        console.log("DEV_EMAIL_LOG enabled - invitation URL:", invitationUrl);
      } else {
        console.log("Sending invitation email:", { email, subject: "Your ConnectEd Account Invitation" });
        await sendEmail(
          email,
          "Your ConnectEd Account Invitation",
          buildInvitationEmailHtml(displayName, invitationUrl)
        );
      }
    } catch (error) {
      console.error("Invitation email send failed:", error);
      const message = error instanceof Error ? error.message : "Failed to send invitation email.";
      return jsonResponse(500, { error: message });
    }

    return new Response(JSON.stringify({ ok: true, message: "Email sent" }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error in send-invitation.";
    console.error("send-invitation error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
});
