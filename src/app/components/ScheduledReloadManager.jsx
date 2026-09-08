import { useEffect, useRef } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { triggerScheduledPublishingProcess } from "@/app/services/scheduledPublishingService";
import {
  triggerOneTimeReload,
  hasItemReloaded,
  scheduleTargetedReloadTimers
} from "@/app/services/scheduledReloadService";

/**
 * Global ScheduledReloadManager Component
 * Listens for Supabase Realtime publication status changes (Scheduled -> Published),
 * sets targeted one-shot timers for upcoming scheduled items, and triggers a single page reload.
 */
export function ScheduledReloadManager() {
  const activeTimersRef = useRef([]);

  const clearTimers = () => {
    activeTimersRef.current.forEach((t) => clearTimeout(t));
    activeTimersRef.current = [];
  };

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;

    // 1. Initial check & scan for upcoming scheduled items across tables
    const scanAndSetupScheduledItems = async () => {
      clearTimers();

      try {
        // Trigger server-side publishing process for any items currently due
        await triggerScheduledPublishingProcess();

        // Fetch upcoming scheduled items from database
        const nowIso = new Date().toISOString();

        const [lessonsRes, asgRes, quizzesRes, annRes] = await Promise.allSettled([
          supabase.from("lessons").select("id, status, scheduled_publish_at").eq("status", "Scheduled").gt("scheduled_publish_at", nowIso),
          supabase.from("assignments_activity").select("id, status, scheduled_publish_at").eq("status", "Scheduled").gt("scheduled_publish_at", nowIso),
          supabase.from("quizzes").select("id, status, scheduled_publish_at").eq("status", "Scheduled").gt("scheduled_publish_at", nowIso),
          supabase.from("class_announcements").select("id, status, scheduled_publish_at, priority").or('status.eq.Scheduled,priority.ilike.%"status":"Scheduled"%')
        ]);

        const upcomingItems = [];

        if (lessonsRes.status === "fulfilled" && lessonsRes.value?.data) {
          lessonsRes.value.data.forEach((item) => upcomingItems.push(item));
        }
        if (asgRes.status === "fulfilled" && asgRes.value?.data) {
          asgRes.value.data.forEach((item) => upcomingItems.push(item));
        }
        if (quizzesRes.status === "fulfilled" && quizzesRes.value?.data) {
          quizzesRes.value.data.forEach((item) => upcomingItems.push(item));
        }
        if (annRes.status === "fulfilled" && annRes.value?.data) {
          annRes.value.data.forEach((item) => {
            let schedAt = item.scheduled_publish_at;
            if (!schedAt && item.priority) {
              try {
                const parsed = JSON.parse(item.priority);
                if (parsed.status === "Scheduled") schedAt = parsed.scheduled_at;
              } catch (_) {}
            }
            if (schedAt) upcomingItems.push({ ...item, scheduledAt: schedAt });
          });
        }

        if (isMounted) {
          activeTimersRef.current = scheduleTargetedReloadTimers(upcomingItems);
        }
      } catch (err) {
        console.warn("[ScheduledReloadManager] Scan notice:", err);
      }
    };

    scanAndSetupScheduledItems();

    // 2. Realtime Listener across content tables & notifications
    const channelId = `scheduled-reload-rt-${Math.random().toString(36).substring(7)}`;
    const handleRealtimeChange = (payload) => {
      const oldStatus = payload?.old?.status;
      const newStatus = payload?.new?.status;
      const itemId = payload?.new?.id || payload?.old?.id;
      const timestamp = payload?.new?.published_at || payload?.new?.created_at || Date.now();

      // Detect status change from Scheduled to Published OR notification insert for published items
      const isStatusTransition = oldStatus === "Scheduled" && newStatus === "Published";
      const isPublishedNotice = payload?.table === "notifications" && payload?.eventType === "INSERT";

      if ((isStatusTransition || isPublishedNotice) && itemId) {
        if (!hasItemReloaded(itemId, timestamp)) {
          triggerOneTimeReload(itemId, timestamp);
        }
      }
    };

    const channel = supabase
      .channel(channelId)
      .on("postgres_changes", { event: "*", schema: "public", table: "lessons" }, handleRealtimeChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments_activity" }, handleRealtimeChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "quizzes" }, handleRealtimeChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "class_announcements" }, handleRealtimeChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, handleRealtimeChange)
      .subscribe();

    // 3. Tab Visibility / Reconnect Listener
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scanAndSetupScheduledItems();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      clearTimers();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
