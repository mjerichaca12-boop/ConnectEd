import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

export interface CreateMaterialArgs {
    title: string;
    description: string;
    type: 'pdf' | 'doc' | 'other';
    subject_id: string;
    file_uri: string;
    file_name: string;
    file_type: string;
}

export function useCreateMaterialMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ title, description, type, subject_id, file_uri, file_name, file_type }: CreateMaterialArgs) => {
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError || !userData.user) throw new Error("Not authenticated");

            // 1. Upload the file to storage
            const fileExt = file_name.split('.').pop();
            const storagePath = `${userData.user.id}/${Date.now()}_${file_name}`;
            
            // Read file as base64 for reliable binary upload
            const base64 = await FileSystem.readAsStringAsync(file_uri, { encoding: 'base64' });
            const bytes = decode(base64);

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('class-materials')
                .upload(storagePath, bytes, {
                    contentType: file_type || 'application/octet-stream',
                    upsert: true
                });

            if (uploadError) {
                console.error("Storage error:", uploadError);
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('class-materials')
                .getPublicUrl(storagePath);

            const finalFileUrl = publicUrl;

            // 2. Resolve lesson_id for the given subject_id
            const { data: lessons, error: lessonErr } = await supabase
                .from('lessons')
                .select('id')
                .eq('subject_id', subject_id)
                .order('created_at', { ascending: false })
                .limit(1);

            if (lessonErr || !lessons || lessons.length === 0) {
                console.error("No lessons found for subject:", subject_id, lessonErr);
                throw new Error("No lessons exist for this subject. Please create a lesson first.");
            }

            const lesson_id = lessons[0].id;

            // 3. Insert record into lesson_materials
            const { data, error } = await supabase
                .from('lesson_materials')
                .insert({
                    lesson_id,
                    file_name: title,
                    file_url: finalFileUrl,
                    file_size: bytes.byteLength,
                    file_type
                })
                .select()
                .single();

            if (error) {
                console.error("Insert error:", error);
                throw error;
            }

            return data;
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['materials', variables.subject_id] });
            Alert.alert("Success", "Material uploaded successfully!");
        },
        onError: (error) => {
            console.error("Failed to upload material:", error);
            Alert.alert("Error", "Failed to upload material. Please try again.");
        }
    });
}
