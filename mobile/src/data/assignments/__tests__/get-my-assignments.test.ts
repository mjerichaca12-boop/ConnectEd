import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMyAssignments } from '../get-my-assignments';
import { supabase } from '../../../lib/supabase';
import * as getMyEnrollmentsModule from '../../enrollments/get-my-enrollments';

// Helper to create a chainable query builder mock
const mockBuilder = (data: any = []) => {
    const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        in: vi.fn(() => builder),
        or: vi.fn(() => builder),
        maybeSingle: vi.fn(() => Promise.resolve({ data: data[0] || null, error: null })),
        single: vi.fn(() => Promise.resolve({ data: data[0] || null, error: null })),
        then: vi.fn((resolve) => Promise.resolve({ data, error: null }).then(resolve)),
        catch: vi.fn()
    };
    return builder;
};

vi.mock('../../../lib/supabase', () => {
    return {
        supabase: {
            auth: {
                getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user', user_metadata: { role: 'student' } } }, error: null })),
            },
            rpc: vi.fn(() => mockBuilder([])),
            from: vi.fn((table) => {
                if (table === 'profiles') {
                    return mockBuilder([{ id: 'test-user', section: 'Diamond', year_level: 'Grade 7', role: 'student' }]);
                }
                if (table === 'enrollments') {
                    return mockBuilder([{ subject_id: 'sub-1' }]);
                }
                return mockBuilder([]);
            }),
        },
    };
});

describe('getMyAssignments scoping & ghost task prevention', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(getMyEnrollmentsModule, 'getMyEnrollments').mockResolvedValue([
            {
                id: 'en-1',
                student_id: 'test-user',
                subject_id: 'sub-1',
                status: 'accepted',
                section: 'Diamond',
                subjects: {
                    id: 'sub-1',
                    code: 'SUB1',
                    name: 'Subject 1',
                    teacher_id: 't-1',
                    section: 'Diamond',
                    grade_level: 'Grade 7'
                }
            }
        ] as any);
    });

    it('should return empty array for invalid UUID provided as subjectId', async () => {
        const result = await getMyAssignments('invalid-id');
        expect(result).toHaveLength(0);
    });

    it('should filter by course_id for valid UUID when student is enrolled', async () => {
        const validId = '550e8400-e29b-41d4-a716-446655440000';
        vi.spyOn(getMyEnrollmentsModule, 'getMyEnrollments').mockResolvedValue([
            {
                id: 'en-valid',
                student_id: 'test-user',
                subject_id: validId,
                status: 'accepted',
                section: 'Diamond',
                subjects: { id: validId, code: 'VAL', name: 'Valid Subject', teacher_id: 't-1', section: 'Diamond' }
            }
        ] as any);

        const rpcMock = mockBuilder([]);
        const mockEq = vi.spyOn(rpcMock, 'eq');
        (supabase as any).rpc = vi.fn(() => rpcMock);

        await getMyAssignments(validId);
        expect(mockEq).toHaveBeenCalledWith('course_id', validId);
    });

    it('should block access and return empty array if student is not enrolled in the requested valid subject', async () => {
        const validId = '550e8400-e29b-41d4-a716-446655440000';
        // Enrolled only in sub-1, not validId
        const result = await getMyAssignments(validId);
        expect(result).toHaveLength(0);
    });

    it('should query submissions with student_id filter matching the authenticated user', async () => {
        const submissionsMock = mockBuilder([]);
        const mockEq = vi.spyOn(submissionsMock, 'eq');

        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'profiles') {
                return mockBuilder([{ id: 'test-user', section: 'Diamond', year_level: 'Grade 7', role: 'student' }]);
            }
            if (table === 'class_assignments') {
                return mockBuilder([{ id: 'assign-1', course_id: 'sub-1', status: 'published' }]);
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
            if (table === 'profiles') {
                return mockBuilder([{ id: 'test-user', section: 'Diamond', year_level: 'Grade 7', role: 'student' }]);
            }
            if (table === 'teacher_assessment_submissions') {
                return mockBuilder([{ assessment_id: 'assign-1', file_url: null }]);
            }
            return mockBuilder([]);
        });

        (supabase as any).rpc = vi.fn(() => {
            return mockBuilder([{ id: 'assign-1', course_id: 'sub-1', due_date: '2099-12-31', status: 'published' }]);
        });

        const result = await getMyAssignments();
        expect(result).toHaveLength(1);
        expect(result[0].status).toBe('submitted');
    });

    it('should strictly isolate assignments and not include items from other subjects', async () => {
        const targetSubject = '550e8400-e29b-41d4-a716-446655440000';
        const otherSubject = '660e8400-e29b-41d4-a716-446655440000';

        vi.spyOn(getMyEnrollmentsModule, 'getMyEnrollments').mockResolvedValue([
            {
                id: 'en-t',
                student_id: 'test-user',
                subject_id: targetSubject,
                status: 'accepted',
                section: 'Diamond',
                subjects: { id: targetSubject, code: 'TAR', name: 'Target', teacher_id: 't-1', section: 'Diamond' }
            }
        ] as any);

        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'profiles') {
                return mockBuilder([{ id: 'test-user', section: 'Diamond', year_level: 'Grade 7', role: 'student' }]);
            }
            if (table === 'lessons') {
                return mockBuilder([
                    { id: 'lesson-target', subject_id: targetSubject, title: 'Target Lesson', status: 'published' },
                    { id: 'lesson-other', subject_id: otherSubject, title: 'Other Lesson', status: 'published' },
                ]);
            }
            if (table === 'assignments') {
                return mockBuilder([
                    { id: 'asg-target', lesson_id: 'lesson-target', title: 'Target Asg', status: 'published' },
                    { id: 'asg-other', lesson_id: 'lesson-other', title: 'Other Asg', status: 'published' },
                ]);
            }
            if (table === 'quizzes') {
                return mockBuilder([
                    { id: 'quiz-target', lesson_id: 'lesson-target', title: 'Target Quiz', status: 'published' },
                    { id: 'quiz-other', lesson_id: 'lesson-other', title: 'Other Quiz', status: 'published' },
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

    it('should exclude draft/unpublished tasks and lessons for student users', async () => {
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'profiles') {
                return mockBuilder([{ id: 'test-user', section: 'Diamond', year_level: 'Grade 7', role: 'student' }]);
            }
            if (table === 'lessons') {
                return mockBuilder([
                    { id: 'lesson-pub', subject_id: 'sub-1', title: 'Pub Lesson', status: 'published' },
                    { id: 'lesson-draft', subject_id: 'sub-1', title: 'Draft Lesson', status: 'draft' },
                ]);
            }
            if (table === 'assignments') {
                return mockBuilder([
                    { id: 'asg-pub', lesson_id: 'lesson-pub', title: 'Pub Asg', status: 'published' },
                    { id: 'asg-draft', lesson_id: 'lesson-draft', title: 'Draft Asg', status: 'draft' },
                ]);
            }
            if (table === 'quizzes') {
                return mockBuilder([
                    { id: 'quiz-pub', lesson_id: 'lesson-pub', title: 'Pub Quiz', status: 'published' },
                    { id: 'quiz-draft', lesson_id: 'lesson-draft', title: 'Draft Quiz', status: 'draft' },
                ]);
            }
            return mockBuilder([]);
        });

        (supabase as any).rpc = vi.fn(() => mockBuilder([]));

        const result = await getMyAssignments();
        expect(result).toHaveLength(2); // Only asg-pub and quiz-pub
        expect(result.map(a => a.id)).toEqual(expect.arrayContaining(['asg-pub', 'quiz-pub']));
        expect(result.map(a => a.id)).not.toContain('asg-draft');
        expect(result.map(a => a.id)).not.toContain('quiz-draft');
    });

    it('should resolve quizzes linked through lesson_activities and classify them as quiz type', async () => {
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'profiles') {
                return mockBuilder([{ id: 'test-user', section: 'Diamond', year_level: 'Grade 7', role: 'student' }]);
            }
            if (table === 'lessons') {
                return mockBuilder([
                    { id: 'lesson-1', subject_id: 'sub-1', title: 'Week 1 Lesson', status: 'published' },
                ]);
            }
            if (table === 'lesson_activities') {
                return mockBuilder([
                    { id: 'la-1', lesson_id: 'lesson-1', activity_type: 'Quiz', activity_id: 'quiz-act-1' }
                ]);
            }
            if (table === 'quizzes') {
                return mockBuilder([
                    { id: 'quiz-act-1', lesson_id: null, title: 'Periodic Quiz', status: 'published', total_points: 20 }
                ]);
            }
            return mockBuilder([]);
        });

        (supabase as any).rpc = vi.fn(() => mockBuilder([]));

        const result = await getMyAssignments();
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('quiz-act-1');
        expect(result[0].assessment_type).toBe('quiz');
        expect(result[0].subjectId).toBe('sub-1');
    });

    it('should sort pending tasks by soonest deadline first', async () => {
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'profiles') {
                return mockBuilder([{ id: 'test-user', section: 'Diamond', year_level: 'Grade 7', role: 'student' }]);
            }
            if (table === 'lessons') {
                return mockBuilder([
                    { id: 'lesson-1', subject_id: 'sub-1', title: 'Lesson 1', status: 'published' },
                ]);
            }
            if (table === 'quizzes') {
                return mockBuilder([
                    { id: 'quiz-later', lesson_id: 'lesson-1', title: 'Quiz Later', due_date: '2099-10-15', status: 'published' },
                    { id: 'quiz-sooner', lesson_id: 'lesson-1', title: 'Quiz Sooner', due_date: '2099-09-20', status: 'published' },
                ]);
            }
            return mockBuilder([]);
        });

        (supabase as any).rpc = vi.fn(() => mockBuilder([]));

        const result = await getMyAssignments();
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('quiz-sooner');
        expect(result[1].id).toBe('quiz-later');
    });
});


