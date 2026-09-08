import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAllSearchableProfiles, formatGradeLevel, formatRoleLabel } from '../get-all-searchable-profiles';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => {
    return {
        supabase: {
            auth: {
                getUser: vi.fn(),
            },
            from: vi.fn(),
        },
    };
});

describe('getAllSearchableProfiles', () => {
    const mockProfiles = [
        {
            id: 'teacher-1',
            first_name: 'Jane',
            last_name: 'Doe',
            middle_name: '',
            role: 'teacher',
            username: 'janedoe',
            email: 'jane@school.edu',
            section: null,
        },
        {
            id: 'student-1',
            first_name: 'John',
            last_name: 'Smith',
            middle_name: '',
            role: 'student',
            username: 'johnsmith1',
            email: 'john1@student.edu',
            section: 'A',
        },
        {
            id: 'student-2',
            first_name: 'John',
            last_name: 'Smith',
            middle_name: '',
            role: 'student',
            username: 'johnsmith2',
            email: 'john2@student.edu',
            section: 'B',
        },
        {
            id: 'admin-1',
            first_name: 'Super',
            last_name: 'Admin',
            middle_name: '',
            role: 'super_admin',
            username: 'superadmin',
            email: 'super@school.edu',
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const setupSupabaseMock = (profiles: any[], currentUserId: string = 'current-user-123', error: any = null) => {
        (supabase.auth.getUser as any).mockResolvedValue({
            data: { user: { id: currentUserId } },
            error: null,
        });

        const builder: any = {
            neq: vi.fn(() => builder),
            order: vi.fn(() => builder),
            then: (resolve: any) => Promise.resolve({ data: profiles, error }).then(resolve),
        };

        (supabase.from as any).mockReturnValue({
            select: vi.fn(() => builder),
        });

        return builder;
    };

    it('throws error if user is not authenticated', async () => {
        (supabase.auth.getUser as any).mockResolvedValue({
            data: null,
            error: new Error('Session expired'),
        });

        await expect(getAllSearchableProfiles()).rejects.toThrow('Not authenticated');
    });

    it('fetches and maps all profiles correctly', async () => {
        setupSupabaseMock(mockProfiles);

        const results = await getAllSearchableProfiles();

        // Should return 4 mock profiles + 1 fallback admin (id: 11111111-1111-1111-1111-111111111111)
        expect(results.length).toBe(5);

        const teacher = results.find(p => p.id === 'teacher-1');
        expect(teacher).toBeDefined();
        expect(teacher?.role).toBe('teacher');
        expect(teacher?.full_name).toContain('Jane Doe');

        const student = results.find(p => p.id === 'student-1');
        expect(student).toBeDefined();
        expect(student?.role).toBe('student');
    });

    it('preserves all users with the same name without lossy deduplication', async () => {
        setupSupabaseMock(mockProfiles);

        const results = await getAllSearchableProfiles();

        // Both student-1 and student-2 are named "John Smith" with distinct IDs
        const johnSmiths = results.filter(p => p.first_name === 'John' && p.last_name === 'Smith');
        expect(johnSmiths.length).toBe(2);
        expect(johnSmiths.map(p => p.id)).toEqual(expect.arrayContaining(['student-1', 'student-2']));
    });

    it('excludes current user via .neq("id", currentUserId)', async () => {
        const queryBuilder = setupSupabaseMock(mockProfiles, 'my-user-id');

        await getAllSearchableProfiles();

        expect(queryBuilder.neq).toHaveBeenCalledWith('id', 'my-user-id');
        expect(queryBuilder.order).toHaveBeenCalledWith('last_name', { ascending: true });
    });

    it('orders profiles hierarchically: admins first, teachers second, students third', async () => {
        setupSupabaseMock(mockProfiles);

        const results = await getAllSearchableProfiles();

        const roles = results.map(p => p.role);
        const firstStudentIndex = roles.indexOf('student');
        const lastAdminIndex = roles.lastIndexOf('admin');
        const firstTeacherIndex = roles.indexOf('teacher');

        expect(lastAdminIndex).toBeLessThan(firstTeacherIndex);
        expect(firstTeacherIndex).toBeLessThan(firstStudentIndex);
    });

    it('adds System Administrator fallback when not present in DB', async () => {
        setupSupabaseMock(mockProfiles);

        const results = await getAllSearchableProfiles();

        const systemAdmin = results.find(p => p.id === '11111111-1111-1111-1111-111111111111');
        expect(systemAdmin).toBeDefined();
        expect(systemAdmin?.role).toBe('admin');
        expect(systemAdmin?.full_name).toBe('System Administrator');
    });

    it('does not duplicate System Administrator if already present in DB with fallback ID', async () => {
        const profilesWithSystemAdmin = [
            ...mockProfiles,
            {
                id: '11111111-1111-1111-1111-111111111111',
                first_name: 'System',
                last_name: 'Administrator',
                role: 'admin',
                username: 'admin',
                email: 'admin@connected.edu',
            },
        ];
        setupSupabaseMock(profilesWithSystemAdmin);

        const results = await getAllSearchableProfiles();

        const systemAdmins = results.filter(p => p.id === '11111111-1111-1111-1111-111111111111');
        expect(systemAdmins.length).toBe(1);
    });

    it('populates role_label and grade_level correctly', async () => {
        const studentProfile = [
            {
                id: 'student-grade-10',
                first_name: 'Alex',
                last_name: 'Reyes',
                role: 'student',
                year_level: '10',
                email: 'alex@student.edu',
            },
        ];
        setupSupabaseMock(studentProfile);

        const results = await getAllSearchableProfiles();
        const alex = results.find(p => p.id === 'student-grade-10');
        expect(alex).toBeDefined();
        expect(alex?.role).toBe('student');
        expect(alex?.role_label).toBe('Student');
        expect(alex?.grade_level).toBe('Grade 10');
    });
});

describe('formatGradeLevel', () => {
    it('formats numeric values into Grade X', () => {
        expect(formatGradeLevel('10')).toBe('Grade 10');
        expect(formatGradeLevel('7')).toBe('Grade 7');
        expect(formatGradeLevel('12')).toBe('Grade 12');
    });

    it('normalizes existing grade text', () => {
        expect(formatGradeLevel('grade 9')).toBe('Grade 9');
        expect(formatGradeLevel('Grade 11')).toBe('Grade 11');
        expect(formatGradeLevel('grade10')).toBe('Grade 10');
    });

    it('handles empty or null values', () => {
        expect(formatGradeLevel(null)).toBe('');
        expect(formatGradeLevel(undefined)).toBe('');
        expect(formatGradeLevel('')).toBe('');
        expect(formatGradeLevel('   ')).toBe('');
    });
});

describe('formatRoleLabel', () => {
    it('returns Admin for admin roles', () => {
        expect(formatRoleLabel('admin')).toBe('Admin');
        expect(formatRoleLabel('super_admin')).toBe('Admin');
        expect(formatRoleLabel('administrator')).toBe('Admin');
    });

    it('returns Teacher for teacher roles', () => {
        expect(formatRoleLabel('teacher')).toBe('Teacher');
        expect(formatRoleLabel('faculty')).toBe('Teacher');
        expect(formatRoleLabel('instructor')).toBe('Teacher');
    });

    it('returns Student for student roles or fallbacks', () => {
        expect(formatRoleLabel('student')).toBe('Student');
        expect(formatRoleLabel('')).toBe('Student');
        expect(formatRoleLabel(undefined)).toBe('Student');
    });
});
