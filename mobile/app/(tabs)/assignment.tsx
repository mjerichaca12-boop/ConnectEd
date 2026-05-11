import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, StatusBar, ScrollView } from "react-native";
import Colors from "../../src/constants/Colors";
import Layout from "../../src/constants/Layout";
import StatusBadge from "../../src/components/common/StatusBadge";
import Button from "../../src/components/common/Button";
import AppHeader from "../../src/components/common/AppHeader";
import FileUploadComponent from "../../src/components/common/FileUploadComponent";

import * as DocumentPicker from "expo-document-picker";
import { supabase } from "../../src/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
import { decode } from 'base64-arraybuffer';
import { Image } from "react-native";

const AssignmentItem = ({ title, subject, dueDate, status, onPress }: any) => {
    const isLate = status === "late";
    return (
        <TouchableOpacity style={[styles.itemContainer, isLate && styles.lateItemContainer]} onPress={onPress}>
            <View style={styles.itemHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.subject}>{subject}</Text>
                    <Text style={[styles.title, isLate && styles.lateText]}>{title}</Text>
                    <Text style={[styles.date, isLate && styles.lateText]}>Due: {dueDate}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                    <StatusBadge status={status} />
                </View>
            </View>
        </TouchableOpacity>
    );
};

const DetailedAssignmentView = ({ assignment, onBack }: any) => {
    const [pickedFile, setPickedFile] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const queryClient = useQueryClient();

    const handleFileUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                
                // Limit size to 150MB
                const maxSize = 150 * 1024 * 1024;
                if (file.size && file.size > maxSize) {
                    Alert.alert("Limit Exceeded", "File size must be less than 150MB.");
                    return;
                }

                setPickedFile(file);
            }
        } catch (err) {
            console.error("Picker error:", err);
        }
    };

    const handleSubmit = async () => {
        if (!pickedFile) {
            Alert.alert("Validation Error", "Please attach a file before submitting.");
            return;
        }

        setIsSubmitting(true);
        try {
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError || !userData?.user) throw new Error("Not authenticated");

            // 1. Upload file
            const fileExt = pickedFile.name.split('.').pop();
            const storagePath = `submissions/${userData.user.id}/${Date.now()}_${pickedFile.name}`;
            
            // Read file as base64 for reliable binary upload
            const base64 = await FileSystem.readAsStringAsync(pickedFile.uri, { encoding: 'base64' });
            const bytes = decode(base64);

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('class-materials')
                .upload(storagePath, bytes, {
                    contentType: pickedFile.mimeType || 'application/octet-stream',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('class-materials')
                .getPublicUrl(storagePath);

            // 2. Insert into submissions
            const { error } = await supabase
                .from('submissions')
                .insert({
                    assignment_id: assignment.id,
                    student_id: userData.user.id,
                    file_url: publicUrl,
                    status: 'submitted'
                });

            if (error) throw error;

            Alert.alert(
                "Submission Complete", 
                "Your assignment has been successfully submitted.",
                [{ text: "OK", onPress: () => {
                    queryClient.invalidateQueries({ queryKey: ['my-assignments'] });
                    onBack();
                }}]
            );
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to submit assignment.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleViewSubmission = async () => {
        const fileUrl = assignment.submission?.file_url;
        if (!fileUrl) {
            Alert.alert("Error", "No file found for this submission.");
            return;
        }
        
        try {
            const { data } = supabase.storage.from('class-materials').getPublicUrl(fileUrl);
            if (data?.publicUrl) {
                Linking.openURL(data.publicUrl);
            }
        } catch(e) {
            console.error(e);
        }
    };

    const handleDownloadAssignment = async () => {
        if (!assignment.file_url) return;
        try {
            const { data } = supabase.storage.from('class-materials').getPublicUrl(assignment.file_url);
            if (data?.publicUrl) {
                Linking.openURL(data.publicUrl);
            }
        } catch(e) {
            console.error(e);
        }
    };

    const isImage = pickedFile?.mimeType?.startsWith('image/') || pickedFile?.name?.match(/\.(jpg|jpeg|png)$/i);

    return (
        <View style={styles.detailedContainer}>
             <AppHeader 
                title={assignment.title} 
                showBack={true} 
                onBack={onBack} 
                hasNotifications={true}
            />
            
            <ScrollView contentContainerStyle={styles.detailedContent}>
                <View style={styles.detailHeader}>
                     <Text style={styles.subject}>{assignment.subject}</Text>
                     <Text style={styles.date}>Due: {assignment.dueDate}</Text>
                     <StatusBadge status={assignment.status} style={{ marginTop: 8 }}/>
                </View>

                {assignment.instructions && (
                    <View style={styles.instructionsContainer}>
                        <Text style={styles.instructionsTitle}>Instructions</Text>
                        <Text style={styles.instructionsText}>{assignment.instructions}</Text>
                        
                        {assignment.file_url && (
                            <Button 
                                title="Download Assignment Material" 
                                onPress={handleDownloadAssignment}
                                style={{ marginTop: 16 }}
                            />
                        )}
                    </View>
                )}

                {(assignment.status === "pending" || assignment.status === "late") && (
                    <View style={styles.submissionSection}>
                        <Text style={styles.submissionTitle}>Submission</Text>
                        
                        <FileUploadComponent 
                            onPickFile={handleFileUpload} 
                            onRemoveFile={() => setPickedFile(null)}
                            fileName={pickedFile?.name}
                            fileUri={pickedFile?.uri}
                            fileType={pickedFile?.mimeType}
                            style={{ marginBottom: 16 }} 
                        />

                        <Button 
                            title={isSubmitting ? "Submitting..." : "Submit Assignment"} 
                            onPress={handleSubmit} 
                            disabled={isSubmitting || !pickedFile}
                        />
                    </View>
                )}
                
                {(assignment.status === "submitted" || assignment.status === "graded") && (
                    <View style={styles.submissionSection}>
                        <Text style={styles.submissionTitle}>Submission Complete</Text>
                        <View style={styles.submittedInfo}>
                            <Ionicons name="checkmark-circle" size={48} color={Colors.light.primary} />
                            <Text style={styles.submittedText}>Your work has been received.</Text>
                        </View>

                        {assignment.submission?.grade !== null && assignment.submission?.grade !== undefined && (
                            <View style={styles.feedbackContainer}>
                                <Text style={styles.feedbackTitle}>Grade: {assignment.submission.grade}</Text>
                            </View>
                        )}
                        {assignment.submission?.teacher_comment && (
                            <View style={styles.feedbackContainer}>
                                <Text style={styles.feedbackTitle}>Teacher's Comment:</Text>
                                <Text style={styles.feedbackText}>{assignment.submission.teacher_comment}</Text>
                            </View>
                        )}

                        <Button 
                            title="View My Work" 
                            onPress={handleViewSubmission} 
                            variant="secondary"
                            style={{ marginTop: 12 }}
                        />
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

import { useMyAssignmentsQuery } from "../../src/hooks/query/assignments/use-my-assignments-query";
import { ActivityIndicator } from "react-native";

export default function AssignmentsScreen() {
    const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
    const [activeTab, setActiveTab] = useState("upcoming");

    const { data: assignments = [], isLoading } = useMyAssignmentsQuery();
    
    const tabs = [
        { id: "upcoming", label: "Upcoming" },
        { id: "submitted", label: "Submitted" },
        { id: "late", label: "Late" }
    ];

    if (selectedAssignment) {
        return (
            <DetailedAssignmentView 
                assignment={selectedAssignment} 
                onBack={() => setSelectedAssignment(null)} 
            />
        );
    }
    
    if (isLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
        );
    }

    // Map 'upcoming' tab to 'pending' status in data
    const statusFilter = activeTab === "upcoming" ? "pending" : activeTab;
    const filteredAssignments = assignments.filter((a) => a.status === statusFilter);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.light.forestGreen} />
            <AppHeader title="Tasks" hasNotifications={true} />
            
            <View style={styles.banner}>
                <Text style={styles.bannerTitle}>My Assignments</Text>
                <Text style={styles.bannerSub}>Complete your tasks to stay on track</Text>
            </View>

            <View style={styles.tabContainer}>
                {tabs.map((tab) => (
                    <TouchableOpacity 
                        key={tab.id}
                        style={[styles.tab, activeTab === tab.id && styles.activeTab]}
                        onPress={() => setActiveTab(tab.id)}
                    >
                        <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={filteredAssignments}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <AssignmentItem
                        title={item.title}
                        subject={item.subject}
                        dueDate={item.dueDate}
                        status={item.status}
                        onPress={() => setSelectedAssignment(item)}
                    />
                )}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No {activeTab} assignments found.</Text>
                    </View>
                )}
                showsVerticalScrollIndicator={false}
            />
        </View>
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
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 16,
    },
    bannerTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#FFFFFF",
    },
    bannerSub: {
        fontSize: 14,
        color: "rgba(255, 255, 255, 0.9)",
        marginTop: 4,
    },
    detailedContainer: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    detailedContent: {
        padding: 16,
    },
    tabContainer: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        marginTop: 16,
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: "center",
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: Colors.light.primary + "10",
    },
    tabText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#64748B",
    },
    activeTabText: {
        color: Colors.light.primary,
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    detailHeader: {
        marginBottom: 24,
        backgroundColor: "#FFFFFF",
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    itemContainer: {
        backgroundColor: "#FFFFFF",
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        flexDirection: "column",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    lateItemContainer: {
        borderColor: "#EF4444",
        backgroundColor: "#FEF2F2",
    },
    itemHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    subject: {
        fontSize: 12,
        color: Colors.light.primary,
        fontWeight: "bold",
        marginBottom: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 4,
    },
    lateText: {
        color: "#EF4444",
    },
    date: {
        fontSize: 13,
        color: "#64748B",
    },
    instructionsContainer: {
        marginBottom: 24,
        backgroundColor: "#FFFFFF",
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    instructionsTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 8,
    },
    instructionsText: {
        fontSize: 15,
        color: "#475569",
        lineHeight: 22,
    },
    submissionSection: {
        marginTop: 8,
        backgroundColor: "#FFFFFF",
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    submissionTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 16,
    },
    submittedInfo: {
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "#F0FAF5",
        borderRadius: 12,
        marginBottom: 16,
    },
    submittedText: {
        color: Colors.light.primary,
        fontSize: 15,
        fontWeight: "600",
        marginTop: 12,
        textAlign: "center",
    },
    emptyContainer: {
        padding: 40,
        alignItems: "center",
    },
    emptyText: {
        color: "#94A3B8",
        fontSize: 15,
    },
    feedbackContainer: {
        backgroundColor: "#F8FAFC",
        padding: 12,
        borderRadius: 8,
        marginTop: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    feedbackTitle: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 4,
    },
    feedbackText: {
        fontSize: 14,
        color: "#475569",
        lineHeight: 20,
    }
});
