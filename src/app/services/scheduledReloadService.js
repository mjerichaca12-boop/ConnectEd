import { supabase } from "@/app/lib/supabaseClient";
import { triggerScheduledPublishingProcess } from "@/app/services/scheduledPublishingService";

/**
 * Session storage guard helper to prevent continuous/duplicate page reloads
 */
export const getReloadGuardKey = (itemId, timestamp) => {
  const cleanId = String(itemId || "item").trim();
  const cleanTime = String(timestamp || "time").trim();
  return `sch_reload_guard_${cleanId}_${cleanTime}`;
};

export const hasItemReloaded = (itemId, timestamp) => {
  try {
    const key = getReloadGuardKey(itemId, timestamp);
    return sessionStorage.getItem(key) === "true";
  } catch (_) {
    return false;
  }
};

export const markItemReloaded = (itemId, timestamp) => {
  try {
    const key = getReloadGuardKey(itemId, timestamp);
    sessionStorage.setItem(key, "true");
  } catch (_) {}
};

/**
 * Triggers a single page reload ONCE for a scheduled publication event
 */
export const triggerOneTimeReload = (itemId, timestamp) => {
  if (hasItemReloaded(itemId, timestamp)) return;
  markItemReloaded(itemId, timestamp);

  if (typeof window !== "undefined" && window.location) {
    console.log(`[ScheduledReload] Scheduled publication time reached for ${itemId}. Performing single page reload.`);
    window.location.reload();
  }
};

/**
 * Scans an array of content items (lessons, assignments, quizzes, announcements)
 * and sets targeted one-shot timers to reload the page when their scheduled time is reached.
 */
export const scheduleTargetedReloadTimers = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const timers = [];
  const now = Date.now();

  items.forEach((item) => {
    if (!item || !item.id) return;

    const rawStatus = String(item.status || "").trim();
    const scheduledAt = item.scheduledAt || item.scheduled_publish_at || item.scheduled_at;

    if (!scheduledAt) return;

    const scheduledTime = new Date(scheduledAt).getTime();
    if (isNaN(scheduledTime)) return;

    // A. Item is ALREADY due (scheduledTime <= now)
    if (scheduledTime <= now) {
      if (rawStatus === "Scheduled" || String(item.priority || "").includes('"status":"Scheduled"')) {
        // Evaluate DB publishing and reload ONCE if not already reloaded
        triggerScheduledPublishingProcess().then(() => {
          if (!hasItemReloaded(item.id, scheduledAt)) {
            triggerOneTimeReload(item.id, scheduledAt);
          }
        });
      }
      return;
    }

    // B. Item is in the FUTURE (scheduledTime > now)
    const delay = scheduledTime - now + 500; // 500ms safety buffer
    if (delay > 0 && delay < 86400000) { // Only set timers for items within 24 hours
      if (hasItemReloaded(item.id, scheduledAt)) return;

      const timerId = setTimeout(async () => {
        await triggerScheduledPublishingProcess();
        if (!hasItemReloaded(item.id, scheduledAt)) {
          triggerOneTimeReload(item.id, scheduledAt);
        }
      }, delay);

      timers.push(timerId);
    }
  });

  return timers;
};
