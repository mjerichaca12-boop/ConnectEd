import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, StatusBar, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/src/constants/Colors";
import AppHeader from "@/src/components/common/AppHeader";
import Button from "@/src/components/common/Button";
import FileViewerModal from "@/src/components/common/FileViewerModal";
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
import { useAnnouncementsQuery } from "@/src/hooks/query/announcements/use-announcements-query";
import { useDeleteAnnouncementMutation } from "@/src/hooks/query/announcements/use-delete-announcement-mutation";
import { supabase } from "@/src/lib/supabase";
import { decode } from 'base64-arraybuffer';

import { getAnnouncementById } from "@/src/data/announcements/get-announcement-by-id";
import { Announcement } from "@/src/types";

export default function AnnouncementDetailScreen() {
    const { id, from } = useLocalSearchParams<{ id: string, from?: string }>();
    const router = useRouter();
    const [isTeacher, setIsTeacher] = useState(false);
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);
    const [viewerTitle, setViewerTitle] = useState<string | null>(null);
    const [viewerVisible, setViewerVisible] = useState(false);

    const openFileViewer = (url: string | null | undefined, title: string) => {
        if (!url) return;
        setViewerUrl(url);
        setViewerTitle(title);
        setViewerVisible(true);
    };

    const deleteMutation = useDeleteAnnouncementMutation();

    useEffect(() => {
        const fetchDetail = async () => {
            if (!id) return;
            setIsLoading(true);
            const data = await getAnnouncementById(id);
            setAnnouncement(data);
            setIsLoading(false);
        };

        fetchDetail();

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) return;
            let role = session.user?.user_metadata?.role || "student";
            setIsTeacher(role === "teacher");
        });
    }, [id]);

    const handleBack = () => {
        if (from === 'manage') {
            router.push('/(tabs)/teacher/announcements');
        } else {
            if (router.canGoBack()) {
                router.back();
            } else {
                router.push('/(tabs)/home');
            }
        }
    };

    const handleDelete = () => {
        Alert.alert(
            "Delete Announcement",
            "Are you sure you want to delete this announcement?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteMutation.mutateAsync({ id: id as string });
                            handleBack();
                        } catch (error) {
                            Alert.alert("Error", "Failed to delete announcement.");
                        }
                    }
                }
            ]
        );
    };

    const handleDownload = async () => {
        if (!announcement?.file_url) return;

        try {
            setIsDownloading(true);
            const storageDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;

            if (!storageDir) {
                Linking.openURL(announcement.file_url);
                return;
            }

            const fileName = announcement.file_name || `attachment_${Date.now()}`;
            const fileUri = storageDir.endsWith('/') ? `${storageDir}${fileName}` : `${storageDir}/${fileName}`;

            const { uri } = await FileSystem.downloadAsync(announcement.file_url, fileUri);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                Alert.alert("Success", "File downloaded successfully.");
            }
        } catch (error) {
            console.error('Download error:', error);
            Alert.alert("Download Error", "Failed to download file. Opening in browser instead.");
            Linking.openURL(announcement.file_url);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadAttachment = async (attachment: any) => {
        if (!attachment?.file_url) return;

        try {
            setIsDownloading(true);
            const storageDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;

            if (!storageDir) {
                Linking.openURL(attachment.file_url);
                return;
            }

            const fileName = attachment.file_name || `attachment_${Date.now()}`;
            const fileUri = storageDir.endsWith('/') ? `${storageDir}${fileName}` : `${storageDir}/${fileName}`;

            const { uri } = await FileSystem.downloadAsync(attachment.file_url, fileUri);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                Alert.alert("Success", "File downloaded successfully.");
            }
        } catch (error) {
            console.error('Download error:', error);
            Alert.alert("Download Error", "Failed to download file. Opening in browser instead.");
            Linking.openURL(attachment.file_url);
        } finally {
            setIsDownloading(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
        );
    }

    if (!announcement) {
        return (
            <View style={styles.centered}>
                <Text>Announcement not found</Text>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <AppHeader title="Announcement" showBack={true} onBack={handleBack} />

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{announcement.title}</Text>
                        {isTeacher && (
                            <TouchableOpacity onPress={handleDelete} style={styles.deleteIcon}>
                                <Ionicons name="trash-outline" size={22} color="#EF4444" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.meta}>
                        <View style={styles.metaItem}>
                            <Ionicons name="person-outline" size={16} color="#64748B" />
                            <Text style={styles.metaText}>{announcement.author} ({announcement.author_role})</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Ionicons name="calendar-outline" size={16} color="#64748B" />
                            <Text style={styles.metaText}>{announcement.date}</Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {announcement.image_url && (
                        <TouchableOpacity 
                            onPress={() => openFileViewer(announcement.image_url, announcement.title || "Announcement Image")}
                            activeOpacity={0.9}
                            style={{ marginBottom: 16 }}
                        >
                            <Image source={{ uri: announcement.image_url }} style={styles.fullImage} resizeMode="contain" />
                        </TouchableOpacity>
                    )}

                    <Text style={styles.body}>{announcement.content}</Text>

                    {announcement.attachments && announcement.attachments.length > 0 && (
                        <View style={styles.attachmentsSection}>
                            <Text style={styles.attachmentsTitle}>Attachments</Text>
                            {announcement.attachments.map((att: any, index: number) => {
                                // Skip the image if it's already displayed as the primary image
                                if (att.file_url === announcement.image_url) return null;

                                return (
                                    <View key={index} style={styles.attachmentContainer}>
                                        <TouchableOpacity 
                                            style={styles.attachmentInfo}
                                            onPress={() => openFileViewer(att.file_url, att.file_name || "Attachment")}
                                        >
                                            <Ionicons
                                                name={att.file_type?.startsWith('image/') ? "image-outline" : "document-attach-outline"}
                                                size={24}
                                                color={Colors.light.primary}
                                            />
                                            <Text style={styles.attachmentName} numberOfLines={1}>
                                                {att.file_name || "Attached File"}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            style={styles.downloadButtonSmall}
                                            onPress={() => handleDownloadAttachment(att)}
                                        >
                                            <Ionicons name="download-outline" size={20} color="#64748B" />
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {announcement.file_url && !announcement.image_url && (!announcement.attachments || announcement.attachments.length === 0) && (
                        <View style={styles.attachmentContainer}>
                            <TouchableOpacity 
                                style={styles.attachmentInfo}
                                onPress={() => openFileViewer(announcement.file_url, announcement.file_name || "Attachment")}
                            >
                                <Ionicons name="document-attach-outline" size={24} color={Colors.light.primary} />
                                <Text style={styles.attachmentName} numberOfLines={1}>
                                    {announcement.file_name || "Attached File"}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.downloadButtonSmall}
                                onPress={handleDownload}
                                disabled={isDownloading}
                            >
                                <Ionicons name="download-outline" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </ScrollView>

            <FileViewerModal 
                visible={viewerVisible} 
                onClose={() => setViewerVisible(false)} 
                url={viewerUrl} 
                fileName={viewerTitle} 
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    content: {
        padding: 16,
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 24,
        minHeight: '100%', // Ensure it fits the screen properly
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 15,
        elevation: 3,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#1E293B",
        flex: 1,
        marginRight: 12,
    },
    deleteIcon: {
        padding: 4,
    },
    meta: {
        flexDirection: "row",
        gap: 16,
        marginBottom: 24,
    },
    metaItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    metaText: {
        fontSize: 14,
        color: "#64748B",
    },
    divider: {
        height: 1,
        backgroundColor: "#F1F5F9",
        marginBottom: 24,
    },
    body: {
        fontSize: 16,
        lineHeight: 26,
        color: "#334155",
    },
    fullImage: {
        width: '100%',
        height: 250,
        borderRadius: 12,
        marginBottom: 24,
        backgroundColor: '#F1F5F9',
    },
    backButton: {
        marginTop: 16,
        padding: 12,
        backgroundColor: Colors.light.primary,
        borderRadius: 8,
    },
    backButtonText: {
        color: "#FFFFFF",
        fontWeight: "bold",
    },
    attachmentContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 12,
        padding: 16,
        backgroundColor: "#F8FAFC",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    attachmentInfo: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        marginRight: 12,
    },
    attachmentName: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1E293B",
        marginLeft: 8,
        flex: 1,
    },
    attachmentsSection: {
        marginTop: 24,
        paddingTop: 24,
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
    },
    attachmentsTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 16,
    },
    downloadButtonSmall: {
        padding: 8,
        backgroundColor: "#F1F5F9",
        borderRadius: 8,
    },
});
