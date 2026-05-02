import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

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

const hashToken = async (token: string) => {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const splitFullName = (fullName: string, email: string) => {
  const normalized = String(fullName || "").trim().replace(/\s+/g, " ");
  const parts = normalized ? normalized.split(" ") : [];

  if (parts.length === 0) {
    return {
      firstName: String(email || "").split("@")[0] || "Teacher",
      middleName: null,
      lastName: null
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      middleName: null,
      lastName: null
    };
  }

  if (parts.length === 2) {
    return {
      firstName: parts[0],
      middleName: null,
      lastName: parts[1]
    };
  }

  const firstName = parts[0];
  const remaining = parts.slice(1);
  const lastNameParticles = new Set(["de", "del", "dela", "la", "van", "von", "da", "dos", "di", "san", "st"]);
  const secondToLast = remaining[remaining.length - 2]?.toLowerCase();
  const useCompoundLastName = remaining.length >= 2 && lastNameParticles.has(secondToLast);
  const lastNameParts = useCompoundLastName ? remaining.slice(-2) : remaining.slice(-1);
  const middleNameParts = remaining.slice(0, remaining.length - lastNameParts.length);

  return {
    firstName,
    middleName: middleNameParts.length > 0 ? middleNameParts.join(" ") : null,
    lastName: lastNameParts.length > 0 ? lastNameParts.join(" ") : null
  };
};

const formatTeacherName = (teacher: {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
}) => {
  return [teacher.first_name, teacher.middle_name, teacher.last_name].filter(Boolean).join(" ").trim();
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

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse(500, {
        ok: false,
        message: "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY environment variables."
      });
    }

    let payload: { token?: string; password?: string } = {};
    try {
      payload = await req.json();
    } catch {
      return jsonResponse(400, { ok: false, message: "Invalid request payload." });
    }

    const plainToken = String(payload.token || "").trim();
    const password = String(payload.password || "").trim();

    if (!plainToken || !password) {
      return jsonResponse(400, { ok: false, message: "Token and password are required." });
    }

    if (password.length < 8) {
      return jsonResponse(400, { ok: false, message: "Password must be at least 8 characters." });
    }

    // Hash and look up the token
    const tokenHash = await hashToken(plainToken);

    const { data: tokenRow, error: tokenError } = await supabase
      .from("teacher_invitation_tokens")
      .select("id, email, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .single();

    if (tokenError || !tokenRow) {
      return jsonResponse(400, { ok: false, message: "Invalid invitation token." });
    }

    if (tokenRow.used_at) {
      return jsonResponse(400, { ok: false, message: "This invitation has already been used." });
    }

    const expiresAt = new Date(tokenRow.expires_at);
    if (expiresAt < new Date()) {
      return jsonResponse(400, { ok: false, message: "This invitation has expired." });
    }

    const email = String(tokenRow.email || "").trim().toLowerCase();

    // Get the access request to extract the teacher's name
    const { data: accessRequest, error: requestError } = await supabase
      .from("teacher_access_requests")
      .select("id, profile_id, first_name, middle_name, last_name, phone, subjects")
      .ilike("email", email)
      .single();

    if (requestError || !accessRequest) {
      return jsonResponse(404, { ok: false, message: "Access request not found." });
    }

    // Create auth user with password
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError || !authUser.user) {
      const errorMsg = authError?.message || "Failed to create auth account.";
      return jsonResponse(500, { ok: false, message: errorMsg });
    }

    // Create or update teacher profile
    const displayName = formatTeacherName(accessRequest) || email.split("@")[0] || "Teacher";
    const { firstName, middleName, lastName } = splitFullName(displayName, email);
    const subjects = Array.isArray(accessRequest.subjects) ? accessRequest.subjects : [];
    const phone = String(accessRequest.phone || "").trim() || null;

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", authUser.user.id)
      .single();

    if (existingProfile) {
      // Update existing profile
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          email,
          role: "teacher",
          is_verified: true,
          status: "Active",
          phone,
          subjects,
          provider: "email"
        })
        .eq("id", authUser.user.id);

      if (profileUpdateError) {
        console.error("Failed to update profile:", profileUpdateError);
        return jsonResponse(500, { ok: false, message: "Failed to update teacher profile." });
      }
    } else {
      // Create new profile
      const { error: profileInsertError } = await supabase
        .from("profiles")
        .insert({
          id: authUser.user.id,
          email,
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          role: "teacher",
          is_verified: true,
          status: "Active",
          phone,
          subjects,
          provider: "email"
        });

      if (profileInsertError) {
        console.error("Failed to create profile:", profileInsertError);
        return jsonResponse(500, { ok: false, message: "Failed to create teacher profile." });
      }
    }

    // Mark token as used
    const { error: tokenUsedError } = await supabase
      .from("teacher_invitation_tokens")
      .update({
        used_at: new Date().toISOString(),
        profile_id: authUser.user.id
      })
      .eq("token_hash", tokenHash);

    if (tokenUsedError) {
      console.error("Failed to mark token as used:", tokenUsedError);
    }

    // Update access request status to approved
    const { error: requestUpdateError } = await supabase
      .from("teacher_access_requests")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        profile_id: authUser.user.id
      })
      .ilike("email", email);

    if (requestUpdateError) {
      console.error("Failed to update access request:", requestUpdateError);
    }

    return jsonResponse(200, {
      ok: true,
      message: "Account created successfully. You can now log in.",
      user: {
        id: authUser.user.id,
        email: authUser.user.email
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error in set-password.";
    console.error("set-password error:", error);
    return jsonResponse(500, { ok: false, message });
  }
});
