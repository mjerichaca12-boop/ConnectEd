import { supabase } from "../../lib/supabase";
import { Announcement } from "../../types";

export interface GetAnnouncementsArgs {
    limit?: number;
    subjectId?: string;
}

function resolveImageUrl(path?: string, fallbackPath?: string): string | undefined {
    const target = path || fallbackPath;
    if (!target) return undefined;

    // Check if the target actually looks like an image file
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(target) || target.startsWith('storage://');
    if (!isImage) return undefined;
    
    // If it's already a full URL, return it
    if (target.startsWith('http')) return target;

    if (target.startsWith('storage://')) {
        const cleaned = target.replace('storage://', '');
        const slashIdx = cleaned.indexOf('/');
        if (slashIdx !== -1) {
            const bucket = cleaned.substring(0, slashIdx);
            const objectPath = cleaned.substring(slashIdx + 1);
            const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
            return data?.publicUrl;
        }
    }

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

    if (path.startsWith('storage://')) {
        const cleaned = path.replace('storage://', '');
        const slashIdx = cleaned.indexOf('/');
        if (slashIdx !== -1) {
            const bucket = cleaned.substring(0, slashIdx);
            const objectPath = cleaned.substring(slashIdx + 1);
            const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
            return data?.publicUrl;
        }
    }
    
    const { data: annData } = supabase.storage.from('announcement-images').getPublicUrl(path);
    const { data: msgData } = supabase.storage.from('message-attachments').getPublicUrl(path);
    const { data: matData } = supabase.storage.from('class-materials').getPublicUrl(path);
    
    return annData?.publicUrl || msgData?.publicUrl || matData?.publicUrl;
}

function parseJSONArrayOrString(val: any): string[] {
    if (!val) return [];
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                return JSON.parse(trimmed);
            } catch (e) {
                return [val];
            }
        }
        return [val];
    }
    if (Array.isArray(val)) return val;
    return [String(val)];
}

/**
 * Retrieves announcements from the database.
 * If a subjectId is provided in args, it strictly queries the class-scoped announcements table,
 * preventing any fallback to general school-wide announcements.
 *
 * @param {GetAnnouncementsArgs} args - Arguments containing limit or subjectId context.
 * @returns {Promise<Announcement[]>} List of mapped announcements.
 */
export async function getAnnouncements(args: GetAnnouncementsArgs = {}): Promise<Announcement[]> {
    const { limit, subjectId } = args;
    try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) return [];

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
        const isStudent = profile?.role === 'student';

        // Check if subjectId intent is present
        const hasSubjectId = 'subjectId' in args && args.subjectId !== undefined;

        if (hasSubjectId) {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const isValidId = !!(subjectId && uuidRegex.test(subjectId));

            if (!isValidId) {
                console.warn(`[announcements] Invalid or unresolved subjectId provided: ${subjectId}`);
                return [];
            }

            // 1. Retrieve the subject's textual code (e.g. "AP2026") from subjects table using subjectId
            const { data: subjectRecord } = await supabase
                .from('subjects')
                .select('code')
                .eq('id', subjectId)
                .single();
            const subjectCode = subjectRecord?.code;

            const announcementsList: any[] = [];

            // 2. Fetch subject-specific announcements from class_announcements table
            let classQuery = supabase
                .from('class_announcements')
                .select('*')
                .eq('class_id', subjectId)
                .order('created_at', { ascending: false });

            if (limit) classQuery = classQuery.limit(limit);

            const { data: classData, error: classError } = await classQuery;

            if (!classError && classData) {
                classData.forEach(ann => {
                    const attachmentsList = Array.isArray(ann.attachments) ? ann.attachments : [];
                    
                    // Primary image/file logic from attachments
                    let primaryImage = undefined;
                    const imgAttachment = attachmentsList.find((att: any) => {
                        const url = att.file_url || att.url || '';
                        const type = att.file_type || att.mimeType || '';
                        return type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                    });
                    if (imgAttachment) {
                        primaryImage = resolveImageUrl(imgAttachment.file_url || imgAttachment.url);
                    }

                    const firstFile = attachmentsList[0];

                    announcementsList.push({
                        id: ann.id,
                        title: ann.title,
                        content: ann.content,
                        date: new Date(ann.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric'
                        }),
                        author: ann.created_by_name || ann.author || "Teacher",
                        author_role: "teacher",
                        type: ann.priority === 'High' ? 'urgent' : 'general',
                        image_url: primaryImage,
                        file_url: firstFile ? resolveFileUrl(firstFile.file_url || firstFile.url) : undefined,
                        file_name: firstFile ? (firstFile.file_name || firstFile.name) : undefined,
                        attachments: attachmentsList.map((att: any) => ({
                            file_url: resolveFileUrl(att.file_url || att.url),
                            file_name: att.file_name || att.name || "Attached File",
                            file_type: att.file_type || att.mimeType || "application/octet-stream"
                        })),
                        created_at: ann.created_at
                    });
                });
            }

            // 3. Fetch subject-specific announcements from the standard announcements table using the text code
            if (subjectCode) {
                let standardQuery = supabase
                    .from('announcements')
                    .select('*')
                    .eq('subject', subjectCode)
                    .order('created_at', { ascending: false });

                if (limit) standardQuery = standardQuery.limit(limit);

                const { data: standardData, error: standardError } = await standardQuery;

                if (!standardError && standardData) {
                    standardData.forEach(ann => {
                        const urls = parseJSONArrayOrString(ann.file_url);
                        const names = parseJSONArrayOrString(ann.file_name);
                        const types = parseJSONArrayOrString(ann.file_type);

                        // Find first image
                        let primaryImage = undefined;
                        const imgIndex = types.findIndex(t => t.startsWith('image/')) !== -1 
                            ? types.findIndex(t => t.startsWith('image/'))
                            : urls.findIndex(u => /\.(jpg|jpeg|png|gif|webp)$/i.test(u));
                        
                        if (imgIndex !== -1) {
                            primaryImage = resolveImageUrl(urls[imgIndex]);
                        } else if (urls.length > 0 && /\.(jpg|jpeg|png|gif|webp)$/i.test(urls[0])) {
                            primaryImage = resolveImageUrl(urls[0]);
                        }

                        const attachments = urls.map((url, index) => ({
                            file_url: resolveFileUrl(url),
                            file_name: names[index] || `file_${index + 1}`,
                            file_type: types[index] || 'application/octet-stream'
                        }));

                        announcementsList.push({
                            id: ann.id,
                            title: ann.title,
                            content: ann.content,
                            date: new Date(ann.created_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric'
                            }),
                            author: ann.author || "Teacher",
                            author_role: "teacher",
                            type: ann.type || 'general',
                            image_url: primaryImage,
                            file_url: urls[0] ? resolveFileUrl(urls[0]) : undefined,
                            file_name: names[0] || undefined,
                            attachments,
                            created_at: ann.created_at
                        });
                    });
                }
            }

            // Sort by raw created_at in descending order
            announcementsList.sort((a, b) => {
                const timeA = new Date(a.created_at).getTime();
                const timeB = new Date(b.created_at).getTime();
                return timeB - timeA;
            });

            const finalResult = announcementsList.map(({ created_at, ...rest }) => rest as Announcement);
            
            if (limit) {
                return finalResult.slice(0, limit);
            }
            return finalResult;
        }

        // GLOBAL FEED FILTER (Queries both global school announcements and class announcements)
        let approvedSubjectIds: string[] = [];
        if (isStudent) {
            const { data: enrollments } = await supabase
                .from('enrollments')
                .select('subject_id')
                .eq('student_id', userId)
                .in('status', ['approved', 'accepted', 'active']);
            approvedSubjectIds = enrollments?.map(e => e.subject_id).filter(Boolean) || [];
        } else {
            const { data: subjects } = await supabase
                .from('subjects')
                .select('id')
                .eq('teacher_id', userId);
            approvedSubjectIds = subjects?.map(s => s.id).filter(Boolean) || [];
        }

        // 1. Fetch school_announcements (no join to announcement_attachments — table does not exist)
        let schoolQuery = supabase
            .from('school_announcements')
            .select('*');
        
        if (isStudent && approvedSubjectIds.length > 0) {
            schoolQuery = schoolQuery.or(`subject_id.in.(${approvedSubjectIds.join(',')}),subject_id.is.null`);
        } else if (isStudent) {
            schoolQuery = schoolQuery.is('subject_id', null);
        }
        
        const { data: schoolAnn, error: schoolErr } = await schoolQuery;

        if (schoolErr) {
            console.error('[announcements] Query error for school_announcements:', schoolErr);
        }

        // 2. Fetch class_announcements
        let classQuery = supabase
            .from('class_announcements')
            .select('*');

        if (approvedSubjectIds.length > 0) {
            classQuery = classQuery.in('class_id', approvedSubjectIds);
        } else if (isStudent) {
            classQuery = classQuery.limit(0);
        }

        const { data: classAnn, error: classErr } = await classQuery;

        if (classErr) {
            console.error('[announcements] Query error for class_announcements:', classErr);
        }

        const allAnnouncementsList: any[] = [];

        if (schoolAnn) {
            schoolAnn.forEach(ann => {
                const primaryImage = resolveImageUrl(ann.image_url, ann.file_url);

                // Build attachments from the inline file columns on school_announcements
                const attachments: any[] = [];
                if (ann.file_url) {
                    attachments.push({
                        file_url: resolveFileUrl(ann.file_url),
                        file_name: ann.file_name || "Attached File",
                        file_type: ann.file_type || (ann.image_url ? "image/png" : "application/octet-stream")
                    });
                }

                allAnnouncementsList.push({
                    id: String(ann.id),
                    title: ann.title,
                    content: ann.content,
                    date: new Date(ann.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                    }),
                    author: ann.author || "Faculty",
                    author_role: "staff",
                    type: ann.type || "general",
                    image_url: primaryImage,
                    file_url: resolveFileUrl(ann.file_url),
                    file_name: ann.file_name,
                    attachments,
                    created_at: ann.created_at
                });
            });
        }

        if (classAnn) {
            classAnn.forEach(ann => {
                const attachmentsList = Array.isArray(ann.attachments) ? ann.attachments : [];
                let primaryImage = undefined;
                const imgAttachment = attachmentsList.find((att: any) => {
                    const url = att.file_url || att.url || '';
                    const type = att.file_type || att.mimeType || '';
                    return type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                });
                if (imgAttachment) {
                    primaryImage = resolveImageUrl(imgAttachment.file_url || imgAttachment.url);
                }

                const firstFile = attachmentsList[0];

                allAnnouncementsList.push({
                    id: String(ann.id),
                    title: ann.title,
                    content: ann.content,
                    date: new Date(ann.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                    }),
                    author: ann.created_by_name || ann.author || "Teacher",
                    author_role: "teacher",
                    type: ann.priority === 'High' ? 'urgent' : 'general',
                    image_url: primaryImage,
                    file_url: firstFile ? resolveFileUrl(firstFile.file_url || firstFile.url) : undefined,
                    file_name: firstFile ? (firstFile.file_name || firstFile.name) : undefined,
                    attachments: attachmentsList.map((att: any) => ({
                        file_url: resolveFileUrl(att.file_url || att.url),
                        file_name: att.file_name || att.name || "Attached File",
                        file_type: att.file_type || att.mimeType || "application/octet-stream"
                    })),
                    created_at: ann.created_at
                });
            });
        }

        // Sort by raw created_at in descending order
        allAnnouncementsList.sort((a, b) => {
            const timeA = new Date(a.created_at).getTime();
            const timeB = new Date(b.created_at).getTime();
            return timeB - timeA;
        });

        const finalResult = allAnnouncementsList.map(({ created_at, ...rest }) => rest as Announcement);

        if (limit) {
            return finalResult.slice(0, limit);
        }

        return finalResult;
    } catch (err) {
        console.error('[announcements] Fatal error:', err);
        return [];
    }
}
