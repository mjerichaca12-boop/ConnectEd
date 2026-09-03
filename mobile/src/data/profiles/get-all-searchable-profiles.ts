import { supabase } from "../../lib/supabase";

export async function getAllSearchableProfiles() {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Not authenticated");

    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, username, first_name, last_name, middle_name, role, year_level, section, course')
        .neq('id', userData.user.id)
        .order('last_name', { ascending: true });

    if (error) throw error;
    
    const mapped = (data || []).map(p => {
        const fullName = `${p.first_name || ''} ${p.middle_name || ''} ${p.last_name || ''}`.trim().replace(/\s+/g, ' ');
        const baseName = `${p.first_name || ''} ${p.last_name || ''}`.trim().replace(/\s+/g, ' ');
        return {
            ...p,
            email: p.email || '',
            username: p.username || '',
            full_name: fullName || p.username || p.email || 'User',
            base_name: baseName || fullName || 'User'
        };
    });

    const seenIds = new Set<string>();
    const seenBaseKeys = new Set<string>();
    const seenEmails = new Set<string>();

    return mapped.filter(p => {
        if (!p.id || seenIds.has(p.id)) return false;
        seenIds.add(p.id);

        const emailKey = (p.email || '').toLowerCase().trim();
        if (emailKey && seenEmails.has(emailKey)) return false;
        if (emailKey) seenEmails.add(emailKey);

        const baseKey = `${p.base_name.toLowerCase().trim()}_${(p.role || '').toLowerCase().trim()}`;
        if (p.base_name !== 'User' && seenBaseKeys.has(baseKey)) {
            return false;
        }
        if (p.base_name !== 'User') {
            seenBaseKeys.add(baseKey);
        }

        return true;
    });
}
