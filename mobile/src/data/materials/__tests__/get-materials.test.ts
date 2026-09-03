import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMaterials } from '../get-materials';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
            }))
        }))
    }
}));

describe('getMaterials data service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should query materials by valid subject UUID and map results', async () => {
        const mockMaterials = [
            {
                id: 'mat-1',
                title: 'Syllabus',
                file_name: 'Syllabus',
                type: 'pdf',
                created_at: '2026-05-18T10:00:00.000Z',
                file_url: '["https://storage.supabase.co/syllabus.pdf"]',
                subject_id: 'c5f69db9-b961-4dd7-b69c-089e00171bdc',
                description: 'Course guidelines',
                lessons: {
                    id: 'lesson-1',
                    subject_id: 'c5f69db9-b961-4dd7-b69c-089e00171bdc',
                    week_number: 1,
                    title: 'Intro'
                }
            }
        ];

        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'lesson_materials') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => Promise.resolve({ data: mockMaterials, error: null }))
                    }))
                };
            }
            return {};
        });

        const materials = await getMaterials({ subjectId: 'c5f69db9-b961-4dd7-b69c-089e00171bdc', allowFallback: false });
        expect(materials).toHaveLength(1);
        expect(materials[0].title).toBe('Syllabus');
        expect(materials[0].file_url).toBe('https://storage.supabase.co/syllabus.pdf');
    });

    it('should return empty list for invalid subject ID', async () => {
        const materials = await getMaterials({ subjectId: 'invalid-id', allowFallback: false });
        expect(materials).toHaveLength(0);
    });
});
