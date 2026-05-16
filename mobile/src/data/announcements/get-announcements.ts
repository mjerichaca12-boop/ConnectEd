import { supabase } from "../../lib/supabase";
import { Announcement } from "../../types";

export interface GetAnnouncementsArgs {
    limit?: number;
    subjectId?: string;
}

function resolveImageUrl(path?: string, fallbackPath?: string): string | undefined {
    const target = path || fallbackPath;
    if (!target) return undefined;
    
    // If it's already a full URL, return it
    if (target.startsWith('http')) return target;

    // Try multiple possible buckets.
    const { data: annData } = supabase.storage.from('announcement-images').getPublicUrl(target);
    const { data: msgData } = supabase.storage.from('message-attachments').getPublicUrl(target);
    const { data: matData } = supabase.storage.from('class-materials').getPublicUrl(target);
    
    // Check if the path specifically looks like it belongs to one bucket, 
    // or just return the most likely one (announcement-images for announcements)
    return annData?.publicUrl || msgData?.publicUrl || matData?.publicUrl;
}

function resolveFileUrl(path?: string): string | undefined {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;
    
    const { data: annData } = supabase.storage.from('announcement-images').getPublicUrl(path);
    const { data: msgData } = supabase.storage.from('message-attachments').getPublicUrl(path);
    const { data: matData } = supabase.storage.from('class-materials').getPublicUrl(path);
    
    return annData?.publicUrl || msgData?.publicUrl || matData?.publicUrl;
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
            .select('*, author_profile:profiles!author_id(role), announcement_attachments(file_url, file_type, file_name)')
            .order('created_at', { ascending: false });

        if (limit) query = query.limit(limit);

        if (subjectId) {
            // Include both subject-specific AND global announcements in the subject tab
            query = query.or(`subject_id.eq.${subjectId},subject_id.is.null`);
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

        return data.map(ann => {
            // Primary image logic
            let primaryImage = resolveImageUrl(ann.image_url, ann.file_url);
            
            // If no primary image, check attachments for an image
            if (!primaryImage && ann.announcement_attachments) {
                const imgAttachment = ann.announcement_attachments.find((att: any) => 
                    att.file_type?.startsWith('image/') || 
                    /\.(jpg|jpeg|png|gif|webp)$/i.test(att.file_url || '')
                );
                if (imgAttachment) {
                    primaryImage = imgAttachment.file_url;
                }
            }

            return {
                id: ann.id,
                title: ann.title,
                content: ann.content,
                date: new Date(ann.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                }),
                author: ann.author || "Faculty",
                author_role: ann.author_profile?.role || "staff",
                type: ann.type || "general",
                image_url: primaryImage,
                file_url: resolveFileUrl(ann.file_url),
                file_name: ann.file_name,
                attachments: ann.announcement_attachments || []
            };
        });
    } catch (err) {
        console.error('[announcements] Fatal error:', err);
        return [];
    }
}
