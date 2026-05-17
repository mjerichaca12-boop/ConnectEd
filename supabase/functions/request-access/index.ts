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

const normalizeRequestStatus = (statusValue: unknown) => {
  const value = String(statusValue || "").trim().toLowerCase();
  if (["pending", "for_approval", "waiting", "awaiting_approval", "awaiting approval"].includes(value)) return "pending";
  if (["approved", "invited", "accepted", "active", "verified"].includes(value)) return "approved";
  if (["rejected", "declined", "denied"].includes(value)) return "rejected";
  return value;
};

const REQUEST_TABLES = ["teacher_access_request", "teacher_request_access", "teacher_access_requests"] as const;

const isMissingRelationError = (error: { message?: string; details?: string } | null | undefined) => {
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  return (
    message.includes("relation") ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    details.includes("relation") ||
    details.includes("schema cache")
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

    // Check if an active teacher profile already exists
    console.log("[request-access] checking for existing teacher profile:", email);
    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id, role, is_verified, email")
      .ilike("email", email)
      .maybeSingle();

    console.log("[request-access] profile lookup result:", {
      found: !!existingProfile,
      role: existingProfile?.role,
      is_verified: existingProfile?.is_verified,
      error: profileLookupError?.message
    });

    if (profileLookupError) {
      console.error("request-access: profile lookup failed", profileLookupError);
      return jsonResponse(500, {
        ok: false,
        message: `Failed to check existing profile: ${profileLookupError.message}`
      });
    }

    // Only reject if profile exists AND is an active verified teacher
    if (existingProfile?.role === "teacher" && existingProfile.is_verified === true) {
      console.log("[request-access] active teacher already exists for email:", email);
      return jsonResponse(400, {
        ok: false,
        message: "An active teacher account already exists for this email. Please log in instead."
      });
    }
    
    // If profile exists but is NOT verified, allow submission to proceed
    if (existingProfile && !existingProfile.is_verified) {
      console.log("[request-access] profile exists but not verified, allowing request submission");
    }

    // Check if request already exists in either table
    let existingRequest: Record<string, unknown> | null = null;
    let requestLookupError: { message?: string; details?: string; code?: string } | null = null;
    let requestTableUsed: string | null = null;

    for (const requestTable of REQUEST_TABLES) {
      console.log("[request-access] checking for existing access request:", { email, requestTable });
      const lookup = await supabase
        .from(requestTable)
        .select("id, status, email")
        .ilike("email", email)
        .maybeSingle();

      if (!lookup.error || !isMissingRelationError(lookup.error)) {
        existingRequest = lookup.data as Record<string, unknown> | null;
        requestLookupError = lookup.error;
        requestTableUsed = requestTable;
        break;
      }

      console.warn("[request-access] request table missing, trying fallback:", requestTable, lookup.error?.message);
    }

    console.log("[request-access] request lookup result:", {
      found: !!existingRequest,
      status: existingRequest?.status,
      error: requestLookupError?.message,
      table: requestTableUsed
    });

    if (requestLookupError && !isMissingRelationError(requestLookupError)) {
      console.error("request-access: request lookup failed", requestLookupError);
      return jsonResponse(500, {
        ok: false,
        message: `Failed to check existing request: ${requestLookupError.message}`
      });
    }

    if (existingRequest) {
      const existingStatus = normalizeRequestStatus(existingRequest.status);
      console.log("[request-access] existing request found with status:", existingStatus);

      if (existingStatus === "pending") {
        return jsonResponse(400, {
          ok: false,
          message: "You have already submitted an access request. Please wait for admin review."
        });
      } else if (existingStatus === "approved") {
        return jsonResponse(400, {
          ok: false,
          message: "Your access request has been approved. Check your email for the invitation link."
        });
      } else if (existingStatus === "rejected") {
        return jsonResponse(400, {
          ok: false,
          message: "Your access request was rejected. Please contact an administrator."
        });
      }
    }

    // Create new access request
    const insertPayload = {
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
    };

    console.log("[request-access] attempting insert with new schema:", {
      email,
      first_name: resolvedNameParts.firstName,
      last_name: resolvedNameParts.lastName,
      status: "pending"
    });

    let newRequest: { id?: string; email?: string; status?: string } | null = null;
    let insertError: { message?: string; details?: string; code?: string } | null = null;
    let insertTableUsed: string | null = null;

    for (const requestTable of REQUEST_TABLES) {
      console.log("[request-access] attempting request insert:", { email, requestTable });
      const insertResult = await supabase
        .from(requestTable)
        .insert(insertPayload)
        .select("id, email, status")
        .single();

      if (!insertResult.error) {
        newRequest = insertResult.data;
        insertError = null;
        insertTableUsed = requestTable;
        break;
      }

      insertError = insertResult.error;
      console.warn("[request-access] request insert failed for table:", requestTable, insertResult.error?.message);
      if (!isMissingRelationError(insertResult.error)) {
        break;
      }
    }

    console.log("[request-access] insert result:", {
      success: !!newRequest && !insertError,
      insertedId: newRequest?.id,
      error: insertError?.message,
      errorDetails: insertError?.details,
      table: insertTableUsed
    });

    if (insertError || !newRequest) {
      // Check if this is an RLS policy error
      const errorMsg = String(insertError?.message || "").toLowerCase();
      const errorDetails = String(insertError?.details || "").toLowerCase();
      const isRLSError = errorMsg.includes("policy") || errorMsg.includes("row level security") || 
                         errorDetails.includes("policy") || 
                         (insertError?.code === "42501"); // PostgreSQL code for insufficient privilege

      console.error("[request-access] INSERT failed with RLS error:", {
        isRLSError,
        errorCode: insertError?.code,
        errorMessage: errorMsg,
        errorDetails
      });

      if (isRLSError) {
        return jsonResponse(500, {
          ok: false,
          message: "Server configuration error: Unable to save access request due to missing database policy. Please contact the administrator.",
          debugInfo: "The teacher_access_requests table requires an INSERT policy to be configured."
        });
      }

      if (shouldFallbackToLegacyRequestSchema(insertError)) {
        console.warn("[request-access] insert failed, checking if schema fallback needed:", insertError?.message);

        const legacyInsert = await supabase
          .from(insertTableUsed || "teacher_access_requests")
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

        console.log("[request-access] legacy insert result:", {
          success: !!legacyInsert.data && !legacyInsert.error,
          error: legacyInsert.error?.message,
          table: insertTableUsed || "teacher_access_requests"
        });

        if (legacyInsert.error || !legacyInsert.data) {
          console.error("[request-access] legacy insert failed", legacyInsert.error);
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

      console.error("[request-access] failed to insert access request", insertError);
      return jsonResponse(500, {
        ok: false,
        message: insertError?.message || "Failed to submit access request. Please try again later."
      });
    }

    console.log("[request-access] access request created successfully:", {
      requestId: newRequest.id,
      email: newRequest.email,
      status: newRequest.status
    });

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
