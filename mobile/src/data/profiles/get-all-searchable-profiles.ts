import { supabase } from "../../lib/supabase";

export async function getAllSearchableProfiles() {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Not authenticated");

    const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, middle_name, role, year_level, section, course')
        .neq('id', userData.user.id)
        .order('last_name', { ascending: true });

    if (error) throw error;
    
    const mapped = (data || []).map(p => {
        const fullName = `${p.first_name || ''} ${p.middle_name || ''} ${p.last_name || ''}`.trim().replace(/\s+/g, ' ');
        return {
            ...p,
            full_name: fullName || 'User'
        };
    });

    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    return mapped.filter(p => {
        if (!p.id || seenIds.has(p.id)) return false;
        seenIds.add(p.id);

        const nameRoleKey = `${p.full_name.toLowerCase().trim()}_${(p.role || '').toLowerCase().trim()}`;
        if (p.full_name !== 'User' && seenNames.has(nameRoleKey)) {
            return false;
        }
        if (p.full_name !== 'User') {
            seenNames.add(nameRoleKey);
        }
        return true;
    });
}
