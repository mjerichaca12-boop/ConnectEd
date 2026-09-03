import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSubjectDetail } from '../get-subject-detail';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => ({
    supabase: {
        auth: {
            getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'student-123' } }, error: null })),
        },
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
                    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
                }))
            }))
        }))
    }
}));

describe('getSubjectDetail data service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should query subjects table and return mapped details with grade_level and schedule', async () => {
        const mockSubject = {
            id: 'sub-123',
            code: 'ENG9',
            name: 'English',
            description: 'Grade 9 English',
            teacher_id: 'teacher-123',
            grade_level: 'Grade 9',
            schedule: 'MWF',
            profiles: {
                first_name: 'Maria',
                last_name: 'Santos',
                email: 'maria@school.edu'
            }
        };

        const mockAssignment = {
            teacher_id: 'teacher-123',
            section: 'Grade 9 - Section A',
            profiles: {
                first_name: 'Maria',
                last_name: 'Santos',
                email: 'maria@school.edu'
            }
        };

        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'subjects') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: vi.fn(() => Promise.resolve({ data: mockSubject, error: null }))
                        }))
                    }))
                };
            }
            if (table === 'teacher_student_assignments') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                maybeSingle: vi.fn(() => Promise.resolve({ data: mockAssignment, error: null }))
                            }))
                        }))
                    }))
                };
            }
            return {};
        });

        const detail = await getSubjectDetail('sub-123');
        expect(detail).not.toBeNull();
        expect(detail?.grade_level).toBe('Grade 9');
        expect(detail?.schedule).toBe('MWF');
        expect(detail?.section).toBe('Grade 9 - Section A');
        expect(detail?.teacher_name).toBe('Maria Santos');
    });

    it('should return null if subject is not found', async () => {
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'subjects') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: vi.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST116' } }))
                        }))
                    }))
                };
            }
            return {};
        });

        const detail = await getSubjectDetail('non-existent');
        expect(detail).toBeNull();
    });
});
