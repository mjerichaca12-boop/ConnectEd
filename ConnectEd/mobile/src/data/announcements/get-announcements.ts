import { supabase } from "../../lib/supabase";
import { Announcement } from "../../types";

export interface GetAnnouncementsArgs {
    limit?: number;
    subjectId?: string;
}

function resolveImageUrl(path?: string, fallbackPath?: string): string | undefined {
    const target = path || fallbackPath;
    if (!target) return undefined;
    if (target.startsWith('http')) return target;
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(target);
    if (!isImage && !path) return undefined;
    const { data } = supabase.storage.from('announcement-images').getPublicUrl(target);
    return data?.publicUrl;
}

function resolveFileUrl(path?: string): string | undefined {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage.from('announcement-images').getPublicUrl(path);
    return data?.publicUrl;
}

export async function getAnnouncements({ limit, subjectId }: GetAnnouncementsArgs = {}): Promise<Announcement[]> {
    try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) return [];

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
        const isStudent = profile?.role === 'student';

        let query = supabase
            .from('school_announcements')
            .select('*, author_profile:profiles!author_id(role)')
            .order('created_at', { ascending: false });

        if (limit) query = query.limit(limit);

        if (subjectId) {
            // STRICT SUBJECT FILTER
            // We ensure it's an exact match for the subject
            query = query.eq('subject_id', subjectId);
        } else if (isStudent) {
            // GLOBAL FEED FILTER
            const { data: enrollments } = await supabase
                .from('enrollments')
                .select('subject_id')
                .eq('student_id', userId)
                .in('status', ['approved', 'accepted', 'active']);
            
            const approvedSubjectIds = enrollments?.map(e => e.subject_id).filter(Boolean) || [];

            if (approvedSubjectIds.length > 0) {
                query = query.or(`subject_id.in.(${approvedSubjectIds.join(',')}),subject_id.is.null`);
            } else {
                query = query.is('subject_id', null);
            }
        }

        const { data, error } = await query;

        if (error) {
            console.error('[announcements] Query error for subject:', subjectId, error);
            return [];
        }

        if (!data || data.length === 0) {
            console.log('[announcements] No data found for subject:', subjectId);
        }

        return data.map(ann => ({
            id: ann.id,
            title: ann.title,
            content: ann.content,
            date: new Date(ann.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            }),
            author: ann.author || "Faculty",
            author_role: ann.author_profile?.role || "staff",
            type: ann.type || "general",
            image_url: resolveImageUrl(ann.image_url, ann.file_url),
            file_url: resolveFileUrl(ann.file_url),
            file_name: ann.file_name,
        }));
    } catch (err) {
        console.error('[announcements] Fatal error:', err);
        return [];
    }
}
