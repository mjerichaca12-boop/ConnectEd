import { supabase } from "../../lib/supabase";

export async function getMyNotifications() {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Not authenticated");

    // 1. Fetch real notifications
    const { data: dbNotifications, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false });

    // 2. Fetch recent announcements
    const { data: announcements } = await supabase
        .from('school_announcements')
        .select('id, title, content, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    // 3. Fetch upcoming calendar events
    const { data: events } = await supabase
        .from('school_calendar_events')
        .select('id, title, date, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (notifError) throw notifError;

    // Map announcements to notification format
    const announcementNotifs = (announcements || []).map(ann => ({
        id: `ann-${ann.id}`,
        user_id: userData.user.id,
        title: `New Announcement: ${ann.title}`,
        body: ann.content,
        type: 'announcement',
        is_read: true, // Virtual notifs are marked read by default for simplicity
        created_at: ann.created_at,
    }));

    // Map events to notification format
    const eventNotifs = (events || []).map(ev => ({
        id: `ev-${ev.id}`,
        user_id: userData.user.id,
        title: `Upcoming Event: ${ev.title}`,
        body: `Date: ${ev.date}`,
        type: 'event',
        is_read: true,
        created_at: ev.created_at,
    }));

    // Merge and sort by date
    const all = [...(dbNotifications || []), ...announcementNotifs, ...eventNotifs];
    return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
