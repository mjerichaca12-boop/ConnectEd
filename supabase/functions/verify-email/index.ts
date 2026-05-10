import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const hashToken = async (token: string) => {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, message: "Method not allowed." });
  }

  let payload: { token?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, message: "Invalid request payload." });
  }

  const rawToken = String(payload.token || "").trim();
  if (!rawToken) {
    return jsonResponse(400, { ok: false, message: "Missing verification token." });
  }

  const tokenHash = await hashToken(rawToken);

  const { data: tokenRow, error: tokenError } = await supabase
    .from("email_verification_tokens")
    .select("id, profile_id, email, expires_at, consumed_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return jsonResponse(400, { ok: false, code: "invalid_or_expired", message: "Invalid or expired token." });
  }

  const isExpired = tokenRow.expires_at && new Date(tokenRow.expires_at) <= new Date();
  if (tokenRow.consumed_at || isExpired) {
    return jsonResponse(400, { ok: false, code: "invalid_or_expired", message: "Invalid or expired token." });
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ is_verified: true })
    .eq("id", tokenRow.profile_id);

  if (profileError) {
    return jsonResponse(500, { ok: false, message: profileError.message || "Failed to verify account." });
  }

  await supabase
    .from("email_verification_tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  return jsonResponse(200, {
    ok: true,
    message: "Your account has been verified. You can now log in.",
    email: tokenRow.email
  });
});
