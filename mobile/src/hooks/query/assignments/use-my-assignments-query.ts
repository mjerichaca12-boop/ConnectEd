import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getMyAssignments } from '../../../data/assignments/get-my-assignments';
import { supabase } from '../../../lib/supabase';

export function useMyAssignmentsQuery(filters?: { subjectId?: string }) {
    const queryClient = useQueryClient();
    const subjectId = filters?.subjectId;

    useEffect(() => {
        const channelName = subjectId ? `assignments-rt-${subjectId}-${Date.now()}` : `assignments-rt-global-${Date.now()}`;

        const invalidate = () => {
            queryClient.invalidateQueries({ queryKey: ['my-assignments'] });
            queryClient.invalidateQueries({ queryKey: ['task-summary'] });
            queryClient.invalidateQueries({ queryKey: ['materials'] });
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
            // Listen for changes on quiz questions
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'quiz_questions' },
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
            // Listen for changes on lesson materials
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'lesson_materials' },
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
            // Listen for teacher feedback comments
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'submission_feedback' },
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
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isSubjectReady = !!(subjectId && uuidRegex.test(subjectId));
    const isGlobalIntent = !isSubjectIntent;
    const isEnabled = isGlobalIntent || isSubjectReady;

    return useQuery({
        queryKey: ['my-assignments', subjectId],
        queryFn: () => getMyAssignments(subjectId),
        enabled: isEnabled,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchInterval: 3000,
        staleTime: 0,
    });
}
