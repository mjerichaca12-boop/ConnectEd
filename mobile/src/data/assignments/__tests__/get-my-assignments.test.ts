import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMyAssignments } from '../get-my-assignments';
import { supabase } from '../../../lib/supabase';

// Helper to create a chainable query builder mock
const mockBuilder = (data: any = []) => {
    const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        in: vi.fn(() => builder),
        or: vi.fn(() => builder),
        then: vi.fn((resolve) => Promise.resolve({ data, error: null }).then(resolve)),
        catch: vi.fn()
    };
    return builder;
};

vi.mock('../../../lib/supabase', () => {
    return {
        supabase: {
            auth: {
                getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null })),
            },
            rpc: vi.fn(() => mockBuilder([])),
            from: vi.fn((table) => {
                if (table === 'enrollments') {
                    return mockBuilder([{ subject_id: 'sub-1' }]);
                }
                return mockBuilder([]);
            }),
        },
    };
});

describe('getMyAssignments scoping', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return empty array for invalid UUID provided as subjectId', async () => {
        const result = await getMyAssignments('invalid-id');
        expect(result).toHaveLength(0);
    });

    it('should filter by course_id for valid UUID', async () => {
        const validId = '550e8400-e29b-41d4-a716-446655440000';
        const rpcMock = mockBuilder([]);
        const mockEq = vi.spyOn(rpcMock, 'eq');
        
        (supabase as any).rpc = vi.fn(() => rpcMock);

        await getMyAssignments(validId);
        expect(mockEq).toHaveBeenCalledWith('course_id', validId);
    });

    it('should query submissions with student_id filter matching the authenticated user', async () => {
        const submissionsMock = mockBuilder([]);
        const mockEq = vi.spyOn(submissionsMock, 'eq');

        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'enrollments') {
                return mockBuilder([{ subject_id: 'sub-1' }]);
            }
            if (table === 'class_assignments') {
                return mockBuilder([{ id: 'assign-1', course_id: 'sub-1' }]);
            }
            if (table === 'teacher_assessment_submissions') {
                return submissionsMock;
            }
            return mockBuilder([]);
        });

        await getMyAssignments();
        expect(mockEq).toHaveBeenCalledWith('student_id', 'test-user');
    });

    it('should map status to submitted if submission exists', async () => {
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'enrollments') {
                return mockBuilder([{ subject_id: 'sub-1' }]);
            }
            if (table === 'teacher_assessment_submissions') {
                return mockBuilder([{ assessment_id: 'assign-1', file_url: null }]);
            }
            return mockBuilder([]);
        });

        (supabase as any).rpc = vi.fn(() => {
            return mockBuilder([{ id: 'assign-1', course_id: 'sub-1', due_date: '2099-12-31' }]);
        });

        const result = await getMyAssignments();
        expect(result).toHaveLength(1);
        expect(result[0].status).toBe('submitted');
    });

    it('should strictly isolate assignments and not include items from other subjects', async () => {
        const targetSubject = '550e8400-e29b-41d4-a716-446655440000';
        const otherSubject = '660e8400-e29b-41d4-a716-446655440000';

        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'enrollments') {
                return mockBuilder([{ subject_id: targetSubject }, { subject_id: otherSubject }]);
            }
            if (table === 'lessons') {
                return mockBuilder([
                    { id: 'lesson-target', subject_id: targetSubject, title: 'Target Lesson' },
                    { id: 'lesson-other', subject_id: otherSubject, title: 'Other Lesson' },
                ]);
            }
            if (table === 'assignments') {
                return mockBuilder([
                    { id: 'asg-target', lesson_id: 'lesson-target', title: 'Target Asg' },
                    { id: 'asg-other', lesson_id: 'lesson-other', title: 'Other Asg' },
                ]);
            }
            if (table === 'quizzes') {
                return mockBuilder([
                    { id: 'quiz-target', lesson_id: 'lesson-target', title: 'Target Quiz' },
                    { id: 'quiz-other', lesson_id: 'lesson-other', title: 'Other Quiz' },
                ]);
            }
            return mockBuilder([]);
        });

        (supabase as any).rpc = vi.fn(() => mockBuilder([]));

        const result = await getMyAssignments(targetSubject);
        expect(result).toHaveLength(2); // Only Target Asg and Target Quiz
        expect(result.map(a => a.id)).toEqual(expect.arrayContaining(['asg-target', 'quiz-target']));
        expect(result.map(a => a.id)).not.toContain('asg-other');
        expect(result.map(a => a.id)).not.toContain('quiz-other');
    });
});
