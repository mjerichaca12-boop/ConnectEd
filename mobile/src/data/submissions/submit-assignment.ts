import { supabase } from "../../lib/supabase";

export interface SubmitAssignmentParams {
    assignmentId: string;
    studentId: string;
    fileObject: any;
    fileName: string;
    comments?: string;
    classCode?: string;
    teacherId?: string;
    subjectId?: string;
}

/**
 * Uploads a file to Supabase storage and upserts rows in the 'submissions' and
 * 'teacher_assessment_submissions' tables to complete an assignment submission.
 * 
 * @param params Object containing assignment, student, file info and comments
 * @returns Promise resolving to an object with success indicator and publicUrl
 */
export async function submitAssignment(params: SubmitAssignmentParams) {
    const {
        assignmentId,
        studentId,
        fileObject,
        fileName,
        comments = "",
        classCode = "",
        teacherId: initialTeacherId,
        subjectId: initialSubjectId
    } = params;

    if (!assignmentId || !studentId || !fileObject || !fileName) {
        throw new Error("Missing required parameters: assignmentId, studentId, fileObject, and fileName are mandatory.");
    }

    // 1. Upload file to Supabase storage
    const storagePath = `submissions/${studentId}/${Date.now()}_${fileName}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from("class-materials")
        .upload(storagePath, fileObject, {
            cacheControl: "3600",
            upsert: true
        });

    if (uploadError) throw uploadError;

    // 2. Retrieve public URL
    const { data: urlData } = supabase.storage
        .from("class-materials")
        .getPublicUrl(storagePath);
    const publicUrl = urlData?.publicUrl || "";

    if (!publicUrl) throw new Error("Failed to retrieve public file URL.");

    // 3. Upsert into submissions table
    const { error: subError } = await supabase
        .from("submissions")
        .upsert({
            assignment_id: assignmentId,
            user_id: studentId,
            file_url: publicUrl
        }, { onConflict: "assignment_id,user_id" });

    if (subError) throw subError;

    // 4. Fetch teacher_id and subject_id from subjects if not provided
    let teacherId = initialTeacherId;
    let subjectId = initialSubjectId;

    if ((!teacherId || !subjectId) && classCode) {
        const { data: subjectData } = await supabase
            .from("subjects")
            .select("id, teacher_id")
            .eq("code", classCode)
            .limit(1)
            .maybeSingle();
        
        if (subjectData) {
            teacherId = subjectData.teacher_id;
            subjectId = subjectData.id;
        }
    }

    // 5. Upsert into teacher_assessment_submissions
    if (teacherId && subjectId) {
        const { error: teacherSubError } = await supabase
            .from("teacher_assessment_submissions")
            .upsert({
                teacher_id: teacherId,
                subject_id: subjectId,
                assessment_id: assignmentId,
                student_id: studentId,
                response_text: comments.trim() || "Submitted via Web Dashboard",
                file_url: publicUrl,
                file_name: fileName,
                file_path: storagePath,
                status: "submitted"
            }, { onConflict: "teacher_id,subject_id,assessment_id,student_id" });
        
        if (teacherSubError) {
            throw teacherSubError;
        }
    }

    return {
        success: true,
        publicUrl,
        storagePath
    };
}
