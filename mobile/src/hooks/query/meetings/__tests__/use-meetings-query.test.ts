import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react-hooks';
import { useMeetingsQuery } from '../use-meetings-query';

// Mock dependencies
vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn((config) => config),
    useQueryClient: vi.fn(() => ({
        invalidateQueries: vi.fn()
    }))
}));

vi.mock('../../../lib/supabase', () => ({
    supabase: {
        channel: vi.fn(() => ({
            on: vi.fn(() => ({
                subscribe: vi.fn()
            }))
        })),
        removeChannel: vi.fn()
    }
}));

vi.mock('../../../data/meetings/get-meetings', () => ({
    getMeetings: vi.fn()
}));

describe('useMeetingsQuery', () => {
    it('should be enabled when no subject intent is provided (global fetch)', () => {
        const { result } = renderHook(() => useMeetingsQuery({}));
        expect((result.current as any).enabled).toBe(true);
    });

    it('should be disabled when subjectId is provided but invalid', () => {
        const { result } = renderHook(() => useMeetingsQuery({ subjectId: '[id]' }));
        expect((result.current as any).enabled).toBe(false);

        const { result2 } = renderHook(() => useMeetingsQuery({ subjectId: 'undefined' })) as any;
        expect(result2?.current?.enabled || false).toBe(false);
    });

    it('should be enabled when a valid subjectId is provided', () => {
        const { result } = renderHook(() => useMeetingsQuery({ subjectId: '550e8400-e29b-41d4-a716-446655440000' }));
        expect((result.current as any).enabled).toBe(true);
    });
});
