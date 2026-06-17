import { supabase } from "../../lib/supabase";
import { Announcement } from "../../types";

/**
 * Resolves a Supabase storage path or external URL to a usable public URL
 */
function resolveImageUrl(path?: string, fallbackPath?: string): string | undefined {
    const target = path || fallbackPath;
    if (!target) return undefined;

    // Check if the target actually looks like an image file
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(target) || target.startsWith('storage://');
    if (!isImage) return undefined;
    
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

export async function getAnnouncementById(id: string): Promise<Announcement | null> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(id);

    if (isUuid) {
        let { data, error } = await supabase
            .from('class_announcements')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (!data) {
            // Try standard/global announcements table fallback
            const result = await supabase
                .from('announcements')
                .select('*')
                .eq('id', id)
                .maybeSingle();
            data = result.data;
            error = result.error;
        }

        if (error || !data) {
            console.error('[announcements] Error fetching class/standard announcement detail:', error);
            return null;
        }

        let attachmentsList = Array.isArray(data.attachments) ? data.attachments : [];
        if (attachmentsList.length === 0 && data.file_url) {
            const urls = parseJSONArrayOrString(data.file_url);
            const names = parseJSONArrayOrString(data.file_name);
            const types = parseJSONArrayOrString(data.file_type);
            attachmentsList = urls.map((url, index) => ({
                file_url: url,
                file_name: names[index] || "Attached File",
                file_type: types[index] || (/\.(jpg|jpeg|png|gif|webp)$/i.test(url) ? "image/png" : "application/octet-stream")
            }));
        }

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

        return {
            id: data.id,
            title: data.title,
            content: data.content,
            date: new Date(data.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            }),
            author: data.created_by_name || data.author || "Teacher",
            author_role: "teacher",
            type: data.priority === 'High' ? 'urgent' : 'general',
            image_url: primaryImage,
            file_url: firstFile ? resolveFileUrl(firstFile.file_url || firstFile.url) : undefined,
            file_name: firstFile ? (firstFile.file_name || firstFile.name) : undefined,
            attachments: attachmentsList.map((att: any) => ({
                file_url: resolveFileUrl(att.file_url || att.url),
                file_name: att.file_name || att.name || "Attached File",
                file_type: att.file_type || att.mimeType || "application/octet-stream"
            }))
        };
    }

    const { data, error } = await supabase
        .from('school_announcements')
        .select('*, author_profile:profiles!author_id(role), announcement_attachments(file_url, file_type, file_name)')
        .eq('id', id)
        .single();

    if (error || !data) {
        console.error('[announcements] Error fetching detail:', error);
        return null;
    }

    // Primary image logic
    let primaryImage = resolveImageUrl(data.image_url, data.file_url);
    
    // If no primary image, check attachments for an image
    if (!primaryImage && data.announcement_attachments) {
        const imgAttachment = data.announcement_attachments.find((att: any) => 
            att.file_type?.startsWith('image/') || 
            /\.(jpg|jpeg|png|gif|webp)$/i.test(att.file_url || '')
        );
        if (imgAttachment) {
            primaryImage = resolveImageUrl(imgAttachment.file_url);
        }
    }

    return {
        id: data.id,
        title: data.title,
        content: data.content,
        date: new Date(data.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }),
        author: data.author || "Faculty",
        author_role: data.author_profile?.role || "staff",
        type: data.type || "general",
        image_url: primaryImage,
        file_url: resolveFileUrl(data.file_url),
        file_name: data.file_name,
        attachments: (() => {
            const list = (data.announcement_attachments || []).map((att: any) => ({
                file_url: resolveFileUrl(att.file_url),
                file_name: att.file_name,
                file_type: att.file_type
            }));
            if (data.file_url) {
                const resolvedUrl = resolveFileUrl(data.file_url);
                const alreadyExists = list.some((att: any) => att.file_url === resolvedUrl);
                if (!alreadyExists) {
                    list.push({
                        file_url: resolvedUrl,
                        file_name: data.file_name || "Attached File",
                        file_type: data.file_type || (data.image_url ? "image/png" : "application/octet-stream")
                    });
                }
            }
            return list;
        })()
    };
}
