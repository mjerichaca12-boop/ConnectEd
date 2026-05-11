import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Image } from "react-native";
import { useLocalSearchParams, useSegments, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

import Colors from "../../../../src/constants/Colors";
import Layout from "../../../../src/constants/Layout";
import StatusBadge from "../../../../src/components/common/StatusBadge";
import Button from "../../../../src/components/common/Button";
import AppHeader from "../../../../src/components/common/AppHeader";
import FileUploadComponent from "../../../../src/components/common/FileUploadComponent";

import { supabase } from "../../../../src/lib/supabase";
import { useMyAssignmentsQuery } from "../../../../src/hooks/query/assignments/use-my-assignments-query";

const AssignmentItem = ({ title, dueDate, status, onPress }: any) => {
    const isLate = status === "late";
    return (
        <TouchableOpacity 
            style={[styles.itemContainer, isLate && styles.lateItemContainer]} 
            onPress={onPress}
        >
            <View style={{ flex: 1 }}>
                <Text style={[styles.title, isLate && styles.lateText]}>{title}</Text>
                <Text style={[styles.date, isLate && styles.lateText]}>Due: {dueDate}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
                <StatusBadge status={status} style={{ marginBottom: 8 }} />
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
            Alert.alert("Validation Error", "Please select a file to upload before submitting.");
            return;
        }

        setIsSubmitting(true);
        try {
            const { data: userData } = await supabase.auth.getUser();
            const userId = userData.user?.id;

            if (!userId) throw new Error("User not found");

            // 1. Upload file to storage
            const fileExt = pickedFile.name.split('.').pop();
            const storagePath = `submissions/${userId}/${Date.now()}_${pickedFile.name}`;

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

            // 2. Insert into submissions table
            const { error } = await supabase
                .from('submissions')
                .insert({
                    assignment_id: assignment.id,
                    student_id: userId,
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
            console.error("Submit error:", err);
            Alert.alert("Error", err.message || "Failed to submit assignment.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleViewSubmission = () => {
        Alert.alert("Submission", "Viewing submitted assignment...");
    };

    return (
        <View style={styles.detailedContainer}>
            <AppHeader title={assignment.title} showBack={true} onBack={onBack} />
            
            <ScrollView contentContainerStyle={styles.detailedContent}>
                <View style={styles.detailHeader}>
                    <Text style={styles.detailTitle}>{assignment.title}</Text>
                    <StatusBadge status={assignment.status} />
                </View>

                <View style={styles.instructionsContainer}>
                    <Text style={styles.sectionTitle}>Instructions</Text>
                    <Text style={styles.instructionsText}>
                        {assignment.instructions || "Please complete the attached assignment and upload your work here. Ensure all requirements are met before submitting."}
                    </Text>
                </View>

                {(assignment.status === "pending" || assignment.status === "late") ? (
                    <View style={styles.submissionSection}>
                        <Text style={styles.sectionTitle}>Your Work</Text>
                        <View style={styles.uploadWrapper}>
                            <FileUploadComponent
                                onPickFile={handleFileUpload}
                                onRemoveFile={() => setPickedFile(null)}
                                fileName={pickedFile?.name}
                                fileUri={pickedFile?.uri}
                                fileType={pickedFile?.mimeType}
                            />
                        </View>
                        <Button 
                            title={isSubmitting ? "Submitting..." : "Submit Assignment"} 
                            onPress={handleSubmit}
                            disabled={isSubmitting || !pickedFile}
                        />
                    </View>
                ) : (
                    <View style={styles.submissionSection}>
                         <Text style={styles.sectionTitle}>Submission Complete</Text>
                         <View style={styles.submittedInfo}>
                            <Ionicons name="checkmark-circle" size={48} color={Colors.light.primary} />
                            <Text style={styles.submittedText}>You have successfully submitted this assignment.</Text>
                         </View>
                         <Button 
                             title="View My Work" 
                             onPress={handleViewSubmission}
                             variant="secondary"
                         />
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

export default function SubjectAssignments() {
    const segments = useSegments();
    const { id: localId } = useLocalSearchParams();

    // Improved ID extraction: filter segments for a valid UUID or use localId if it's not the placeholder
    const subjectId = (() => {
        if (localId && localId !== '[id]' && typeof localId === 'string') return localId;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const found = segments.find(s => uuidRegex.test(s));
        if (found) return found;
        if (segments[2] && segments[2] !== '[id]') return segments[2];
        return localId as string;
    })();
    const [activeTab, setActiveTab] = useState("upcoming");
    const [selectedAssignment, setSelectedAssignment] = useState<any>(null);

    const { data: assignments = [], isLoading } = useMyAssignmentsQuery({ subjectId });

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

    if (selectedAssignment) {
        return (
            <DetailedAssignmentView 
                assignment={selectedAssignment} 
                onBack={() => setSelectedAssignment(null)} 
            />
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.tabContainer}>
                {[{ id: "upcoming", label: "Upcoming" }, { id: "submitted", label: "Submitted" }, { id: "late", label: "Late" }].map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.tabButton, isActive && styles.activeTabButton]}
                            onPress={() => setActiveTab(tab.id)}
                        >
                            <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <FlatList
                data={filteredAssignments}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.content}
                renderItem={({ item }) => (
                    <AssignmentItem
                        title={item.title}
                        dueDate={item.dueDate}
                        status={item.status}
                        onPress={() => setSelectedAssignment(item)}
                    />
                )}
                ListEmptyComponent={() => (
                     <View style={styles.emptyContainer}>
                         <Text style={styles.emptyText}>No {activeTab} assignments found for this subject.</Text>
                     </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    content: {
        padding: Layout.spacing.m,
    },
    tabContainer: {
        flexDirection: "row",
        paddingHorizontal: Layout.spacing.m,
        paddingTop: Layout.spacing.s,
        paddingBottom: Layout.spacing.m,
        backgroundColor: Colors.light.background,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: "center",
        borderRadius: 20,
    },
    activeTabButton: {
        backgroundColor: Colors.light.primary,
    },
    tabText: {
        fontSize: 14,
        fontWeight: "600",
        color: Colors.light.textSecondary,
    },
    activeTabText: {
        color: "#FFFFFF",
    },
    itemContainer: {
        backgroundColor: "#FFFFFF",
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        borderWidth: 1,
        borderColor: "transparent",
    },
    lateItemContainer: {
        backgroundColor: "#FFF0F0",
        borderColor: "#FFCDCD",
    },
    title: {
        fontSize: 16,
        fontWeight: "600",
        color: Colors.light.text,
        marginBottom: 4,
    },
    date: {
        fontSize: 13,
        color: Colors.light.textSecondary,
    },
    lateText: {
        color: Colors.light.error,
    },
    emptyContainer: {
        padding: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyText: {
        fontSize: 16,
        color: Colors.light.textSecondary,
    },
    detailedContainer: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    detailedContent: {
        padding: Layout.spacing.m,
    },
    detailHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
    },
    detailTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: Colors.light.text,
        flex: 1,
        marginRight: 16,
    },
    instructionsContainer: {
        backgroundColor: "#FFFFFF",
        padding: 20,
        borderRadius: 12,
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: Colors.light.text,
        marginBottom: 12,
    },
    instructionsText: {
        fontSize: 15,
        color: Colors.light.textSecondary,
        lineHeight: 22,
    },
    submissionSection: {
        marginTop: 8,
    },
    uploadWrapper: {
        marginBottom: 24,
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
        fontSize: 15,
        color: Colors.light.textSecondary,
        textAlign: "center",
        marginTop: 12,
        fontWeight: "600",
    }
});
