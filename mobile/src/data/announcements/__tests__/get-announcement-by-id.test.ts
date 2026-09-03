import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAnnouncementById } from '../get-announcement-by-id';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => ({
    supabase: {
        storage: {
            from: vi.fn(() => ({
                getPublicUrl: vi.fn((path) => ({ data: { publicUrl: `https://storage.supabase.co/bucket/${path}` } }))
            }))
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

describe('getAnnouncementById data service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should query class_announcements by UUID and return mapped announcement details', async () => {
        const mockClassAnn = {
            id: 'c5f69db9-b961-4dd7-b69c-089e00171bdc',
            title: 'Quiz Tomorrow',
            content: 'Please study Chapter 4.',
            created_at: '2026-05-18T10:00:00.000Z',
            created_by_name: 'John Doe',
            priority: 'High',
            attachments: [
                {
                    file_name: 'chapter4.png',
                    file_url: 'announcements/chapter4.png',
                    file_type: 'image/png'
                }
            ]
        };

        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'class_announcements') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle: vi.fn(() => Promise.resolve({ data: mockClassAnn, error: null }))
                        }))
                    }))
                };
            }
            return {};
        });

        const announcement = await getAnnouncementById('c5f69db9-b961-4dd7-b69c-089e00171bdc');
        expect(announcement).not.toBeNull();
        expect(announcement?.title).toBe('Quiz Tomorrow');
        expect(announcement?.image_url).toBe('https://storage.supabase.co/bucket/announcements/chapter4.png');
        expect(announcement?.type).toBe('urgent');
    });

    it('should fall back to standard announcements table if not found in class_announcements', async () => {
        const mockStandardAnn = {
            id: 'a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5',
            title: 'Global Announcement',
            content: 'School is closed tomorrow due to weather.',
            created_at: '2026-05-18T10:00:00.000Z',
            priority: 'Low',
            attachments: []
        };

        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'class_announcements') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
                        }))
                    }))
                };
            }
            if (table === 'announcements') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle: vi.fn(() => Promise.resolve({ data: mockStandardAnn, error: null }))
                        }))
                    }))
                };
            }
            return {};
        });

        const announcement = await getAnnouncementById('a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5');
        expect(announcement).not.toBeNull();
        expect(announcement?.title).toBe('Global Announcement');
        expect(announcement?.type).toBe('general');
    });
});
