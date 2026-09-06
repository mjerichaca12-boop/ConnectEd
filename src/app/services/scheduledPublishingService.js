import { supabase } from "@/app/lib/supabaseClient";

/**
 * Evaluates and publishes any scheduled items that are due.
 * First tries calling server-side Supabase RPC 'check_and_process_scheduled_publishing'.
 * If the RPC function has not been applied to the remote Supabase database (HTTP 404 / PGRST202),
 * it seamlessly executes direct client table updates for lessons, assignments, quizzes, and announcements.
 */
export async function triggerScheduledPublishingProcess() {
  if (!supabase) return;

  const nowIso = new Date().toISOString();

  try {
    const { error } = await supabase.rpc("check_and_process_scheduled_publishing");
    if (!error) return; // RPC succeeded!
  } catch (_) {
    // RPC failed or returned network error
  }

  // Fallback direct table updates if RPC is not present on remote Supabase instance
  try {
    await Promise.allSettled([
      supabase
        .from("lessons")
        .update({ status: "Published", published_at: nowIso, scheduled_publish_at: null })
        .eq("status", "Scheduled")
        .lte("scheduled_publish_at", nowIso),
      supabase
        .from("assignments_activity")
        .update({ status: "Published", published_at: nowIso, scheduled_publish_at: null })
        .eq("status", "Scheduled")
        .lte("scheduled_publish_at", nowIso),
      supabase
        .from("quizzes")
        .update({ status: "Published", published_at: nowIso, scheduled_publish_at: null })
        .eq("status", "Scheduled")
        .lte("scheduled_publish_at", nowIso),
      supabase
        .from("class_announcements")
        .update({ status: "Published", published_at: nowIso, scheduled_publish_at: null })
        .eq("status", "Scheduled")
        .lte("scheduled_publish_at", nowIso)
    ]);
  } catch (_) {}
}
