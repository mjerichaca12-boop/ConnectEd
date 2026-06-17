import { supabase } from "../../lib/supabase";

export interface AttendanceRecord {
    id: string;
    date: string;
    status: string;
    subject_id: string;
    subject_name: string;
    subject_code: string;
    remarks: string;
}

/**
 * Fetches attendance records for a student, scoped ONLY to subjects the student is actively enrolled in.
 * 
 * @param studentId The unique user ID of the student
 * @returns Promise resolving to an array of mapped attendance records
 */
export async function getStudentAttendance(studentId: string): Promise<AttendanceRecord[]> {
    if (!studentId) throw new Error("Student ID is required.");

    // 1. Fetch student's enrolled subjects from active assignments
    const { data: enrollments, error: enrollError } = await supabase
        .from('teacher_student_assignments')
        .select('subject_id, status')
        .eq('student_id', studentId);

    if (enrollError) throw enrollError;

    const enrolledSubjectIds = (enrollments || [])
        .filter(e => e.status?.toLowerCase() === 'accepted' || e.status?.toLowerCase() === 'active')
        .map(e => e.subject_id)
        .filter(Boolean);

    if (enrolledSubjectIds.length === 0) {
        return [];
    }

    // 2. Fetch attendance records ONLY for enrolled subjects
    const { data: attendance, error: attendanceError } = await supabase
        .from('teacher_student_attendance')
        .select('*')
        .eq('student_id', studentId)
        .in('subject_id', enrolledSubjectIds)
        .order('attendance_date', { ascending: false });

    if (attendanceError) throw attendanceError;

    if (!attendance || attendance.length === 0) {
        return [];
    }

    // 3. Fetch subject details for each record
    const subjectIds = [...new Set(attendance.map(a => a.subject_id))];
    const { data: subjects, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name, code')
        .in('id', subjectIds);

    if (subjectsError) throw subjectsError;

    const subjectMap = new Map(subjects?.map(s => [s.id, s]));

    // 4. Map records
    return attendance.map(a => {
        const subject = subjectMap.get(a.subject_id);
        return {
            id: String(a.id),
            date: new Date(a.attendance_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }),
            status: a.attendance_status || 'Unmarked',
            subject_id: a.subject_id,
            subject_name: subject?.name || 'Unknown Subject',
            subject_code: subject?.code || 'N/A',
            remarks: a.remarks || ''
        };
    });
}
