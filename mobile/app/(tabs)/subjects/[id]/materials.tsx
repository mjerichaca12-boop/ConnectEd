import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, ScrollView, RefreshControl, StatusBar } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Colors from "../../../../src/constants/Colors";
import Layout from "../../../../src/constants/Layout";
import AppHeader from "../../../../src/components/common/AppHeader";
import Button from "../../../../src/components/common/Button";
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from "@expo/vector-icons";
import { supabase } from '../../../../src/lib/supabase';
import { useCreateMaterialMutation } from '../../../../src/hooks/query/materials/use-create-material-mutation';
import { useMaterialsQuery } from "../../../../src/hooks/query/materials/use-materials-query";
import { useSubjectDetailQuery } from "../../../../src/hooks/query/subjects/use-subject-detail-query";
import { useLocalSearchParams, useGlobalSearchParams, useRouter, useSegments } from "expo-router";

const MaterialItem = ({ title, type, date, onPress }: any) => {
    const getIconInfo = (type: string) => {
        const t = type?.toLowerCase();
        if (t === 'pdf') {
            return { name: 'document-text', color: '#EF4444', label: 'PDF' };
        }
        if (t === 'doc' || t === 'docx') {
            return { name: 'document-text', color: '#3B82F6', label: 'DOC' };
        }
        if (t === 'ppt' || t === 'pptx') {
            return { name: 'document-text', color: '#F97316', label: 'PPT' };
        }
        return { name: 'document', color: '#64748B', label: 'FILE' };
    };

    const iconInfo = getIconInfo(type);

    return (
        <TouchableOpacity style={styles.itemContainer} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.iconWrapper}>
                <Ionicons name={iconInfo.name as any} size={28} color={iconInfo.color} />
                <View style={[styles.iconBadge, { backgroundColor: iconInfo.color }]}>
                    <Text style={styles.iconBadgeText}>{iconInfo.label}</Text>
                </View>
            </View>
            <View style={styles.itemTextContainer}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                <Text style={styles.date}>Posted: {date}</Text>
            </View>
            <View style={styles.viewBadge}>
                <Text style={styles.viewBadgeText}>Open</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.light.primary} />
            </View>
        </TouchableOpacity>
    );
};

// Lesson Overview Card Component (matches web design)
const LessonOverviewCard = ({ lesson }: { lesson: any }) => {
    if (!lesson) return null;

    const hasDescription = !!(lesson.description && lesson.description.trim() !== "" && lesson.description.trim().toUpperCase() !== "N/A");
    const hasObjectives = !!(lesson.objectives && lesson.objectives.trim() !== "" && lesson.objectives.trim().toUpperCase() !== "N/A");
    const hasDates = !!(lesson.start_date || lesson.end_date);

    return (
        <View style={styles.overviewCard}>
            {/* Header: Title + Status Badge */}
            <View style={styles.overviewHeaderRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.overviewLessonTitle}>
                        {lesson.title || `Week ${lesson.week_number || 1} Lesson`}
                    </Text>
                    <Text style={styles.overviewSubtitle}>
                        Week {lesson.week_number || 1}{lesson.topic ? ` • ${lesson.topic}` : ''}
                    </Text>
                </View>
                <View style={styles.publishedBadge}>
                    <Text style={styles.publishedBadgeText}>
                        {(lesson.status || 'PUBLISHED').toUpperCase()}
                    </Text>
                </View>
            </View>

            {/* Overview Tab Pill */}
            <View style={styles.overviewTabRow}>
                <View style={styles.activeTabPill}>
                    <Ionicons name="book-outline" size={14} color="#16A34A" style={{ marginRight: 5 }} />
                    <Text style={styles.activeTabPillText}>Overview</Text>
                </View>
            </View>

            {/* Description Block */}
            <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>DESCRIPTION</Text>
                <Text style={styles.fieldValue}>
                    {hasDescription ? lesson.description : "No description provided."}
                </Text>
            </View>

            {/* Learning Objectives Block */}
            <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>LEARNING OBJECTIVES</Text>
                <Text style={styles.fieldValue}>
                    {hasObjectives ? lesson.objectives : "No learning objectives provided."}
                </Text>
            </View>

            {/* Start Date & End Date Row */}
            {hasDates && (
                <View style={styles.datesRow}>
                    {lesson.start_date && (
                        <View style={styles.dateCol}>
                            <Text style={styles.fieldLabel}>START DATE</Text>
                            <View style={styles.dateValueRow}>
                                <Ionicons name="time-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
                                <Text style={styles.dateText}>{lesson.start_date}</Text>
                            </View>
                        </View>
                    )}
                    {lesson.end_date && (
                        <View style={styles.dateCol}>
                            <Text style={styles.fieldLabel}>END DATE</Text>
                            <View style={styles.dateValueRow}>
                                <Ionicons name="time-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
                                <Text style={styles.dateText}>{lesson.end_date}</Text>
                            </View>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

const DetailedMaterialView = ({ material, onBack }: any) => {
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        let fileUrl = material.file_url;
        if (Array.isArray(fileUrl)) {
            fileUrl = fileUrl[0];
        }
        if (!fileUrl || typeof fileUrl !== 'string') {
            Alert.alert("Error", "This material does not have a file attached.");
            return;
        }

        try {
            let targetUrl = fileUrl;
            if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
                const { data } = supabase.storage.from('class-materials').getPublicUrl(fileUrl);
                if (data?.publicUrl) {
                    targetUrl = data.publicUrl;
                }
            }

            try {
                await Linking.openURL(targetUrl);
                return;
            } catch (openErr) {
                console.log("Direct URL open failed, attempting fallback:", openErr);
            }

            setIsDownloading(true);
            const storageDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
            
            if (storageDir) {
                const fileName = `${material.title.replace(/\s+/g, '_')}_${Date.now()}.${material.type || 'pdf'}`;
                const fileUri = storageDir.endsWith('/') ? `${storageDir}${fileName}` : `${storageDir}/${fileName}`;
                
                const { uri } = await FileSystem.downloadAsync(targetUrl, fileUri);
                
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri);
                } else {
                    Alert.alert("Success", "File downloaded successfully.");
                }
            }
        } catch (error) {
            console.error('Download error:', error);
            Alert.alert("Error", "Could not open or download the file.");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <View style={styles.detailedContainer}>
             <AppHeader 
                title="Material Details" 
                showBack={true} 
                onBack={onBack} 
            />
            
            <ScrollView contentContainerStyle={styles.detailedContent}>
                <View style={styles.detailHeader}>
                    <View style={styles.largeIconPlaceholder}>
                        <Text style={styles.largeIconText}>
                            {material.type?.toLowerCase() === "pdf" ? "PDF" : 
                             (material.type?.toLowerCase() === "doc" || material.type?.toLowerCase() === "docx") ? "DOC" :
                             (material.type?.toLowerCase() === "ppt" || material.type?.toLowerCase() === "pptx") ? "PPT" : "FILE"}
                        </Text>
                    </View>
                    <Text style={styles.detailedTitle}>{material.title}</Text>
                    <Text style={styles.detailedDate}>Posted: {material.date}</Text>
                </View>

                {material.file_url && (
                    <View style={styles.actionContainer}>
                        <Button 
                            title={isDownloading ? "Downloading..." : `Open / Download File`} 
                            onPress={handleDownload} 
                            disabled={isDownloading}
                        />
                    </View>
                )}

                <View style={styles.infoContainer}>
                    <Text style={styles.infoTitle}>Description</Text>
                    <Text style={styles.infoText}>
                        {material.description || "This material is study material for this lesson. Please review before class."}
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
};

export default function SubjectMaterials() {
    const segments = useSegments();
    const { id: globalId } = useGlobalSearchParams();
    const { id: localId } = useLocalSearchParams();
    
    const id = (() => {
        if (globalId && globalId !== '[id]' && typeof globalId === 'string') return globalId;
        if (localId && localId !== '[id]' && typeof localId === 'string') return localId;
        
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const found = segments.find(s => uuidRegex.test(s));
        if (found) return found;

        if (segments[2] && segments[2] !== '[id]') return segments[2];
        return localId as string;
    })();

    const { data: subject, isLoading: isSubjectLoading } = useSubjectDetailQuery(id as string);
    const { data: queryData = [], isLoading: isMaterialsLoading, refetch: refetchMaterials, isRefetching } = useMaterialsQuery({ 
        subjectId: id as string,
        teacherId: subject?.teacher_id,
        allowFallback: false
    });
    
    useFocusEffect(
        useCallback(() => {
            refetchMaterials();
        }, [refetchMaterials])
    );

    const materials = queryData;

    const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
    const [isTeacher, setIsTeacher] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
    const createMaterialMutation = useCreateMaterialMutation();

    const isLoading = isSubjectLoading || isMaterialsLoading;

    React.useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) return;
            let role = session.user?.user_metadata?.role || "student";
            setIsTeacher(role === "teacher");
        });
    }, []);

    const handleUploadMaterial = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                let type: 'pdf' | 'doc' | 'other' = 'other';
                if (file.name.toLowerCase().endsWith('.pdf')) type = 'pdf';
                else if (file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx')) type = 'doc';

                createMaterialMutation.mutate({
                    title: file.name,
                    description: "Uploaded by teacher",
                    type,
                    subject_id: id as string,
                    file_uri: file.uri,
                    file_name: file.name,
                    file_type: file.mimeType || 'application/octet-stream'
                });
            }
        } catch (error) {
            console.error("Document picking failed", error);
            Alert.alert("Error", "Failed to select document");
        }
    };

    const toggleSection = (sectionKey: string) => {
        setCollapsedSections(prev => ({
            ...prev,
            [sectionKey]: !prev[sectionKey]
        }));
    };

    // Group materials and lessons by Week / Lesson
    const lessonGroups: Record<string, {
        key: string;
        weekNumber: number | null;
        lessonInfo: any;
        files: any[];
    }> = {};

    materials.forEach((m: any) => {
        const weekNum = m.week_number;
        const key = weekNum ? `Week ${weekNum}` : (m.lesson_title ? m.lesson_title : "General Resources");

        if (!lessonGroups[key]) {
            lessonGroups[key] = {
                key,
                weekNumber: weekNum,
                lessonInfo: {
                    id: m.lesson_id,
                    title: m.lesson_title || (weekNum ? `Week ${weekNum}` : "Lesson Overview"),
                    topic: m.lesson_topic,
                    description: m.lesson_description,
                    objectives: m.lesson_objectives,
                    status: m.lesson_status || "Published",
                    start_date: m.lesson_start_date,
                    end_date: m.lesson_end_date,
                    week_number: weekNum
                },
                files: []
            };
        }

        // Only add to files list if it is an actual downloadable material
        if (!m.is_placeholder && m.file_url) {
            lessonGroups[key].files.push(m);
        }
    });

    const sortedSections = Object.values(lessonGroups).sort((a, b) => {
        if (a.key === "General Resources") return 1;
        if (b.key === "General Resources") return -1;
        const numA = a.weekNumber || 999;
        const numB = b.weekNumber || 999;
        return numA - numB;
    });

    if (selectedMaterial) {
        return (
            <DetailedMaterialView 
                material={selectedMaterial} 
                onBack={() => setSelectedMaterial(null)} 
            />
        );
    }

    if (isLoading && !isRefetching) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
                <Text style={{ marginTop: 12, color: Colors.light.textSecondary }}>Loading lessons & materials...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            
            <FlatList
                data={sortedSections}
                keyExtractor={(item) => item.key}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl 
                        refreshing={isRefetching} 
                        onRefresh={refetchMaterials} 
                        tintColor={Colors.light.primary} 
                        colors={[Colors.light.primary]} 
                    />
                }
                renderItem={({ item: section }) => {
                    const isCollapsed = !!collapsedSections[section.key];
                    const lesson = section.lessonInfo;
                    const hasFiles = section.files.length > 0;

                    return (
                        <View style={styles.lessonSectionCard}>
                            {/* Expandable Section Header */}
                            <TouchableOpacity 
                                style={styles.sectionHeaderContainer} 
                                onPress={() => toggleSection(section.key)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.sectionHeaderLeft}>
                                    <View style={styles.caretCircle}>
                                        <Ionicons 
                                            name={isCollapsed ? "chevron-forward" : "chevron-down"} 
                                            size={18} 
                                            color={Colors.light.primary} 
                                        />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={styles.sectionHeaderTitle}>{section.key}</Text>
                                        {lesson.title && lesson.title !== section.key && (
                                            <Text style={styles.sectionHeaderSubtitle} numberOfLines={1}>
                                                {lesson.title}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                <View style={styles.fileCountBadge}>
                                    <Ionicons name="document-text-outline" size={13} color="#64748B" style={{ marginRight: 3 }} />
                                    <Text style={styles.fileCountText}>{section.files.length}</Text>
                                </View>
                            </TouchableOpacity>

                            {/* Section Body (Visible when not collapsed) */}
                            {!isCollapsed && (
                                <View style={styles.sectionBody}>
                                    {/* Top Card: Lesson Overview matching Web Design */}
                                    <LessonOverviewCard lesson={lesson} />

                                    {/* Attached Files List */}
                                    <View style={styles.filesSectionHeader}>
                                        <Text style={styles.filesSectionTitle}>
                                            Learning Materials ({section.files.length})
                                        </Text>
                                    </View>

                                    {hasFiles ? (
                                        <View style={styles.filesListContainer}>
                                            {section.files.map((file) => (
                                                <MaterialItem
                                                    key={file.id}
                                                    title={file.title}
                                                    type={file.type}
                                                    date={file.date}
                                                    onPress={() => setSelectedMaterial(file)}
                                                />
                                            ))}
                                        </View>
                                    ) : (
                                        <View style={styles.noFilesCard}>
                                            <Ionicons name="document-outline" size={24} color="#94A3B8" />
                                            <Text style={styles.noFilesText}>
                                                No downloadable files attached to this lesson yet.
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    );
                }}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="book-outline" size={64} color="#CBD5E1" />
                        <Text style={styles.emptyText}>No lessons or materials found.</Text>
                        <Text style={styles.emptySubText}>
                            When your teacher publishes weekly lessons and study materials, they will appear here.
                        </Text>
                    </View>
                )}
            />

            {isTeacher && (
                <TouchableOpacity 
                    style={styles.fab} 
                    onPress={handleUploadMaterial}
                    disabled={createMaterialMutation.isPending}
                >
                    {createMaterialMutation.isPending ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Ionicons name="add" size={32} color="#FFF" />
                    )}
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    content: {
        padding: 14,
        paddingBottom: 100,
    },
    lessonSectionCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
        overflow: "hidden",
    },
    sectionHeaderContainer: {
        backgroundColor: "#FFFFFF",
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    sectionHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    caretCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#F0FDF4",
        alignItems: "center",
        justifyContent: "center",
    },
    sectionHeaderTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#0F172A",
    },
    sectionHeaderSubtitle: {
        fontSize: 13,
        color: "#64748B",
        marginTop: 1,
    },
    fileCountBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F1F5F9",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    fileCountText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#475569",
    },
    sectionBody: {
        padding: 14,
        paddingTop: 0,
        backgroundColor: "#FAFAFA",
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
    },
    overviewCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 16,
        marginTop: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
    },
    overviewHeaderRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    overviewLessonTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#0F172A",
    },
    overviewSubtitle: {
        fontSize: 13,
        color: "#64748B",
        marginTop: 2,
    },
    publishedBadge: {
        backgroundColor: "#DCFCE7",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#BBF7D0",
    },
    publishedBadgeText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#166534",
        letterSpacing: 0.5,
    },
    overviewTabRow: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
        paddingBottom: 8,
        marginBottom: 12,
    },
    activeTabPill: {
        flexDirection: "row",
        alignItems: "center",
        paddingBottom: 4,
        borderBottomWidth: 2,
        borderBottomColor: "#16A34A",
    },
    activeTabPillText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#16A34A",
    },
    fieldSection: {
        marginBottom: 12,
    },
    fieldLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: "#64748B",
        letterSpacing: 0.6,
        marginBottom: 4,
    },
    fieldValue: {
        fontSize: 14,
        color: "#334155",
        lineHeight: 20,
    },
    datesRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
        gap: 20,
    },
    dateCol: {
        flex: 1,
    },
    dateValueRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 2,
    },
    dateText: {
        fontSize: 13,
        color: "#334155",
        fontWeight: "500",
    },
    filesSectionHeader: {
        marginTop: 16,
        marginBottom: 8,
    },
    filesSectionTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#475569",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    filesListContainer: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        overflow: "hidden",
    },
    itemContainer: {
        backgroundColor: "#FFFFFF",
        paddingVertical: 12,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    iconWrapper: {
        position: 'relative',
        width: 34,
        height: 34,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    iconBadge: {
        position: 'absolute',
        bottom: -2,
        left: -2,
        paddingHorizontal: 3,
        paddingVertical: 1,
        borderRadius: 2,
        minWidth: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconBadgeText: {
        color: '#FFFFFF',
        fontSize: 6,
        fontWeight: 'bold',
    },
    itemTextContainer: {
        flex: 1,
    },
    title: {
        fontSize: 14,
        fontWeight: "600",
        color: "#1E293B",
        marginBottom: 2,
    },
    date: {
        fontSize: 12,
        color: "#64748B",
    },
    viewBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F0FDF4",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 2,
    },
    viewBadgeText: {
        fontSize: 12,
        fontWeight: "600",
        color: Colors.light.primary,
    },
    noFilesCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderStyle: "dashed",
    },
    noFilesText: {
        fontSize: 13,
        color: "#94A3B8",
        marginTop: 6,
        textAlign: "center",
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    emptyText: {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#64748B',
        marginTop: 16,
    },
    emptySubText: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 40,
    },
    detailedContainer: {
         flex: 1,
         backgroundColor: Colors.light.background,
    },
    detailedContent: {
        padding: Layout.spacing.m,
    },
    detailHeader: {
        marginBottom: 24,
        alignItems: "center",
        paddingTop: 16,
    },
    largeIconPlaceholder: {
        width: 72,
        height: 72,
        backgroundColor: "#F1F5F9",
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 14,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    largeIconText: {
        fontSize: 18,
        fontWeight: "bold",
        color: Colors.light.primary,
    },
    detailedTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: Colors.light.text,
        marginBottom: 6,
        textAlign: "center",
    },
    detailedDate: {
        fontSize: 13,
        color: Colors.light.textSecondary,
    },
    actionContainer: {
        marginBottom: 24,
    },
    infoContainer: {
        backgroundColor: "#FFFFFF",
        padding: 18,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    infoTitle: {
        fontSize: 15,
        fontWeight: "bold",
        color: Colors.light.text,
        marginBottom: 8,
    },
    infoText: {
        fontSize: 14,
        color: Colors.light.textSecondary,
        lineHeight: 20,
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.light.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 6,
    },
});
