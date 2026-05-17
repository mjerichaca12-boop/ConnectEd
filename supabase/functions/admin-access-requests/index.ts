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

const normalizeStatus = (statusValue: unknown) => {
  const value = String(statusValue || "").trim().toLowerCase();
  if (["pending", "for_approval", "waiting", "awaiting_approval", "awaiting approval"].includes(value)) return "pending";
  if (["approved", "approve", "accepted", "active", "verified"].includes(value)) return "approved";
  if (["rejected", "reject", "declined", "denied"].includes(value)) return "rejected";
  if (["invited", "invite_sent", "sent"].includes(value)) return "invited";
  return value || "pending";
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

const runRequestTableMutation = async (
  operation: "update" | "delete",
  requestId: string,
  payload?: Record<string, unknown>
) => {
  let lastError: { message?: string; details?: string; code?: string } | null = null;

  for (const requestTable of REQUEST_TABLES) {
    const query = operation === "update"
      ? supabase.from(requestTable).update(payload || {}).eq("id", requestId).select("*").single()
      : supabase.from(requestTable).delete().eq("id", requestId).select("id").single();

    const result = await query;
    console.log(`[admin-access-requests] ${operation} attempt`, {
      table: requestTable,
      requestId,
      success: !result.error,
      error: result.error?.message
    });

    if (!result.error) {
      return { data: result.data, table: requestTable, error: null };
    }

    lastError = result.error;
    if (!isMissingRelationError(result.error)) {
      return { data: null, table: requestTable, error: result.error };
    }
  }

  return { data: null, table: REQUEST_TABLES[0], error: lastError };
};

const getRequestTimestamp = (request: Record<string, unknown>) => {
  return String(request.requested_at || request.created_at || request.updated_at || new Date().toISOString());
};

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { status: 200, headers: corsHeaders });
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
      action?: string;
      id?: string;
      status?: string;
      reviewedBy?: string;
      notes?: string;
    };

    try {
      body = await req.json();
    } catch (error) {
      console.error("admin-access-requests: failed to parse request body", error);
      return jsonResponse(400, { ok: false, message: "Invalid request payload." });
    }

    const action = String(body.action || "list").trim().toLowerCase();
    const requestId = String(body.id || "").trim();
    const reviewedBy = String(body.reviewedBy || "admin").trim() || "admin";
    const notes = String(body.notes || "").trim();

    if (action === "list") {
      let data: Record<string, unknown>[] = [];
      let activeTable = REQUEST_TABLES[0];
      let queryResult: { data: Record<string, unknown>[] | null; error: { message?: string; details?: string; code?: string } | null } = {
        data: null,
        error: null
      };

      for (const requestTable of REQUEST_TABLES) {
        console.log("[admin-access-requests] fetching requests from table:", requestTable);
        const requestedAtResult = await supabase
          .from(requestTable)
          .select("*")
          .order("requested_at", { ascending: false });

        console.log("[admin-access-requests] requested_at query:", {
          table: requestTable,
          success: !requestedAtResult.error,
          count: Array.isArray(requestedAtResult.data) ? requestedAtResult.data.length : 0,
          error: requestedAtResult.error?.message,
          code: requestedAtResult.error?.code
        });

        if (!requestedAtResult.error || !isMissingRelationError(requestedAtResult.error)) {
          queryResult = requestedAtResult;
          activeTable = requestTable;
          break;
        }

        console.warn("[admin-access-requests] table missing, trying fallback:", requestTable, requestedAtResult.error?.message);
      }

      if (queryResult.error) {
        const message = String(queryResult.error.message || "").toLowerCase();
        const missingRequestedAt = message.includes("requested_at") && message.includes("column");

        if (!missingRequestedAt) {
          console.error("[admin-access-requests] list failed", queryResult.error);
          return jsonResponse(500, { ok: false, message: queryResult.error.message });
        }

        console.warn("[admin-access-requests] falling back to created_at ordering", queryResult.error);

        const createdAtResult = await supabase
          .from(activeTable)
          .select("*")
          .order("created_at", { ascending: false });

        console.log("[admin-access-requests] created_at fallback query:", {
          table: activeTable,
          success: !createdAtResult.error,
          count: Array.isArray(createdAtResult.data) ? createdAtResult.data.length : 0,
          error: createdAtResult.error?.message
        });

        if (createdAtResult.error) {
          console.error("[admin-access-requests] fallback list failed", createdAtResult.error);
          return jsonResponse(500, { ok: false, message: createdAtResult.error.message });
        }

        data = Array.isArray(createdAtResult.data) ? createdAtResult.data : [];
      } else {
        data = Array.isArray(queryResult.data) ? queryResult.data : [];
      }

      console.log("[admin-access-requests] fetched", data.length, "requests total");
      
      if (data.length > 0) {
        console.log("[admin-access-requests] first request sample:", {
          id: data[0].id,
          email: data[0].email,
          status: data[0].status,
          created_at: data[0].created_at
        });
      }
      
      const normalizedRequests = data
        .map((request) => {
          const normalizedStatus = normalizeStatus(request.status);
          return {
            ...request,
            status: normalizedStatus,
            requested_at: getRequestTimestamp(request),
            can_approve: normalizedStatus === "pending"
          };
        })
        .sort((left, right) => new Date(String(right.requested_at)).getTime() - new Date(String(left.requested_at)).getTime());

      console.log("[admin-access-requests] normalized", normalizedRequests.length, "requests");
      return jsonResponse(200, { ok: true, requests: normalizedRequests });
    }

    if (!requestId) {
      return jsonResponse(400, { ok: false, message: "Request id is required." });
    }

    if (action === "approve") {
      console.log("[admin-access-requests] approving request:", requestId);

      const mutation = await runRequestTableMutation("update", requestId, {
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
        admin_notes: notes || null
      });

      const { data, error } = mutation;

      console.log("[admin-access-requests] approve update result:", {
        success: !error,
        requestId: data?.id,
        status: data?.status,
        email: data?.email,
        table: mutation.table,
        error: error?.message
      });

      if (error) {
        console.error("[admin-access-requests] approve failed", error);
        return jsonResponse(500, { ok: false, message: error.message });
      }

      console.log("[admin-access-requests] request approved successfully, status should now be 'approved'");
      return jsonResponse(200, { ok: true, request: data, message: "Request approved. Proceed to send invitation." });
    }

    if (action === "reject") {
      const mutation = await runRequestTableMutation("update", requestId, {
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
        admin_notes: notes || null
      });

      const { data, error } = mutation;

      if (error) {
        console.error("admin-access-requests: reject failed", error);
        return jsonResponse(500, { ok: false, message: error.message });
      }

      return jsonResponse(200, { ok: true, request: data });
    }

    if (action === "delete") {
      const mutation = await runRequestTableMutation("delete", requestId);
      const { data, error } = mutation;

      if (error) {
        console.error("admin-access-requests: delete failed", error);
        return jsonResponse(500, { ok: false, message: error.message });
      }

      return jsonResponse(200, { ok: true, deletedId: data.id });
    }

    return jsonResponse(400, { ok: false, message: `Unknown action: ${action}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error in admin-access-requests.";
    console.error("admin-access-requests error:", error);
    return jsonResponse(500, { ok: false, message });
  }
});
