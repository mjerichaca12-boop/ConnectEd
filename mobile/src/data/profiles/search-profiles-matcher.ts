export interface SearchableItem {
    id?: string;
    name?: string;
    full_name?: string;
    base_name?: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    suffix?: string;
    name_extension?: string;
    email?: string;
    username?: string;
    role?: string;
    partner_name?: string;
    partner_role?: string;
    content?: string;
    message_text?: string;
    [key: string]: any;
}

const ROLE_ALIASES: Record<string, string[]> = {
    admin: [
        'admin',
        'admins',
        'administrator',
        'administrators',
        'super_admin',
        'superadmin',
        'staff',
        'mod',
        'moderator',
    ],
    teacher: [
        'teacher',
        'teachers',
        'faculty',
        'instructor',
        'instructors',
        'prof',
        'professor',
        'educator',
        'educators',
    ],
    student: [
        'student',
        'students',
        'pupil',
        'pupils',
        'learner',
        'learners',
        'classmate',
        'classmates',
    ],
};

/**
 * Robust search query matcher supporting:
 * - Tokenized multi-word search (e.g. "teacher smith", "admin maria")
 * - Role alias matching (e.g. "admins", "faculty", "superadmin")
 * - Wildcard keywords ("user", "users", "all", "everyone", "people")
 * - Name, base name, email, username, role, and message content matching
 */
export function matchesSearchQuery(item: SearchableItem, rawQuery?: string): boolean {
    if (!rawQuery || !rawQuery.trim()) return true;
    if (!item) return false;

    const q = rawQuery.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return true;

    const fullName = String(item.full_name || item.partner_name || item.name || '').toLowerCase();
    const baseName = String(item.base_name || `${item.first_name || ''} ${item.last_name || ''}`).toLowerCase().trim();
    const email = String(item.email || '').toLowerCase();
    const username = String(item.username || '').toLowerCase();
    const role = String(item.role || item.partner_role || '').toLowerCase();
    const content = String(item.content || item.message_text || '').toLowerCase();
    const gradeLevel = String(item.grade_level || item.year_level || '').toLowerCase();
    const gradeNum = gradeLevel.replace(/[^0-9]/g, '');
    const suffix = String(item.suffix || item.name_extension || '').toLowerCase();

    return tokens.every(token => {
        // Universal match keywords
        if (
            token === 'user' ||
            token === 'users' ||
            token === 'all' ||
            token === 'everyone' ||
            token === 'people' ||
            token === 'account' ||
            token === 'accounts'
        ) {
            return true;
        }

        // Role alias matching: if query token matches a known role alias
        for (const [normRole, aliases] of Object.entries(ROLE_ALIASES)) {
            if (aliases.includes(token)) {
                if (
                    role.includes(normRole) ||
                    (normRole === 'admin' && (role.includes('admin') || role.includes('super_admin') || role.includes('administrator')))
                ) {
                    return true;
                }
            }
        }

        // Regular substring matching on all fields
        return (
            fullName.includes(token) ||
            baseName.includes(token) ||
            suffix.includes(token) ||
            email.includes(token) ||
            username.includes(token) ||
            role.includes(token) ||
            content.includes(token) ||
            gradeLevel.includes(token) ||
            (Boolean(gradeNum) && (token === gradeNum || token === `grade${gradeNum}` || token === `g${gradeNum}`))
        );
    });
}

