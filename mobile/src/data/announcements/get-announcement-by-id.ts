import { supabase } from "../../lib/supabase";
import { Announcement } from "../../types";

/**
 * Resolves a Supabase storage path or external URL to a usable public URL
 */
function resolveImageUrl(path?: string, fallbackPath?: string): string | undefined {
    const target = path || fallbackPath;
    if (!target) return undefined;
    if (target.startsWith('http')) return target;
    
    // Only resolve as an image if it has an image extension
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

export async function getAnnouncementById(id: string): Promise<Announcement | null> {
    const { data, error } = await supabase
        .from('school_announcements')
        .select('*, author_profile:profiles!author_id(role)')
        .eq('id', id)
        .single();

    if (error || !data) {
        console.error('[announcements] Error fetching detail:', error);
        return null;
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
        image_url: resolveImageUrl(data.image_url, data.file_url),
        file_url: resolveFileUrl(data.file_url),
        file_name: data.file_name,
    };
}
