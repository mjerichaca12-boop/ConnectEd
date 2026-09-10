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
            section: 'Grade 9 - Section A',
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
            if (table === 'profiles') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle: vi.fn(() => Promise.resolve({
                                data: { id: 'student-123', section: 'Section A', year_level: 'Grade 9', role: 'student' },
                                error: null
                            }))
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

    it('should fallback to subject section if assignment has no section', async () => {
        const mockSubject = {
            id: 'sub-456',
            code: 'MATH10',
            name: 'Mathematics',
            description: 'Grade 10 Math',
            teacher_id: 'teacher-456',
            grade_level: 'Grade 10',
            section: 'Diamond',
            profiles: {
                first_name: 'Juan',
                last_name: 'Dela Cruz',
                email: 'juan@school.edu'
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
            if (table === 'profiles') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle: vi.fn(() => Promise.resolve({
                                data: { id: 'student-123', section: 'Diamond', year_level: 'Grade 10', role: 'student' },
                                error: null
                            }))
                        }))
                    }))
                };
            }
            if (table === 'teacher_student_assignments') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
                            }))
                        }))
                    }))
                };
            }
            return {};
        });

        const detail = await getSubjectDetail('sub-456');
        expect(detail).not.toBeNull();
        expect(detail?.section).toBe('Diamond');
        expect(detail?.grade_level).toBe('Grade 10');
    });

    it('should block access and return null if student section does not match subject section', async () => {
        const mockSubject = {
            id: 'sub-emerald',
            code: 'SCI7',
            name: 'Science Emerald',
            teacher_id: 't-1',
            grade_level: 'Grade 7',
            section: 'Emerald',
            profiles: { first_name: 'Teacher', last_name: 'One' }
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
            if (table === 'profiles') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle: vi.fn(() => Promise.resolve({
                                data: { id: 'student-123', section: 'Diamond', year_level: 'Grade 7', role: 'student' },
                                error: null
                            }))
                        }))
                    }))
                };
            }
            if (table === 'teacher_student_assignments') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
                            }))
                        }))
                    }))
                };
            }
            return {};
        });

        const detail = await getSubjectDetail('sub-emerald');
        expect(detail).toBeNull();
    });
});
