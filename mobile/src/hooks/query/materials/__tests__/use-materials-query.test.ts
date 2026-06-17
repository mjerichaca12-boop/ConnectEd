import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react-hooks';
import { useMaterialsQuery } from '../use-materials-query';

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

vi.mock('../../../data/materials/get-materials', () => ({
    getMaterials: vi.fn()
}));

describe('useMaterialsQuery', () => {
    it('should be disabled for invalid subjectId when fallback is false', () => {
        const { result } = renderHook(() => useMaterialsQuery({ subjectId: 'undefined', allowFallback: false }));
        expect((result.current as any).enabled).toBe(false);
    });

    it('should be enabled when allowFallback is true (default)', () => {
        const { result } = renderHook(() => useMaterialsQuery({ subjectId: 'undefined' }));
        expect((result.current as any).enabled).toBe(true);
    });

    it('should be enabled for valid subjectId', () => {
        const validId = '550e8400-e29b-41d4-a716-446655440000';
        const { result } = renderHook(() => useMaterialsQuery({ subjectId: validId, allowFallback: false }));
        expect((result.current as any).enabled).toBe(true);
    });
});
