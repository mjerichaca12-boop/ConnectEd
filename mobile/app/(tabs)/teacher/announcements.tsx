import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../../src/components/common/AppHeader";
import Colors from "../../../src/constants/Colors";
import { Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useAnnouncementsQuery } from "../../../src/hooks/query/announcements/use-announcements-query";
import { useDeleteAnnouncementMutation } from "../../../src/hooks/query/announcements/use-delete-announcement-mutation";
import { Announcement } from "../../../src/types";


type ContentType = "Announcement" | "Assignment" | "Files";

const DUMMY_DATA = [
    { 
        id: "1", 
        type: "Files", 
        title: "Chapter 5: Quadratic Equations", 
        desc: "Complete lecture notes and practice problems",
        subject: "Advanced Mathematics",
        format: "PDF",
        size: "2.5 MB",
        date: "2/10/2026",
        downloads: 24,
        icon: "document-text"
    },
    { 
        id: "2", 
        type: "Files", 
        title: "Physics Lab Guide", 
        desc: "Laboratory procedures and safety guidelines",
        subject: "Physics",
        format: "PDF",
        size: "1.8 MB",
        date: "2/8/2026",
        downloads: 18,
        icon: "flask"
    },
    { 
        id: "3", 
        type: "Files", 
        title: "Programming Basics Slides", 
        desc: "Introduction to Python programming",
        subject: "Computer Science",
        format: "PPTX",
        size: "5.2 MB",
        date: "2/5/2026",
        downloads: 31,
        icon: "code-slash"
    },
    { 
        id: "4", 
        type: "Announcement", 
        title: "Mid-term Exams Schedule", 
        desc: "The mid-term exams will start next week. Please review the schedule.",
        subject: "All Classes",
        format: "Text",
        size: "---",
        date: "Jan 15, 2026",
        downloads: 0,
        icon: "megaphone"
    },
];

export default function ManageContentScreen() {
    const router = useRouter();
    const [selectedFilter, setSelectedFilter] = useState<ContentType>("Announcement");
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    
    // TanStack Query Hooks
    const { data: announcementsData, isLoading, refetch } = useAnnouncementsQuery();
    const deleteMutation = useDeleteAnnouncementMutation();
    const announcements = announcementsData || [];

    // Form State
    const [newTitle, setNewTitle] = useState("");
    const [newContent, setNewContent] = useState("");
    const [selectedFile, setSelectedFile] = useState<any>(null);

    const handleDelete = (id: string) => {
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
                            await deleteMutation.mutateAsync({ id });
                            Alert.alert("Success", "Announcement deleted successfully");
                        } catch (error) {
                            Alert.alert("Error", "Failed to delete announcement");
                        }
                    }
                }
            ]
        );
    };


    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true
            });

            if (!result.canceled) {
                setSelectedFile(result.assets[0]);
            }
        } catch (error) {
            console.error("Error picking file:", error);
        }
    };

    const handlePostAnnouncement = async () => {
        if (!newTitle || !newContent) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        setIsPosting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No session");

            let fileUrl = null;
            let fileName = null;

            if (selectedFile) {
                // Read file as base64 for upload
                const base64 = await FileSystem.readAsStringAsync(selectedFile.uri, { encoding: 'base64' });
                const bytes = decode(base64);
                
                const fileExt = selectedFile.name.split('.').pop();
                const path = `${session.user.id}/${Date.now()}.${fileExt}`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('announcement-images')
                    .upload(path, bytes, {
                        contentType: selectedFile.mimeType || 'application/octet-stream',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('announcement-images')
                    .getPublicUrl(path);

                fileUrl = publicUrl;
                fileName = selectedFile.name;
            }

            const { error } = await supabase
                .from('school_announcements')
                .insert({
                    title: newTitle,
                    content: newContent,
                    file_url: fileUrl,
                    image_url: selectedFile?.mimeType?.startsWith('image/') ? fileUrl : null,
                    file_name: fileName,
                    type: selectedFilter,
                    author: session.user.user_metadata?.firstName || "Teacher",
                    author_id: session.user.id
                });

            if (error) throw error;

            Alert.alert("Success", "Announcement posted successfully!");
            setIsModalVisible(false);
            setNewTitle("");
            setNewContent("");
            setSelectedFile(null);
            refetch();
        } catch (error: any) {
            Alert.alert("Error", "Failed to post announcement: " + (error.message || "Unknown error"));
        } finally {
            setIsPosting(false);
        }
    };

    const filteredData = announcements.filter(item => {
        const itemType = item.type as string;
        if (selectedFilter === "Files") return itemType === "Files";
        return itemType === selectedFilter || (!itemType && selectedFilter === "Announcement");
    });

    const renderContentCard = ({ item }: { item: Announcement }) => {
        const itemType = item.type as string;
        return (
        <View style={styles.contentCard} key={item.id}>
            <View style={styles.cardLeft}>
                <View style={[styles.iconBox, itemType === "Files" ? { backgroundColor: "#F1F5F9" } : { backgroundColor: "#F0FDF4" }]}>
                    <Ionicons name={itemType === "Files" ? "document-text" : "megaphone"} size={24} color={itemType === "Files" ? "#64748B" : Colors.light.primary} />
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.contentTitle}>{item.title}</Text>
                    <Text style={styles.contentDesc} numberOfLines={2}>{item.content}</Text>
                    <View style={styles.metadataRow}>
                        <View style={styles.metaItem}>
                            <Ionicons name="book-outline" size={14} color="#94A3B8" />
                            <Text style={styles.metaText}>General</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Ionicons name="document-outline" size={14} color="#94A3B8" />
                            <Text style={styles.metaText}>{item.type || "Announcement"}</Text>
                        </View>
                    </View>
                    <View style={styles.metadataRow}>
                        <View style={styles.metaItem}>
                            <Ionicons name="calendar-outline" size={14} color="#94A3B8" />
                            <Text style={styles.metaText}>{item.date}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Ionicons name="person-outline" size={14} color="#94A3B8" />
                            <Text style={styles.metaText}>{item.author}</Text>
                        </View>
                    </View>
                </View>
            </View>
            <View style={styles.cardActions}>
                <TouchableOpacity 
                    style={styles.actionBtn}
                    onPress={() => router.push({ pathname: `/(tabs)/announcement/${item.id}`, params: { from: 'manage' } } as any)}
                >
                    <Ionicons name="eye-outline" size={20} color={Colors.light.primary} />
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.actionBtn}
                    onPress={() => handleDelete(item.id)}
                >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
            </View>
        </View>
    );
};


    return (
        <SafeAreaView style={styles.container}>
            <AppHeader title="Manage Content" hasNotifications={true} />
            
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Green Banner */}
                <View style={styles.banner}>
                    <View style={styles.bannerLeft}>
                        <Text style={styles.bannerTitle}>Class Materials & Activities</Text>
                        <Text style={styles.bannerSub}>Upload and manage educational resources</Text>
                    </View>
                    <TouchableOpacity 
                        style={styles.uploadButton}
                        onPress={() => setIsModalVisible(true)}
                    >
                        <Ionicons name="add" size={24} color={Colors.light.primary} />
                        <Text style={styles.uploadText}>New {selectedFilter}</Text>
                    </TouchableOpacity>
                </View>

                {/* Filters (Tabs) */}
                <View style={styles.filterTabs}>
                    {(["Announcement", "Assignment", "Files"] as ContentType[]).map((filter) => (
                        <TouchableOpacity 
                            key={filter} 
                            style={[styles.filterTab, selectedFilter === filter && styles.activeTab]}
                            onPress={() => setSelectedFilter(filter)}
                        >
                            <Text style={[styles.filterTabText, selectedFilter === filter && styles.activeTabText]}>
                                {filter}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Content List */}
                <View style={styles.listContainer}>
                    {isLoading ? (
                        <ActivityIndicator size="large" color={Colors.light.primary} style={{ marginTop: 40 }} />
                    ) : filteredData.length > 0 ? (
                        filteredData.map((item) => renderContentCard({ item }))
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No {selectedFilter} found</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* New Announcement Modal */}
            <Modal
                visible={isModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsModalVisible(false)}
            >
                <KeyboardAvoidingView 
                    style={{ flex: 1 }} 
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                >
                    <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>New {selectedFilter}</Text>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalForm}>
                            <Text style={styles.inputLabel}>Title</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Enter title"
                                value={newTitle}
                                onChangeText={setNewTitle}
                            />

                            <Text style={styles.inputLabel}>Content / Description</Text>
                            <TextInput
                                style={[styles.textInput, styles.textArea]}
                                placeholder="Enter content"
                                multiline
                                numberOfLines={4}
                                value={newContent}
                                onChangeText={setNewContent}
                            />

                            <Text style={styles.inputLabel}>Attachment</Text>
                            <TouchableOpacity style={styles.filePicker} onPress={handlePickFile}>
                                <Ionicons name="cloud-upload-outline" size={24} color={Colors.light.primary} />
                                <Text style={styles.filePickerText}>
                                    {selectedFile ? selectedFile.name : "Choose a file to upload"}
                                </Text>
                            </TouchableOpacity>
                            {selectedFile && (
                                <TouchableOpacity onPress={() => setSelectedFile(null)} style={styles.removeFile}>
                                    <Text style={styles.removeFileText}>Remove file</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>

                        <TouchableOpacity 
                            style={[styles.postButton, isPosting && { opacity: 0.7 }]} 
                            onPress={handlePostAnnouncement}
                            disabled={isPosting}
                        >
                            {isPosting ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="paper-plane-outline" size={20} color="#FFFFFF" />
                                    <Text style={styles.postButtonText}>Post to Student Portal</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    banner: {
        backgroundColor: Colors.light.primary,
        padding: 24,
        margin: 16,
        borderRadius: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    bannerLeft: { flex: 1, marginRight: 16 },
    bannerTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#FFFFFF",
    },
    bannerSub: {
        fontSize: 12,
        color: "rgba(255, 255, 255, 0.8)",
        marginTop: 4,
    },
    uploadButton: {
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: "center",
    },
    uploadText: {
        color: Colors.light.primary,
        fontWeight: "bold",
        marginLeft: 6,
        fontSize: 12,
    },
    filterTabs: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginBottom: 20,
    },
    filterTab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: "center",
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: "#F0FDF4",
        borderWidth: 1,
        borderColor: Colors.light.primary,
    },
    filterTabText: {
        fontSize: 13,
        fontWeight: "600",
        color: "#64748B",
    },
    activeTabText: {
        color: Colors.light.primary,
    },
    listContainer: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    contentCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: "#F1F5F9",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 1,
    },
    cardLeft: {
        flex: 1,
        flexDirection: "row",
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: "#FEF2F2",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 16,
    },
    cardInfo: {
        flex: 1,
    },
    contentTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 4,
    },
    contentDesc: {
        fontSize: 13,
        color: "#64748B",
        marginBottom: 12,
        lineHeight: 18,
    },
    metadataRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        marginBottom: 4,
    },
    metaItem: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 16,
    },
    metaText: {
        fontSize: 11,
        color: "#94A3B8",
        marginLeft: 6,
    },
    cardActions: {
        justifyContent: "space-around",
        marginLeft: 12,
    },
    actionBtn: {
        padding: 4,
    },
    emptyContainer: {
        alignItems: "center",
        marginTop: 60,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 15,
        color: "#94A3B8",
        fontWeight: "500",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: "80%",
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#1E293B",
    },
    modalForm: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: "600",
        color: "#64748B",
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 12,
        padding: 16,
        fontSize: 15,
        color: "#1E293B",
        marginBottom: 20,
    },
    textArea: {
        height: 120,
        textAlignVertical: "top",
    },
    filePicker: {
        backgroundColor: "#F0FDF4",
        borderWidth: 2,
        borderColor: Colors.light.primary,
        borderStyle: "dashed",
        borderRadius: 12,
        padding: 24,
        alignItems: "center",
        justifyContent: "center",
    },
    filePickerText: {
        marginTop: 8,
        fontSize: 14,
        color: Colors.light.primary,
        fontWeight: "500",
    },
    removeFile: {
        marginTop: 8,
        alignSelf: "flex-end",
    },
    removeFileText: {
        color: "#EF4444",
        fontSize: 12,
        fontWeight: "600",
    },
    postButton: {
        backgroundColor: Colors.light.primary,
        flexDirection: "row",
        height: 56,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
    },
    postButtonText: {
        color: "#FFFFFF",
        fontWeight: "bold",
        marginLeft: 10,
        fontSize: 16,
    },
});
