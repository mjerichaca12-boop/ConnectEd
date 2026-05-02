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
    message.includes("could not find the 'last_name' column") ||
    message.includes("could not find the 'middle_name' column") ||
    message.includes("could not find the 'phone' column") ||
    message.includes("could not find the 'subjects' column") ||
    details.includes("first_name") ||
    details.includes("last_name") ||
    details.includes("middle_name") ||
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

    let body: {
      email?: string;
      name?: string;
      fullName?: string;
      firstName?: string;
      middleName?: string;
      lastName?: string;
      phone?: string;
      schoolName?: string;
      position?: string;
      subjects?: string | string[];
      additionalInfo?: string;
    };

    try {
      body = await req.json();
    } catch (error) {
      console.error("request-access: failed to parse request body", error);
      return jsonResponse(400, { ok: false, message: "Invalid request payload." });
    }

    const email = String(body.email || "").trim().toLowerCase();
    const firstName = String(body.firstName || "").trim();
    const middleName = String(body.middleName || "").trim() || null;
    const lastName = String(body.lastName || "").trim();
    const fullName = String(body.fullName || body.name || "").trim();
    const phone = String(body.phone || "").trim() || null;
    const schoolName = String(body.schoolName || "").trim() || null;
    const position = String(body.position || "").trim() || null;
    const subjectsValue = body.subjects;
    const additionalInfo = String(body.additionalInfo || "").trim() || null;

    // Validation
    if (!email) {
      return jsonResponse(400, { ok: false, message: "Email is required." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return jsonResponse(400, { ok: false, message: "Invalid email format." });
    }

    const resolvedNameParts = (() => {
      if (firstName && lastName) {
        return { firstName, middleName, lastName };
      }

      const normalizedFullName = fullName.replace(/\s+/g, " ").trim();
      if (!normalizedFullName) {
        return null;
      }

      const parts = normalizedFullName.split(" ");
      if (parts.length === 1) {
        return { firstName: parts[0], middleName: null, lastName: parts[0] };
      }

      if (parts.length === 2) {
        return { firstName: parts[0], middleName: null, lastName: parts[1] };
      }

      return {
        firstName: parts[0],
        middleName: parts.slice(1, -1).join(" ") || null,
        lastName: parts[parts.length - 1]
      };
    })();

    if (!resolvedNameParts?.firstName || !resolvedNameParts?.lastName) {
      return jsonResponse(400, { ok: false, message: "First and last name are required." });
    }

    const subjects = Array.isArray(subjectsValue)
      ? subjectsValue.map((subject) => String(subject || "").trim()).filter(Boolean)
      : String(subjectsValue || "")
          .split(",")
          .map((subject) => subject.trim())
          .filter(Boolean);

    const subjectsArray = subjects.length > 0 ? subjects : [];
    const displayName = [resolvedNameParts.firstName, resolvedNameParts.middleName, resolvedNameParts.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id, role, is_verified")
      .ilike("email", email)
      .maybeSingle();

    if (profileLookupError) {
      console.error("request-access: profile lookup failed", profileLookupError);
      return jsonResponse(500, {
        ok: false,
        message: `Failed to check existing profile: ${profileLookupError.message}`
      });
    }

    if (existingProfile?.role === "teacher" && existingProfile.is_verified) {
      return jsonResponse(400, {
        ok: false,
        message: "An active teacher account already exists for this email. Please log in instead."
      });
    }

    // Check if request already exists
    const { data: existingRequest, error: requestLookupError } = await supabase
      .from("teacher_access_requests")
      .select("id, status")
      .ilike("email", email)
      .maybeSingle();

    if (requestLookupError) {
      console.error("request-access: request lookup failed", requestLookupError);
      return jsonResponse(500, {
        ok: false,
        message: `Failed to check existing request: ${requestLookupError.message}`
      });
    }

    if (existingRequest) {
      if (existingRequest.status === "pending") {
        return jsonResponse(400, {
          ok: false,
          message: "You have already submitted an access request. Please wait for admin review."
        });
      } else if (existingRequest.status === "approved" || existingRequest.status === "invited") {
        return jsonResponse(400, {
          ok: false,
          message: "Your access request has been approved. Check your email for the invitation link."
        });
      } else if (existingRequest.status === "rejected") {
        return jsonResponse(400, {
          ok: false,
          message: "Your access request was rejected. Please contact an administrator."
        });
      }
    }

    // Create new access request
    const { data: newRequest, error: insertError } = await supabase
      .from("teacher_access_requests")
      .insert({
        email,
        profile_id: existingProfile?.id || null,
        first_name: resolvedNameParts.firstName,
        middle_name: resolvedNameParts.middleName,
        last_name: resolvedNameParts.lastName,
        phone,
        school_name: schoolName,
        position,
        subjects: subjectsArray,
        additional_info: additionalInfo,
        status: "pending"
      })
      .select("id")
      .single();

    if (insertError || !newRequest) {
      if (shouldFallbackToLegacyRequestSchema(insertError)) {
        console.warn("request-access: falling back to legacy access-request schema", insertError);

        const legacyInsert = await supabase
          .from("teacher_access_requests")
          .insert({
            email,
            name: displayName,
            school_name: schoolName,
            position,
            subject_area: subjectsArray.join(", ") || null,
            phone_number: phone,
            additional_info: additionalInfo,
            status: "pending"
          })
          .select("id")
          .single();

        if (legacyInsert.error || !legacyInsert.data) {
          console.error("request-access: legacy insert failed", legacyInsert.error);
          return jsonResponse(500, {
            ok: false,
            message: legacyInsert.error?.message || insertError?.message || "Failed to submit access request. Please try again later."
          });
        }

        return jsonResponse(200, {
          ok: true,
          message: "Access request submitted successfully. An administrator will review it shortly.",
          requestId: legacyInsert.data.id
        });
      }

      console.error("request-access: failed to insert access request", insertError);
      return jsonResponse(500, {
        ok: false,
        message: insertError?.message || "Failed to submit access request. Please try again later."
      });
    }

    return jsonResponse(200, {
      ok: true,
      message: "Access request submitted successfully. An administrator will review it shortly.",
      requestId: newRequest.id
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error in request-access.";
    console.error("request-access error:", error);
    return jsonResponse(500, { ok: false, message });
  }
});
