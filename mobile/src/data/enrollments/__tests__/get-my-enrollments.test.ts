import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMyEnrollments } from '../get-my-enrollments';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => ({
    supabase: {
        auth: {
            getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-student-123' } }, error: null })),
        },
        from: vi.fn((table) => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({
                    data: [
                        {
                            id: 123,
                            student_id: 'test-student-123',
                            subject_id: 'sub-1',
                            status: 'active',
                            section: 'Grade 9',
                            grades: { exam: 95 },
                            attendance: { present: 10 },
                            subjects: {
                                id: 'sub-1',
                                code: 'ENG9',
                                name: 'English',
                                description: 'Basic English Course',
                                teacher_id: 'teacher-1',
                                grade_level: 'Grade 9'
                            }
                        }
                    ],
                    error: null
                }))
            }))
        }))
    }
}));

describe('getMyEnrollments data service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should throw error if user is not authenticated', async () => {
        (supabase.auth.getUser as any).mockImplementationOnce(() => 
            Promise.resolve({ data: { user: null }, error: new Error('Session invalid') })
        );
        await expect(getMyEnrollments()).rejects.toThrow('Not authenticated');
    });

    it('should query teacher_student_assignments table with student_id filter', async () => {
        const mockEq = vi.fn(() => Promise.resolve({ data: [], error: null }));
        const mockSelect = vi.fn(() => ({ eq: mockEq }));
        
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'teacher_student_assignments') {
                return { select: mockSelect };
            }
            return {};
        });

        await getMyEnrollments();
        expect(supabase.from).toHaveBeenCalledWith('teacher_student_assignments');
        expect(mockEq).toHaveBeenCalledWith('student_id', 'test-student-123');
    });

    it('should return mapped enrollment with section and subjects grade_level', async () => {
        (supabase.auth.getUser as any).mockImplementationOnce(() => 
            Promise.resolve({ data: { user: { id: 'test-student-123' } }, error: null })
        );
        
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'teacher_student_assignments') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => Promise.resolve({
                            data: [
                                {
                                    id: 123,
                                    student_id: 'test-student-123',
                                    subject_id: 'sub-1',
                                    status: 'active',
                                    section: 'Grade 9',
                                    grades: { exam: 95 },
                                    attendance: { present: 10 },
                                    subjects: {
                                        id: 'sub-1',
                                        code: 'ENG9',
                                        name: 'English',
                                        description: 'Basic English Course',
                                        teacher_id: 'teacher-1',
                                        grade_level: 'Grade 9'
                                    }
                                }
                            ],
                            error: null
                        }))
                    }))
                };
            }
            return {};
        });

        const enrollments = await getMyEnrollments();
        expect(enrollments).toHaveLength(1);
        expect(enrollments[0].section).toBe('Grade 9');
        expect(enrollments[0].subjects.grade_level).toBe('Grade 9');
        expect(enrollments[0].status).toBe('accepted');
        expect(enrollments[0].grade).toEqual({ exam: 95 });
        expect(enrollments[0].attendance).toEqual({ present: 10 });
    });
});
