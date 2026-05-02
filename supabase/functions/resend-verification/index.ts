import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24;

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

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = (Deno.env.get("EMAIL_FROM") ?? "ConnectEd <noreply@rohs.space>").trim();
const DEV_EMAIL_LOG = (Deno.env.get("DEV_EMAIL_LOG") || "").toLowerCase() === "1" || (Deno.env.get("DEV_EMAIL_LOG") || "").toLowerCase() === "true";

const sendEmail = async ({ to, subject, html }: EmailPayload) => {
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

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const publicSiteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "";

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

const buildVerifyUrl = (origin: string, token: string) => {
  const base = origin.replace(/\/$/, "");
  return `${base}/verify-email?token=${token}`;
};

const buildEmailHtml = (name: string, verifyUrl: string) => {
  const safeName = name ? `${name}, ` : "";
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <p>Hi ${safeName}</p>
      <p>Thanks for signing up for ConnectEd. Please verify your email address to finish setting up your account.</p>
      <p><a href="${verifyUrl}" style="background: #10b981; color: #ffffff; padding: 10px 16px; border-radius: 6px; text-decoration: none;">Verify email</a></p>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p>${verifyUrl}</p>
      <p>This link expires in 24 hours.</p>
    </div>
  `;
};

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
}
serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
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

    let payload: { email?: string; name?: string } = {};
    try {
      payload = await req.json();
    } catch {
      return jsonResponse(400, { ok: false, message: "Invalid request payload." });
    }

    const email = String(payload.email || "").trim().toLowerCase();
    const name = String(payload.name || "").trim();

    if (!email) {
      return jsonResponse(400, { ok: false, message: "Email is required." });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, is_verified, provider, first_name, last_name")
      .ilike("email", email)
      .maybeSingle();

    if (profileError || !profile?.id) {
      return jsonResponse(404, { ok: false, message: "Account not found." });
    }

    if (profile.is_verified === true) {
      return jsonResponse(200, { ok: true, message: "Account is already verified." });
    }

    if (profile.provider && profile.provider !== "google") {
      return jsonResponse(400, { ok: false, message: "Email verification is only required for Google accounts." });
    }

    const fallbackName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
    const displayName = name || fallbackName;

    const token = generateToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    await supabase
      .from("email_verification_tokens")
      .delete()
      .eq("profile_id", profile.id)
      .is("consumed_at", null);

    const { error: insertError } = await supabase
      .from("email_verification_tokens")
      .insert({
        profile_id: profile.id,
        email: profile.email || email,
        token_hash: tokenHash,
        expires_at: expiresAt
      });

    if (insertError) {
      return jsonResponse(500, { ok: false, message: insertError.message || "Failed to generate token." });
    }

    const origin = publicSiteUrl || req.headers.get("origin") || "";
    if (!origin) {
      return jsonResponse(500, { ok: false, message: "Missing PUBLIC_SITE_URL for verification links." });
    }

    const verifyUrl = buildVerifyUrl(origin, token);

    try {
      if (DEV_EMAIL_LOG) {
        console.log("DEV_EMAIL_LOG enabled - verification URL:", verifyUrl);
      } else {
        await sendEmail({
          to: email,
          subject: "Verify your ConnectEd account",
          html: buildEmailHtml(displayName, verifyUrl)
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send verification email.";
      return jsonResponse(500, { ok: false, message });
    }

    return jsonResponse(200, {
      ok: true,
      message: "Verification email sent.",
      expires_at: expiresAt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected resend-verification failure.";
    console.error("resend-verification error:", error);
    return jsonResponse(500, { ok: false, message });
  }
});
