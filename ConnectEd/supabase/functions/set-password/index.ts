import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const config = {
  verify_jwt: false
};

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

const resolveAuthUserByEmail = async (email: string) => {
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      return { user: null, error };
    }

    const users = data?.users || [];
    const matchedUser = users.find((user) => String(user?.email || "").toLowerCase() === email);
    if (matchedUser) {
      return { user: matchedUser, error: null };
    }

    if (users.length < perPage) break;
    page += 1;
  }

  return { user: null, error: null };
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

const shouldFallbackToLegacyRequestSchema = (error: { message?: string; details?: string } | null | undefined) => {
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  return (
    message.includes("could not find") ||
    message.includes("does not exist") ||
    details.includes("first_name") ||
    details.includes("middle_name") ||
    details.includes("last_name") ||
    details.includes("phone") ||
    details.includes("subjects")
  );
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

    // Get the access request to extract teacher profile metadata.
    // Support both new and legacy schema, and continue if record is missing.
    let accessRequest: Record<string, unknown> | null = null;
    let requestError: { message?: string; details?: string } | null = null;

    const newSchemaLookup = await supabase
      .from("teacher_access_requests")
      .select("id, profile_id, first_name, middle_name, last_name, phone, subjects")
      .ilike("email", email)
      .maybeSingle();

    accessRequest = (newSchemaLookup.data as Record<string, unknown> | null) ?? null;
    requestError = newSchemaLookup.error as { message?: string; details?: string } | null;

    if (requestError && shouldFallbackToLegacyRequestSchema(requestError)) {
      console.log("set-password: falling back to legacy teacher_access_requests schema");
      const legacyLookup = await supabase
        .from("teacher_access_requests")
        .select("id, profile_id, name, phone_number, subject_area")
        .ilike("email", email)
        .maybeSingle();

      accessRequest = (legacyLookup.data as Record<string, unknown> | null) ?? null;
      requestError = legacyLookup.error as { message?: string; details?: string } | null;
    }

    if (requestError) {
      console.error("set-password: access request lookup failed:", requestError);
    }

    // Create auth user with password. If already exists, resolve and continue.
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    let resolvedAuthUserId = String(authUser?.user?.id || "").trim();
    let resolvedAuthUserEmail = String(authUser?.user?.email || email).trim().toLowerCase();

    if (authError || !resolvedAuthUserId) {
      const authErrorMessage = String(authError?.message || "").toLowerCase();
      const alreadyRegistered =
        authErrorMessage.includes("already been registered") ||
        authErrorMessage.includes("already exists") ||
        authErrorMessage.includes("already registered");

      if (!alreadyRegistered) {
        const errorMsg = authError?.message || "Failed to create auth account.";
        return jsonResponse(500, { ok: false, message: errorMsg });
      }

      const { user: existingAuthUser, error: existingAuthUserError } = await resolveAuthUserByEmail(email);
      if (existingAuthUserError || !existingAuthUser?.id) {
        const errorMsg = existingAuthUserError?.message || "An account with this email already exists. Please log in instead.";
        return jsonResponse(409, { ok: false, message: errorMsg });
      }

      resolvedAuthUserId = String(existingAuthUser.id);
      resolvedAuthUserEmail = String(existingAuthUser.email || email).trim().toLowerCase();
      console.warn("set-password: auth user already existed; continuing setup with existing account", {
        email: resolvedAuthUserEmail,
        userId: resolvedAuthUserId
      });
    }

    // Create or update teacher profile
    const displayName = (() => {
      const formatted = formatTeacherName(accessRequest || {});
      if (formatted) return formatted;
      const legacyName = String(accessRequest?.name || "").trim();
      if (legacyName) return legacyName;
      return email.split("@")[0] || "Teacher";
    })();
    const { firstName, middleName, lastName } = splitFullName(displayName, email);
    const subjects = (() => {
      if (Array.isArray(accessRequest?.subjects)) return accessRequest.subjects;
      const legacySubjectArea = String(accessRequest?.subject_area || "").trim();
      if (!legacySubjectArea) return [];
      return legacySubjectArea
        .split(",")
        .map((subject) => subject.trim())
        .filter(Boolean);
    })();
    const phone = String(accessRequest?.phone || accessRequest?.phone_number || "").trim() || null;

    // Check for existing profile by ID (Auth ID) or by Email
    const { data: profileByAuthId } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", resolvedAuthUserId)
      .maybeSingle();

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", resolvedAuthUserEmail)
      .maybeSingle();

    if (profileByAuthId) {
      // Update the profile that already matches the Auth ID
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          email: resolvedAuthUserEmail,
          role: "teacher",
          is_verified: true,
          status: "Active",
          phone,
          subjects,
          provider: "email"
        })
        .eq("id", resolvedAuthUserId);

      if (profileUpdateError) {
        console.error("Failed to update profile by ID:", profileUpdateError);
        return jsonResponse(500, { ok: false, message: "Failed to update teacher profile." });
      }
    } else if (profileByEmail) {
      // "Merge" logic: If a profile exists with this email but a different ID,
      // update its ID to match the Auth ID and set it as verified.
      const { error: profileIdUpdateError } = await supabase
        .from("profiles")
        .update({
          id: resolvedAuthUserId,
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          role: "teacher",
          is_verified: true,
          status: "Active",
          phone,
          subjects,
          provider: "email"
        })
        .eq("id", profileByEmail.id);

      if (profileIdUpdateError) {
        console.error("Failed to migrate profile ID by email:", profileIdUpdateError);
        // Fallback: If ID update fails (e.g. constraints), try deleting and re-inserting
        await supabase.from("profiles").delete().eq("id", profileByEmail.id);
        
        const { error: profileInsertError } = await supabase
          .from("profiles")
          .insert({
            id: resolvedAuthUserId,
            email: resolvedAuthUserEmail,
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
          console.error("Failed to create new profile after fallback:", profileInsertError);
          return jsonResponse(500, { ok: false, message: "Failed to create teacher profile." });
        }
      }
    } else {
      // Create a brand new profile
      const { error: profileInsertError } = await supabase
        .from("profiles")
        .insert({
          id: resolvedAuthUserId,
          email: resolvedAuthUserEmail,
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
        console.error("Failed to create brand new profile:", profileInsertError);
        return jsonResponse(500, { ok: false, message: "Failed to create teacher profile." });
      }
    }

    // Mark token as used
    const { error: tokenUsedError } = await supabase
      .from("teacher_invitation_tokens")
      .update({
        used_at: new Date().toISOString(),
        profile_id: resolvedAuthUserId
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
        profile_id: resolvedAuthUserId
      })
      .ilike("email", email);

    if (requestUpdateError) {
      console.error("Failed to update access request:", requestUpdateError);
    }

    return jsonResponse(200, {
      ok: true,
      message: "Account created successfully. You can now log in.",
      user: {
        id: resolvedAuthUserId,
        email: resolvedAuthUserEmail
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error in set-password.";
    console.error("set-password error:", error);
    return jsonResponse(500, { ok: false, message });
  }
});
