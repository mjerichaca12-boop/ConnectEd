import { supabase } from "../../lib/supabase";
import { Meeting } from "../../types";

export interface GetMeetingsArgs {
    subjectId?: string;
    limit?: number;
}

export async function getMeetings({ subjectId, limit }: GetMeetingsArgs = {}): Promise<Meeting[]> {
    let query = supabase
        .from('online_class_meetings')
        .select('*')
        .order('time', { ascending: true });

    if (subjectId) {
        query = query.eq('subject_id', subjectId);
    }

    if (limit) {
        query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('not found')) {
            console.warn('[meetings] table online_class_meetings not found');
            return [];
        }
        throw error;
    }

    return (data || []).map(m => {
        const statusStr = String(m.status || "").trim().toLowerCase();
        let normalizedStatus: "Pending" | "Ongoing" | "Done" = "Pending";
        
        if (statusStr === "ongoing" || statusStr === "live" || m.is_meeting_active) {
            normalizedStatus = "Ongoing";
        } else if (statusStr === "done" || statusStr === "ended" || statusStr === "completed") {
            normalizedStatus = "Done";
        } else if (statusStr === "pending" || statusStr === "scheduled") {
            normalizedStatus = "Pending";
        }

        let timeStr = m.scheduled_time || m.time || "";
        if (timeStr.includes('T')) {
            try {
                timeStr = new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (e) {}
        } else if (timeStr.length > 5) {
            timeStr = timeStr.slice(0, 5);
        }

        return {
            id: m.id,
            subject: m.subject_code || m.subject || "Unknown",
            title: m.title,
            time: timeStr,
            status: normalizedStatus,
            rawDate: m.scheduled_date || m.time,
            subject_id: m.subject_id,
            meeting_link: m.meeting_link,
        };
    });
}
