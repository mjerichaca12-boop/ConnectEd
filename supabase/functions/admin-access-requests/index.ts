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
    const status = String(body.status || "").trim().toLowerCase();
    const reviewedBy = String(body.reviewedBy || "admin").trim() || "admin";
    const notes = String(body.notes || "").trim();

    if (action === "list") {
      const { data, error } = await supabase
        .from("teacher_access_requests")
        .select("*")
        .order("requested_at", { ascending: false });

      if (error) {
        console.error("admin-access-requests: list failed", error);
        return jsonResponse(500, { ok: false, message: error.message });
      }

      return jsonResponse(200, { ok: true, requests: data || [] });
    }

    if (!requestId) {
      return jsonResponse(400, { ok: false, message: "Request id is required." });
    }

    if (action === "approve") {
      const { data, error } = await supabase
        .from("teacher_access_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewedBy,
          admin_notes: notes || null
        })
        .eq("id", requestId)
        .select("*")
        .single();

      if (error) {
        console.error("admin-access-requests: approve failed", error);
        return jsonResponse(500, { ok: false, message: error.message });
      }

      return jsonResponse(200, { ok: true, request: data });
    }

    if (action === "reject") {
      const { data, error } = await supabase
        .from("teacher_access_requests")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewedBy,
          admin_notes: notes || null
        })
        .eq("id", requestId)
        .select("*")
        .single();

      if (error) {
        console.error("admin-access-requests: reject failed", error);
        return jsonResponse(500, { ok: false, message: error.message });
      }

      return jsonResponse(200, { ok: true, request: data });
    }

    if (action === "delete") {
      const { data, error } = await supabase
        .from("teacher_access_requests")
        .delete()
        .eq("id", requestId)
        .select("id")
        .single();

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
