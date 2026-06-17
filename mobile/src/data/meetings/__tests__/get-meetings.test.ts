import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMeetings } from '../get-meetings';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                order: vi.fn(() => ({
                    order: vi.fn(() => Promise.resolve({ data: null, error: null }))
                }))
            }))
        }))
    }
}));

describe('getMeetings data service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should query meetings by valid subject UUID and map dynamic scheduled date-time', async () => {
        const mockMeetings = [
            {
                id: 'meet-1',
                title: 'Orientation Session',
                subject: 'English',
                scheduled_date: '2026-05-20',
                scheduled_time: '14:00:00',
                duration_minutes: 45,
                subject_id: 'c5f69db9-b961-4dd7-b69c-089e00171bdc',
                meeting_link: 'https://jitsi.connected/orient'
            }
        ];

        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'online_class_meetings') {
                return {
                    select: vi.fn(() => ({
                        order: vi.fn(() => ({
                            order: vi.fn(() => ({
                                eq: vi.fn(() => Promise.resolve({ data: mockMeetings, error: null }))
                            }))
                        }))
                    }))
                };
            }
            return {};
        });

        const meetings = await getMeetings({ subjectId: 'c5f69db9-b961-4dd7-b69c-089e00171bdc' });
        expect(meetings).toHaveLength(1);
        expect(meetings[0].title).toBe('Orientation Session');
        expect(meetings[0].time).toBe('2026-05-20 at 14:00');
        expect(meetings[0].duration).toBe('45m');
    });

    it('should return empty list if table not found', async () => {
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'online_class_meetings') {
                return {
                    select: vi.fn(() => ({
                        order: vi.fn(() => ({
                            order: vi.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST205', message: 'table not found' } }))
                        }))
                    }))
                };
            }
            return {};
        });

        const meetings = await getMeetings();
        expect(meetings).toHaveLength(0);
    });
});
