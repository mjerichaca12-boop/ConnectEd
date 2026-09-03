import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getMyAssignments } from '../../../data/assignments/get-my-assignments';
import { supabase } from '../../../lib/supabase';

export function useMyAssignmentsQuery(filters?: { subjectId?: string }) {
    const queryClient = useQueryClient();
    const subjectId = filters?.subjectId;

    useEffect(() => {
        const channelName = subjectId ? `assignments-rt-${subjectId}` : 'assignments-rt-global';

        const invalidate = () => {
            queryClient.invalidateQueries({ queryKey: ['my-assignments', subjectId] });
        };

        const channel = supabase
            .channel(channelName)
            // Listen for changes/deletes on assignments table
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'assignments' },
                invalidate
            )
            // Listen for changes/deletes on quizzes table
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'quizzes' },
                invalidate
            )
            // Listen for changes/deletes on lesson_activities table
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'lesson_activities' },
                invalidate
            )
            // Listen for changes/deletes on lessons table
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'lessons' },
                invalidate
            )
            // Listen for changes/deletes on teacher_assessments table
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'teacher_assessments' },
                invalidate
            )
            // Listen for changes/deletes on class_assignments table
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'class_assignments' },
                invalidate
            )
            // Listen for new/updated assignments_activity
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'assignments_activity' },
                invalidate
            )
            // Listen for grade changes (teacher grades a submission)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'teacher_assessment_grades' },
                invalidate
            )
            // Listen for submission status changes
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'teacher_assessment_submissions' },
                invalidate
            )
            // Listen for direct submission changes
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'submissions' },
                invalidate
            )
            // Listen for quiz attempt changes
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'quiz_attempts' },
                invalidate
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, subjectId]);

    const isSubjectIntent = 'subjectId' in (filters || {});
    const isSubjectReady = !!(subjectId && subjectId !== 'undefined' && subjectId !== '[id]');
    const isGlobalIntent = !isSubjectIntent;
    const isEnabled = isGlobalIntent || isSubjectReady;

    return useQuery({
        queryKey: ['my-assignments', subjectId],
        queryFn: () => getMyAssignments(subjectId),
        enabled: isEnabled,
        refetchOnMount: true,
        staleTime: 0,
    });
}
