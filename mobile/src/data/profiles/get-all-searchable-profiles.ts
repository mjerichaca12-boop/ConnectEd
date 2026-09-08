import { supabase } from "../../lib/supabase";
import { formatFullName, formatTeacherName } from "../../utils/name-formatter";

export const HARDCODED_ADMIN_ID = "11111111-1111-1111-1111-111111111111";

export function formatGradeLevel(val?: string | null): string {
    if (!val || typeof val !== 'string' || !val.trim()) return '';
    const trimmed = val.trim();
    // Normalize "grade 10" or "Grade10" to "Grade 10"
    if (/^grade\s*\d+/i.test(trimmed)) {
        return trimmed.replace(/^grade\s*/i, 'Grade ');
    }
    // Normalize plain numeric year levels like "7", "8", "9", "10", "11", "12" to "Grade X"
    if (/^\d+$/.test(trimmed)) {
        return `Grade ${trimmed}`;
    }
    return trimmed;
}

export function formatRoleLabel(role?: string | null): 'Admin' | 'Teacher' | 'Student' {
    const r = String(role || '').toLowerCase().trim();
    if (r === 'admin' || r === 'super_admin' || r === 'administrator') return 'Admin';
    if (r === 'teacher' || r === 'faculty' || r === 'instructor') return 'Teacher';
    return 'Student';
}

export interface SearchableProfile {
    id: string;
    email: string;
    username: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    suffix?: string;
    name_extension?: string;
    full_name: string;
    base_name: string;
    role: 'admin' | 'teacher' | 'student';
    role_label?: 'Admin' | 'Teacher' | 'Student';
    year_level?: string;
    grade_level?: string;
    section?: string;
    course?: string;
    status?: string;
    avatar_url?: string;
}

export async function getAllSearchableProfiles(): Promise<SearchableProfile[]> {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Not authenticated");
    const currentUserId = userData.user.id;

    let res = await supabase
        .from('profiles')
        .select('id, email, username, first_name, last_name, middle_name, role, status, year_level, section, course, suffix, avatar_url')
        .neq('id', currentUserId)
        .order('last_name', { ascending: true });

    if (res.error && (res.error.code === '42703' || res.error.message?.includes('suffix'))) {
        res = await supabase
            .from('profiles')
            .select('id, email, username, first_name, last_name, middle_name, role, status, year_level, section, course, avatar_url')
            .neq('id', currentUserId)
            .order('last_name', { ascending: true });
    }

    const { data, error } = res;

    if (error) {
        console.error('[getAllSearchableProfiles] Error fetching profiles:', error);
        throw error;
    }

    const mapped: SearchableProfile[] = (data || []).map((p: any) => {
        const fullName = formatFullName(p);
        const baseName = formatTeacherName(p);

        const rawRole = String(p.role || '').toLowerCase().trim();
        const rawEmail = String(p.email || '').toLowerCase().trim();

        let resolvedRole: 'admin' | 'teacher' | 'student' = 'student';
        if (
            rawRole === 'admin' || 
            rawRole === 'super_admin' || 
            rawRole === 'administrator' || 
            p.id === HARDCODED_ADMIN_ID ||
            rawEmail.includes('admin')
        ) {
            resolvedRole = 'admin';
        } else if (rawRole === 'teacher' || rawRole === 'faculty' || rawRole === 'instructor') {
            resolvedRole = 'teacher';
        } else {
            resolvedRole = 'student';
        }

        const rawYear = p.year_level || '';
        const formattedGrade = formatGradeLevel(rawYear);

        return {
            id: String(p.id),
            email: p.email || '',
            username: p.username || '',
            first_name: p.first_name || '',
            last_name: p.last_name || '',
            middle_name: p.middle_name || '',
            suffix: p.suffix || p.name_extension || '',
            name_extension: p.name_extension || p.suffix || '',
            full_name: fullName || p.username || p.email || (resolvedRole === 'admin' ? 'System Administrator' : (resolvedRole === 'teacher' ? 'Teacher' : 'Student')),
            base_name: baseName || fullName || 'User',
            role: resolvedRole,
            role_label: formatRoleLabel(resolvedRole),
            year_level: rawYear,
            grade_level: formattedGrade,
            section: p.section || '',
            course: p.course || '',
            status: p.status || '',
            avatar_url: p.avatar_url || '',
        };
    });

    // Ensure System Administrator is available if not current user
    if (currentUserId !== HARDCODED_ADMIN_ID && !mapped.some(p => p.id === HARDCODED_ADMIN_ID)) {
        mapped.push({
            id: HARDCODED_ADMIN_ID,
            email: 'admin.connected.local',
            username: 'admin',
            first_name: 'System',
            last_name: 'Administrator',
            full_name: 'System Administrator',
            base_name: 'System Administrator',
            role: 'admin',
            role_label: 'Admin',
            grade_level: '',
            status: 'Active',
        });
    }

    // Deduplicate STRICTLY by user ID - never drop unique individuals who share names!
    const seenIds = new Set<string>();
    const uniqueProfiles = mapped.filter(p => {
        if (!p.id || seenIds.has(p.id)) return false;
        // Don't show inactive/disabled accounts
        const status = String(p.status || '').toLowerCase().trim();
        if (status === 'disabled' || status === 'inactive') return false;

        seenIds.add(p.id);
        return true;
    });

    // Sort order: Admins first, Teachers second, Students third, then alphabetical by name
    return uniqueProfiles.sort((a, b) => {
        const roleOrder: Record<string, number> = { admin: 0, teacher: 1, student: 2 };
        const orderA = roleOrder[a.role] ?? 2;
        const orderB = roleOrder[b.role] ?? 2;
        if (orderA !== orderB) return orderA - orderB;
        return a.full_name.localeCompare(b.full_name);
    });
}
