import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Alert } from 'react-native';
import { serializeDepEdComputation } from '../../../lib/deped-grading';

export interface UpdateGradesArgs {
    enrollmentId: string;
    studentId?: string;
    grades: Record<string, any>;
    subjectCategory?: string;
}

export function useUpdateGradesMutation(subjectId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ enrollmentId, studentId, grades, subjectCategory }: UpdateGradesArgs) => {
            const { data: userData } = await supabase.auth.getUser();
            const teacherId = userData?.user?.id;

            // 1. If studentId and teacherId are known, upsert to teacher_student_grades
            if (teacherId && studentId && subjectId) {
                try {
                    const gradeComputation = grades.gradeComputation
                        ? (typeof grades.gradeComputation === 'string'
                            ? grades.gradeComputation
                            : serializeDepEdComputation(grades.gradeComputation))
                        : null;

                    await supabase
                        .from('teacher_student_grades')
                        .upsert({
                            teacher_id: teacherId,
                            subject_id: subjectId,
                            student_id: studentId,
                            quarter1_grade: Number(grades.q1 || 0),
                            quarter2_grade: Number(grades.q2 || 0),
                            quarter3_grade: Number(grades.q3 || 0),
                            quarter4_grade: Number(grades.q4 || 0),
                            overall_grade: Number(grades.overall || 0),
                            quiz_average: Number(grades.quizAverage || 0),
                            activity_grade: Number(grades.activityGrade || 0),
                            assignment_grade: Number(grades.assignmentGrade || 0),
                            exam_grade: Number(grades.examGrade || 0),
                            grade_computation: gradeComputation ? JSON.parse(gradeComputation) : {},
                            subject_category: subjectCategory || grades.subjectCategory || 'Languages / AP / EsP',
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'teacher_id,subject_id,student_id' });
                } catch (err) {
                    console.warn('[useUpdateGradesMutation] Warning updating teacher_student_grades:', err);
                }
            }

            // 2. Update enrollments / teacher_student_assignments
            const { data, error } = await supabase
                .from('enrollments')
                .update({ grade: grades })
                .eq('id', enrollmentId)
                .select()
                .single();
                
            if (error) {
                const { data: tData, error: tError } = await supabase
                    .from('teacher_student_assignments')
                    .update({ grades })
                    .eq('id', enrollmentId)
                    .select()
                    .single();
                
                if (tError) throw tError;
                return tData;
            }

            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['class-students', subjectId] });
            queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
            queryClient.invalidateQueries({ queryKey: ['teacher-subjects'] });
        },
        onError: (error) => {
            console.error("Failed to update grades:", error);
            Alert.alert("Error", "Failed to save grades. Please try again.");
        }
    });
}
