import { supabase } from "../../lib/supabase";
import { Material } from "../../types";

export interface GetMaterialsArgs {
    subjectId?: string;
    teacherId?: string;
    allowFallback?: boolean;
}

export async function getMaterials({ subjectId, teacherId, allowFallback = true }: GetMaterialsArgs): Promise<Material[]> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidId = !!(subjectId && uuidRegex.test(subjectId));

    const isSubjectExplicit = subjectId && subjectId !== 'undefined' && subjectId !== '[id]';

    if (isSubjectExplicit && !isValidId) {
        console.warn(`[materials] Invalid subjectId provided: ${subjectId}`);
        return [];
    }

    console.log(`[materials] Fetching for ID: "${subjectId}", Valid: ${isValidId}, Fallback: ${allowFallback}`);

    let materialsList: any[] = [];
    let lessonsList: any[] = [];

    if (isValidId) {
        // 1. Fetch all lessons for this subject
        try {
            const lessonsQuery = supabase.from('lessons');
            if (lessonsQuery && typeof lessonsQuery.select === 'function') {
                const { data: lessonsData } = await lessonsQuery
                    .select('*')
                    .eq('subject_id', subjectId)
                    .order('week_number', { ascending: true })
                    .order('created_at', { ascending: true });

                if (lessonsData) {
                    lessonsList = lessonsData;
                }
            }
        } catch (e) {
            console.warn('[materials] lessons fetch info:', e);
        }

        // 2. Fetch all lesson materials for this subject
        try {
            const matQuery = supabase.from('lesson_materials');
            if (matQuery && typeof matQuery.select === 'function') {
                const { data: matData } = await matQuery
                    .select('*, lessons!inner(id, subject_id, teacher_id, week_number, title, topic, description, objectives, start_date, end_date, status)')
                    .eq('lessons.subject_id', subjectId);

                if (matData) {
                    materialsList = matData;
                }
            }
        } catch (e) {
            console.warn('[materials] lesson_materials fetch info:', e);
        }
        console.log(`[materials] Subject-specific count: ${materialsList.length}, Lessons: ${lessonsList.length}`);
    } else if (teacherId) {
        try {
            const lessonsQuery = supabase.from('lessons');
            if (lessonsQuery && typeof lessonsQuery.select === 'function') {
                const { data: lessonsData } = await lessonsQuery
                    .select('*')
                    .eq('teacher_id', teacherId)
                    .order('week_number', { ascending: true });

                if (lessonsData) {
                    lessonsList = lessonsData;
                }
            }
        } catch (e) {
            console.warn('[materials] lessons fetch info:', e);
        }

        try {
            const matQuery = supabase.from('lesson_materials');
            if (matQuery && typeof matQuery.select === 'function') {
                const { data: matData } = await matQuery
                    .select('*, lessons!inner(id, subject_id, teacher_id, week_number, title, topic, description, objectives, start_date, end_date, status)')
                    .eq('lessons.teacher_id', teacherId);

                if (matData) {
                    materialsList = matData;
                }
            }
        } catch (e) {
            console.warn('[materials] lesson_materials fetch info:', e);
        }
        console.log(`[materials] Teacher-specific count: ${materialsList.length}, Lessons: ${lessonsList.length}`);
    }

    // Automatically disable fallback if a specific subject was requested, to prevent global leaks
    const effectiveAllowFallback = allowFallback && !isSubjectExplicit;

    // FALLBACK: Only run if allowed AND no materials found
    if (effectiveAllowFallback && (materialsList.length === 0 && lessonsList.length === 0)) {
        console.log('[materials] Running Global Fallback (fetch all)...');
        const fallback = await supabase
            .from('lesson_materials')
            .select('*, lessons(id, subject_id, teacher_id, week_number, title, topic, description, objectives, start_date, end_date, status)')
            .limit(50);
        
        if (fallback.data) {
            materialsList = fallback.data;
            console.log(`[materials] Global Fallback count: ${materialsList.length}`);
        }
    }

    const lessonMap = new Map<string, any>();
    lessonsList.forEach(l => {
        if (l && l.id) lessonMap.set(l.id, l);
    });

    const results: Material[] = [];
    const processedLessonIdsWithMaterials = new Set<string>();

    materialsList.forEach((m: any) => {
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

        const lessonObj = (m.lessons as any) || (m.lesson_id ? lessonMap.get(m.lesson_id) : null) || {};
        const effectiveSubjectId = lessonObj?.subject_id || m.subject_id || subjectId || '';
        const weekNum = lessonObj?.week_number !== undefined && lessonObj?.week_number !== null ? lessonObj.week_number : (m.week_number || null);

        if (lessonObj?.id) {
            processedLessonIdsWithMaterials.add(lessonObj.id);
        }

        let type: "pdf" | "doc" | "other" = "other";
        const fileType = (m.file_type || "").toLowerCase();
        const fileName = (m.file_name || "").toLowerCase();
        if (fileType.includes("pdf") || fileName.endsWith(".pdf")) {
            type = "pdf";
        } else if (
            fileType.includes("word") ||
            fileType.includes("document") ||
            fileName.endsWith(".doc") ||
            fileName.endsWith(".docx")
        ) {
            type = "doc";
        }

        results.push({
            id: m.id,
            title: m.file_name || "Untitled Document",
            type,
            date: displayDate,
            file_url: finalUrl,
            subject_id: effectiveSubjectId,
            description: m.description || "",
            created_at: m.created_at,
            week_number: weekNum,
            lesson_id: lessonObj?.id || m.lesson_id,
            lesson_title: lessonObj?.title || "",
            lesson_topic: lessonObj?.topic || "",
            lesson_description: lessonObj?.description || "",
            lesson_objectives: lessonObj?.objectives || "",
            lesson_status: lessonObj?.status || "Published",
            lesson_start_date: lessonObj?.start_date || null,
            lesson_end_date: lessonObj?.end_date || null,
            is_placeholder: false
        });
    });

    // Also include lessons that do not have files attached yet, so the Overview Card & Week appear
    lessonsList.forEach(l => {
        if (l && l.id && !processedLessonIdsWithMaterials.has(l.id)) {
            let displayDate = "TBA";
            try {
                if (l.created_at) {
                    displayDate = new Date(l.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                    });
                }
            } catch (e) {}

            results.push({
                id: `lesson-${l.id}`,
                title: l.title || `Week ${l.week_number || 1} Lesson`,
                type: "other",
                date: displayDate,
                file_url: undefined,
                subject_id: l.subject_id || subjectId || '',
                description: l.description || "",
                created_at: l.created_at,
                week_number: l.week_number !== undefined && l.week_number !== null ? l.week_number : 1,
                lesson_id: l.id,
                lesson_title: l.title || "",
                lesson_topic: l.topic || "",
                lesson_description: l.description || "",
                lesson_objectives: l.objectives || "",
                lesson_status: l.status || "Published",
                lesson_start_date: l.start_date || null,
                lesson_end_date: l.end_date || null,
                is_placeholder: true
            });
        }
    });

    // Sort by created date
    results.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return results;
}
