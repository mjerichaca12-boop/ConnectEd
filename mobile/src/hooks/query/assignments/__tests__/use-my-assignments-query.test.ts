import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react-hooks';
import { useMyAssignmentsQuery } from '../use-my-assignments-query';

vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn((config) => config),
    useQueryClient: vi.fn(() => ({
        invalidateQueries: vi.fn()
    }))
}));

vi.mock('../../../lib/supabase', () => ({
    supabase: {
        channel: vi.fn(() => ({
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn()
        })),
        removeChannel: vi.fn()
    }
}));

vi.mock('../../../data/assignments/get-my-assignments', () => ({
    getMyAssignments: vi.fn()
}));

describe('useMyAssignmentsQuery', () => {
    it('should be enabled for global intent (no filters)', () => {
        const { result } = renderHook(() => useMyAssignmentsQuery());
        expect((result.current as any).enabled).toBe(true);
    });

    it('should be disabled for invalid subjectId (such as route id 146)', () => {
        const { result } = renderHook(() => useMyAssignmentsQuery({ subjectId: '146' }));
        expect((result.current as any).enabled).toBe(false);
    });

    it('should be disabled for undefined subjectId with subject intent', () => {
        const { result } = renderHook(() => useMyAssignmentsQuery({ subjectId: undefined }));
        expect((result.current as any).enabled).toBe(false);
    });

    it('should be enabled for valid subject UUID', () => {
        const validId = '550e8400-e29b-41d4-a716-446655440000';
        const { result } = renderHook(() => useMyAssignmentsQuery({ subjectId: validId }));
        expect((result.current as any).enabled).toBe(true);
    });
});
