import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAnnouncements } from '../get-announcements';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => ({
    supabase: {
        auth: {
            getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null })),
        },
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn(() => Promise.resolve({ data: { role: 'student', code: 'AP2026' }, error: null })),
                    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
                    order: vi.fn(() => Promise.resolve({ data: [], error: null })),
                })),
                order: vi.fn(() => ({
                    eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
                    or: vi.fn(() => Promise.resolve({ data: [], error: null })),
                    is: vi.fn(() => Promise.resolve({ data: [], error: null })),
                })),
            })),
        })),
    },
}));

describe('getAnnouncements scoping', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should query class_announcements when subjectId is provided', async () => {
        const subjectId = '550e8400-e29b-41d4-a716-446655440000';
        const mockEqClass = vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }));
        
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'profiles') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: vi.fn(() => Promise.resolve({ data: { role: 'student' }, error: null }))
                        }))
                    }))
                };
            }
            if (table === 'subjects') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: vi.fn(() => Promise.resolve({ data: { code: 'AP2026' }, error: null }))
                        }))
                    }))
                };
            }
            if (table === 'class_announcements') {
                return {
                    select: vi.fn(() => ({
                        eq: mockEqClass
                    }))
                };
            }
            return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        order: vi.fn(() => Promise.resolve({ data: [], error: null }))
                    }))
                }))
            };
        });

        await getAnnouncements({ subjectId });
        expect(mockEqClass).toHaveBeenCalledWith('class_id', subjectId);
    });

    it('should query school_announcements for global feed when NO subjectId is provided', async () => {
        const mockOrSchool = vi.fn(() => Promise.resolve({ data: [], error: null }));
        
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'profiles') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: vi.fn(() => Promise.resolve({ data: { role: 'student' }, error: null }))
                        }))
                    }))
                };
            }
            if (table === 'enrollments') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            in: vi.fn(() => Promise.resolve({ data: [{ subject_id: 'sub-1' }], error: null }))
                        }))
                    }))
                };
            }
            if (table === 'school_announcements') {
                return {
                    select: vi.fn(() => ({
                        or: mockOrSchool
                    }))
                };
            }
            return {
                select: vi.fn(() => ({
                    in: vi.fn(() => Promise.resolve({ data: [], error: null })),
                    limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
                }))
            };
        });

        await getAnnouncements({});
        expect(mockOrSchool).toHaveBeenCalled();
    });

    it('should return empty array when subjectId is provided but invalid', async () => {
        const result = await getAnnouncements({ subjectId: 'invalid-id' });
        expect(result).toEqual([]);
    });
});
