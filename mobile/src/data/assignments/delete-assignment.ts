import { supabase } from '../../lib/supabase';

export interface DeleteAssignmentOptions {
    filePaths?: string[];
    fileUrls?: string[];
}

export async function deleteAssignment(
    assignmentId: string, 
    options?: DeleteAssignmentOptions
): Promise<void> {
    if (!assignmentId) {
        throw new Error("Assignment ID is required for deletion");
    }

    const id = String(assignmentId).trim();

    // 1. Delete dependent child records first to avoid foreign key violations:
    // a. Lesson activities junction table
    await supabase.from('lesson_activities').delete().eq('activity_id', id);
    await supabase.from('lesson_activities').delete().eq('id', id);

    // b. Quiz questions and attempts if this was a quiz
    await supabase.from('quiz_questions').delete().eq('quiz_id', id);
    await supabase.from('quiz_attempts').delete().eq('quiz_id', id);

    // c. Student assessment grades and submissions
    await supabase.from('teacher_assessment_grades').delete().eq('assessment_id', id);
    await supabase.from('teacher_assessment_submissions').delete().eq('assessment_id', id);

    // 2. Delete from parent assignment/quiz tables
    const results = await Promise.allSettled([
        supabase.from('assignments').delete().eq('id', id),
        supabase.from('assignments_activity').delete().eq('id', id),
        supabase.from('quizzes').delete().eq('id', id),
        supabase.from('class_assignments').delete().eq('id', id),
    ]);

    // Check if any error occurred in parent table deletes
    const errors: any[] = [];
    results.forEach((res) => {
        if (res.status === 'fulfilled' && res.value.error) {
            // Ignore 404 or missing table errors, but log others
            const code = res.value.error.code;
            if (code !== 'PGRST116' && code !== 'PGRST205') {
                errors.push(res.value.error);
            }
        } else if (res.status === 'rejected') {
            errors.push(res.reason);
        }
    });

    // 3. Remove files from storage if provided
    try {
        const pathsToRemove: string[] = [];
        if (options?.filePaths && options.filePaths.length > 0) {
            pathsToRemove.push(...options.filePaths);
        }
        if (options?.fileUrls && options.fileUrls.length > 0) {
            options.fileUrls.forEach((url) => {
                if (typeof url === 'string' && url.includes('class-materials/')) {
                    const clean = url.split('class-materials/')[1]?.split('?')[0];
                    if (clean) pathsToRemove.push(clean);
                }
            });
        }
        if (pathsToRemove.length > 0) {
            const unique = [...new Set(pathsToRemove)];
            await supabase.storage.from('class-materials').remove(unique);
        }
    } catch (storageErr) {
        console.warn("[deleteAssignment] Storage file cleanup warning:", storageErr);
    }
}
