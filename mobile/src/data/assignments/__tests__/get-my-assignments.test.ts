import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMyAssignments } from '../get-my-assignments';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => ({
    supabase: {
        auth: {
            getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null })),
        },
        rpc: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
            in: vi.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        from: vi.fn((table) => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    in: vi.fn(() => Promise.resolve({ data: [{ subject_id: 'sub-1' }], error: null })),
                })),
                in: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
        })),
    },
}));

describe('getMyAssignments scoping', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return empty array for invalid UUID provided as subjectId', async () => {
        const result = await getMyAssignments('invalid-id');
        expect(result).toHaveLength(0);
        // Should not reach the assignments_activity table query
    });

    it('should filter by course_id for valid UUID', async () => {
        const validId = '550e8400-e29b-41d4-a716-446655440000';
        const mockEq = vi.fn(() => Promise.resolve({ data: [], error: null }));
        
        (supabase as any).rpc = vi.fn(() => ({
            eq: mockEq
        }));

        await getMyAssignments(validId);
        expect(mockEq).toHaveBeenCalledWith('course_id', validId);
    });

    it('should query submissions with user_id filter matching the authenticated user', async () => {
        const mockEq = vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }));
        
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'enrollments') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            in: vi.fn(() => Promise.resolve({ data: [{ subject_id: 'sub-1' }], error: null }))
                        }))
                    }))
                };
            }
            if (table === 'submissions') {
                return {
                    select: vi.fn(() => ({
                        eq: mockEq
                    }))
                };
            }
            return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        in: vi.fn(() => Promise.resolve({ data: [], error: null }))
                    })),
                    in: vi.fn(() => Promise.resolve({ data: [], error: null }))
                }))
            };
        });

        const mockRpc = vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ data: [{ id: 'assign-1', course_id: 'sub-1' }], error: null }))
        }));
        (supabase as any).rpc = mockRpc;

        await getMyAssignments();
        expect(mockEq).toHaveBeenCalledWith('user_id', 'test-user');
    });

    it('should map status to pending if submission exists but has no file_url', async () => {
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'enrollments') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            in: vi.fn(() => Promise.resolve({ data: [{ subject_id: 'sub-1' }], error: null }))
                        }))
                    }))
                };
            }
            if (table === 'submissions') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            in: vi.fn(() => Promise.resolve({ data: [{ assignment_id: 'assign-1', file_url: null }], error: null }))
                        }))
                    }))
                };
            }
            return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        in: vi.fn(() => Promise.resolve({ data: [], error: null }))
                    })),
                    in: vi.fn(() => Promise.resolve({ data: [], error: null }))
                }))
            };
        });

        (supabase as any).rpc = vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ 
                data: [{ id: 'assign-1', course_id: 'sub-1', due_date: '2099-12-31' }], 
                error: null 
            }))
        }));

        const result = await getMyAssignments();
        expect(result).toHaveLength(1);
        expect(result[0].status).toBe('pending');
    });

    it('should map status to submitted if submission exists and has a valid file_url', async () => {
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'enrollments') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            in: vi.fn(() => Promise.resolve({ data: [{ subject_id: 'sub-1' }], error: null }))
                        }))
                    }))
                };
            }
            if (table === 'submissions') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            in: vi.fn(() => Promise.resolve({ data: [{ assignment_id: 'assign-1', file_url: 'https://example.com/test.jpg' }], error: null }))
                        }))
                    }))
                };
            }
            return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        in: vi.fn(() => Promise.resolve({ data: [], error: null }))
                    })),
                    in: vi.fn(() => Promise.resolve({ data: [], error: null }))
                }))
            };
        });

        (supabase as any).rpc = vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ 
                data: [{ id: 'assign-1', course_id: 'sub-1', due_date: '2099-12-31' }], 
                error: null 
            }))
        }));

        const result = await getMyAssignments();
        expect(result).toHaveLength(1);
        expect(result[0].status).toBe('submitted');
    });
});
