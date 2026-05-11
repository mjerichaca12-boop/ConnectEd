import { supabase } from "../../lib/supabase";

export interface DeleteAnnouncementArgs {
    id: string;
}

export async function deleteAnnouncement({ id }: DeleteAnnouncementArgs): Promise<void> {
    const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

    if (error) throw error;
}
