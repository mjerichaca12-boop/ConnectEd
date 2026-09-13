import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-connected-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown): string {
  return clean(value).toLowerCase();
}

Deno.serve(async (req) => {
  // =========================================================
  // OPTIONS
  // =========================================================

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  // =========================================================
  // ONLY POST IS ALLOWED
  // =========================================================

  if (req.method !== "POST") {
    return response(
      {
        success: false,
        error: "Method not allowed",
      },
      405
    );
  }

  try {
    // =======================================================
    // 1. CHECK WEBHOOK SECRET
    // =======================================================

    const receivedSecret = req.headers.get(
      "X-ConnectEd-Webhook-Secret"
    );

    const expectedSecret = Deno.env.get(
      "CONNECTED_WEBHOOK_SECRET"
    );

    if (!expectedSecret) {
      console.error(
        "CONNECTED_WEBHOOK_SECRET is missing."
      );

      return response(
        {
          success: false,
          error: "Server configuration error",
        },
        500
      );
    }

    if (
      !receivedSecret ||
      receivedSecret !== expectedSecret
    ) {
      return response(
        {
          success: false,
          error: "Unauthorized",
        },
        401
      );
    }

    // =======================================================
    // 2. READ REQUEST BODY
    // =======================================================

    let body: any;

    try {
      body = await req.json();
    } catch {
      return response(
        {
          success: false,
          error: "Invalid JSON body",
        },
        400
      );
    }

    // =======================================================
    // 3. GET COMMON FIELDS
    // =======================================================

    const externalRequestId = clean(
      body.external_request_id
    );

    const requestType = clean(
      body.request_type
    ).toLowerCase();

    const firstName = clean(
      body.first_name
    );

    const middleName = clean(
      body.middle_name
    );

    const lastName = clean(
      body.last_name
    );

    const email = normalizeEmail(
      body.email
    );

    const source =
      clean(body.source) ||
      "google_form";

    // =======================================================
    // 4. GET STUDENT-ONLY FIELDS
    // =======================================================

    const lrn = clean(body.lrn);

    const gradeLevel = clean(
      body.grade_level
    );

    const section = clean(
      body.section
    );

    // =======================================================
    // 5. BASIC VALIDATION
    // =======================================================

    if (!externalRequestId) {
      return response(
        {
          success: false,
          error:
            "external_request_id is required",
        },
        400
      );
    }

    if (
      requestType !== "student" &&
      requestType !== "teacher"
    ) {
      return response(
        {
          success: false,
          error:
            "request_type must be student or teacher",
        },
        400
      );
    }

    if (!firstName) {
      return response(
        {
          success: false,
          error: "First Name is required",
        },
        400
      );
    }

    if (!lastName) {
      return response(
        {
          success: false,
          error: "Last Name is required",
        },
        400
      );
    }

    if (!email) {
      return response(
        {
          success: false,
          error: "Email is required",
        },
        400
      );
    }

    // =======================================================
    // 6. EMAIL VALIDATION
    // =======================================================

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return response(
        {
          success: false,
          error: "Invalid email address",
        },
        400
      );
    }

    // =======================================================
    // 7. STUDENT VALIDATION
    // =======================================================

    if (requestType === "student") {
      if (!lrn) {
        return response(
          {
            success: false,
            error: "LRN is required for students",
          },
          400
        );
      }

      if (!gradeLevel) {
        return response(
          {
            success: false,
            error:
              "Grade Level is required for students",
          },
          400
        );
      }

      if (!section) {
        return response(
          {
            success: false,
            error:
              "Section is required for students",
          },
          400
        );
      }
    }

    // =======================================================
    // 8. TEACHER VALIDATION
    // =======================================================
    //
    // IMPORTANT:
    // Teachers DO NOT require Teacher ID.
    //
    // Current Teacher Form:
    // First Name
    // Middle Name
    // Last Name
    // Email
    //
    // =======================================================

    if (requestType === "teacher") {
      // No Teacher ID validation here.
    }

    // =======================================================
    // 9. SUPABASE ADMIN CLIENT
    // =======================================================

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      console.error(
        "Supabase environment variables are missing."
      );

      return response(
        {
          success: false,
          error:
            "Supabase server configuration error",
        },
        500
      );
    }

    const supabaseAdmin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

    // =======================================================
    // 10. CHECK DUPLICATE REQUEST ID
    // =======================================================

    const {
      data: existingRequest,
      error: existingRequestError,
    } =
      await supabaseAdmin
        .from(
          "pending_account_requests"
        )
        .select(
          "id, status, request_type, email"
        )
        .eq(
          "external_request_id",
          externalRequestId
        )
        .maybeSingle();

    if (existingRequestError) {
      console.error(
        "Duplicate request lookup error:",
        existingRequestError
      );

      return response(
        {
          success: false,
          error:
            "Database lookup failed",
        },
        500
      );
    }

    // =======================================================
    // 11. SAME REQUEST WAS ALREADY RECEIVED
    // =======================================================

    if (existingRequest) {
      return response({
        success: true,
        duplicate: true,
        request_id:
          existingRequest.id,
        status:
          existingRequest.status,
        message:
          "This registration request was already received.",
      });
    }

    // =======================================================
    // 12. CHECK EXISTING EMAIL
    // =======================================================

    const {
      data: existingEmailRequest,
      error: existingEmailError,
    } =
      await supabaseAdmin
        .from(
          "pending_account_requests"
        )
        .select(
          "id, status, request_type"
        )
        .eq("email", email)
        .in(
          "status",
          ["pending", "approved"]
        )
        .maybeSingle();

    if (existingEmailError) {
      console.error(
        "Email duplicate lookup error:",
        existingEmailError
      );

      return response(
        {
          success: false,
          error:
            "Database lookup failed",
        },
        500
      );
    }

    if (existingEmailRequest) {
      return response(
        {
          success: false,
          error:
            "This email already has an existing registration request.",
          request_id:
            existingEmailRequest.id,
          status:
            existingEmailRequest.status,
        },
        409
      );
    }

    // =======================================================
    // 13. CHECK STUDENT LRN DUPLICATE
    // =======================================================

    if (
      requestType === "student"
    ) {
      const {
        data: existingLrnRequest,
        error: existingLrnError,
      } =
        await supabaseAdmin
          .from(
            "pending_account_requests"
          )
          .select(
            "id, status, email"
          )
          .eq("lrn", lrn)
          .in(
            "status",
            ["pending", "approved"]
          )
          .maybeSingle();

      if (existingLrnError) {
        console.error(
          "LRN duplicate lookup error:",
          existingLrnError
        );

        return response(
          {
            success: false,
            error:
              "LRN database lookup failed",
          },
          500
        );
      }

      if (existingLrnRequest) {
        return response(
          {
            success: false,
            error:
              "This LRN already has an existing registration request.",
            request_id:
              existingLrnRequest.id,
            status:
              existingLrnRequest.status,
          },
          409
        );
      }
    }

    // =======================================================
    // 14. PREPARE DATABASE RECORD
    // =======================================================

    const registrationData: Record<
      string,
      unknown
    > = {
      request_type: requestType,

      first_name: firstName,

      middle_name:
        middleName || null,

      last_name: lastName,

      email,

      status: "pending",

      source,

      external_request_id:
        externalRequestId,

      submitted_at:
        new Date().toISOString(),
    };

    // =======================================================
    // 15. ADD STUDENT FIELDS
    // =======================================================

    if (
      requestType === "student"
    ) {
      registrationData.lrn = lrn;

      registrationData.grade_level =
        gradeLevel;

      registrationData.section =
        section;

      registrationData.teacher_id =
        null;
    }

    // =======================================================
    // 16. TEACHER HAS NO TEACHER ID
    // =======================================================

    if (
      requestType === "teacher"
    ) {
      registrationData.lrn = null;

      registrationData.grade_level =
        null;

      registrationData.section =
        null;

      registrationData.teacher_id =
        null;
    }

    // =======================================================
    // 17. INSERT INTO PENDING REQUESTS
    // =======================================================

    const {
      data: insertedRequest,
      error: insertError,
    } =
      await supabaseAdmin
        .from(
          "pending_account_requests"
        )
        .insert(
          registrationData
        )
        .select(
          "id, request_type, email, status, external_request_id"
        )
        .single();

    if (insertError) {
      console.error(
        "Insert registration error:",
        insertError
      );

      return response(
        {
          success: false,
          error:
            "Failed to save registration request",
          details:
            insertError.message,
        },
        500
      );
    }

    // =======================================================
    // 18. SUCCESS
    // =======================================================

    return response(
      {
        success: true,

        duplicate: false,

        request_id:
          insertedRequest.id,

        external_request_id:
          insertedRequest.external_request_id,

        request_type:
          insertedRequest.request_type,

        status:
          insertedRequest.status,

        message:
          "Registration request received successfully.",
      },
      201
    );

  } catch (error) {
    console.error(
      "Unexpected error:",
      error
    );

    return response(
      {
        success: false,
        error:
          "Internal server error",
      },
      500
    );
  }
});