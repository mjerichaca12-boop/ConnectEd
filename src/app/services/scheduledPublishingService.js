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
  const nowDate = new Date();

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

    // Handle announcements where scheduled status/time is stored inside priority JSON
    const { data: scheduledAnns } = await supabase
      .from("class_announcements")
      .select("id, priority, status, scheduled_publish_at")
      .or('status.eq.Scheduled,priority.ilike.%"status":"Scheduled"%');

    if (Array.isArray(scheduledAnns) && scheduledAnns.length > 0) {
      for (const ann of scheduledAnns) {
        let isDue = false;
        let parsedPriority = null;

        if (ann.scheduled_publish_at && new Date(ann.scheduled_publish_at) <= nowDate) {
          isDue = true;
        }

        if (ann.priority && String(ann.priority).includes('"status":"Scheduled"')) {
          try {
            parsedPriority = JSON.parse(ann.priority);
            if (parsedPriority?.scheduled_at && new Date(parsedPriority.scheduled_at) <= nowDate) {
              isDue = true;
            }
          } catch (_) {}
        }

        if (isDue) {
          const updatePayload = {
            status: "Published",
            published_at: nowIso,
            scheduled_publish_at: null
          };

          if (parsedPriority) {
            parsedPriority.status = "Published";
            parsedPriority.scheduled_at = null;
            updatePayload.priority = JSON.stringify(parsedPriority);
          }

          await supabase
            .from("class_announcements")
            .update(updatePayload)
            .eq("id", ann.id)
            .catch(() => {});
        }
      }
    }
  } catch (_) {}
}
