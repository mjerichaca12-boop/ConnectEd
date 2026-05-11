import { supabase } from "../../lib/supabase";

export async function getMyChats() {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error("Not authenticated");

    const { data, error } = await supabase
        .from('chat_list')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}
