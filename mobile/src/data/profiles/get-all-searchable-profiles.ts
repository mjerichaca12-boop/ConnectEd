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
    
    const mapped = (data || []).map(p => ({
        ...p,
        full_name: `${p.first_name || ''} ${p.middle_name || ''} ${p.last_name || ''}`.trim().replace(/\s+/g, ' ')
    }));

    const seen = new Set<string>();
    return mapped.filter(p => {
        const key = `${p.full_name.toLowerCase().trim()}_${(p.role || '').toLowerCase().trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
