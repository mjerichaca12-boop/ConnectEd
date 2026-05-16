import { supabase } from "../../lib/supabase";
import { Material } from "../../types";

export interface GetMaterialsArgs {
    subjectId?: string;
    teacherId?: string;
}

export async function getMaterials({ subjectId, teacherId }: GetMaterialsArgs): Promise<Material[]> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidId = subjectId && uuidRegex.test(subjectId);

    console.log(`[materials] Fetching for ID: "${subjectId}", Valid: ${isValidId}`);

    let data: any[] = [];
    let error: any = null;

    if (isValidId) {
        const result = await supabase
            .from('class_materials')
            .select('*')
            .or(`subject_id.eq.${subjectId},subject_id.is.null`);
        data = result.data || [];
        error = result.error;
        console.log(`[materials] Subject-specific count: ${data.length}`);
    }

    // FALLBACK: If ID is invalid OR no materials found for this subject, 
    // fetch ALL materials so the user has something to show.
    if (!isValidId || (!error && data.length === 0)) {
        console.log('[materials] Running Global Fallback (fetch all)...');
        const fallback = await supabase
            .from('class_materials')
            .select('*')
            .limit(50);
        
        if (fallback.error) {
            console.error('[materials] Fallback Error:', fallback.error);
        } else if (fallback.data) {
            data = fallback.data;
            console.log(`[materials] Global Fallback count: ${data.length}`);
        }
    }
    
    if (error && isValidId) {
        console.error('[materials] Subject Fetch Error:', error);
    }

    const rawMaterials = data || [];

    // Sort by date (newest first)
    rawMaterials.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return rawMaterials.map(m => {
        let displayDate = "TBA";
        try {
            if (m.created_at) {
                displayDate = new Date(m.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                });
            }
        } catch (e) {
            console.warn('[materials] Date parsing failed:', e);
        }

        // Handle file_url which might be a JSON-encoded array string like ["https://..."]
        let finalUrl = m.file_url;
        if (typeof finalUrl === 'string' && finalUrl.startsWith('[') && finalUrl.endsWith(']')) {
            try {
                const parsed = JSON.parse(finalUrl);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    finalUrl = parsed[0];
                }
            } catch (e) {
                finalUrl = finalUrl.replace(/^\["|"\]$/g, '');
            }
        }

        return {
            id: m.id,
            title: m.title || "Untitled Document",
            type: m.type || "other",
            date: displayDate,
            file_url: finalUrl,
            subject_id: m.subject_id,
            description: m.description || "",
        };
    });
}
