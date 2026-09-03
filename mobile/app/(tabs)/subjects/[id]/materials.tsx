import React, { useState } from "react";
import { View, Text, StyleSheet, SectionList, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
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

const MaterialItem = ({ title, type, date, onPress }: any) => {
    const getIconInfo = (type: string) => {
        const t = type?.toLowerCase();
        if (t === 'pdf') {
            return { name: 'document-text', color: '#EF4444', label: 'PDF' };
        }
        if (t === 'doc' || t === 'docx') {
            return { name: 'document-text', color: '#3B82F6', label: 'W' };
        }
        if (t === 'ppt' || t === 'pptx') {
            return { name: 'document-text', color: '#F97316', label: 'P' };
        }
        return { name: 'document', color: '#64748B', label: 'FILE' };
    };

    const iconInfo = getIconInfo(type);

    return (
        <TouchableOpacity style={styles.itemContainer} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.iconWrapper}>
                <Ionicons name={iconInfo.name as any} size={30} color={iconInfo.color} />
                <View style={[styles.iconBadge, { backgroundColor: iconInfo.color }]}>
                    <Text style={styles.iconBadgeText}>{iconInfo.label}</Text>
                </View>
            </View>
            <View style={styles.itemTextContainer}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                <Text style={styles.date}>Posted: {date}</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={16} color="#CBD5E1" />
        </TouchableOpacity>
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

            // First attempt: Directly open the URL (most reliable across modern platforms)
            try {
                await Linking.openURL(targetUrl);
                return;
            } catch (openErr) {
                console.log("Direct URL open failed, attempting fallback:", openErr);
            }

            // Fallback: Download via FileSystem (for specific mobile needs)
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
            
            <View style={styles.detailedContent}>
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

                <View style={styles.actionContainer}>
                     <Button 
                         title={isDownloading ? "Downloading..." : `Download ${material.type.toUpperCase()}`} 
                         onPress={handleDownload} 
                         disabled={isDownloading}
                     />
                </View>

                <View style={styles.infoContainer}>
                    <Text style={styles.infoTitle}>Description</Text>
                    <Text style={styles.infoText}>
                        {material.description || "This material is required reading for the upcoming week. Please ensure you have reviewed it before the next lecture."}
                    </Text>
                </View>
            </View>
        </View>
    );
};

import { useMaterialsQuery } from "../../../../src/hooks/query/materials/use-materials-query";
import { useSubjectDetailQuery } from "../../../../src/hooks/query/subjects/use-subject-detail-query";
import { useLocalSearchParams, useGlobalSearchParams, useRouter, useSegments } from "expo-router";

export default function SubjectMaterials() {
    const segments = useSegments();
    const { id: globalId } = useGlobalSearchParams();
    const { id: localId } = useLocalSearchParams();
    
    // Improved ID extraction
    const id = (() => {
        if (globalId && globalId !== '[id]' && typeof globalId === 'string') return globalId;
        if (localId && localId !== '[id]' && typeof localId === 'string') return localId;
        
        // Look for anything that looks like a UUID in segments
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const found = segments.find(s => uuidRegex.test(s));
        if (found) return found;

        if (segments[2] && segments[2] !== '[id]') return segments[2];
        return localId as string;
    })();
    const { data: subject, isLoading: isSubjectLoading } = useSubjectDetailQuery(id as string);
    const { data: queryData = [], isLoading: isMaterialsLoading, refetch: refetchMaterials } = useMaterialsQuery({ 
        subjectId: id as string,
        teacherId: subject?.teacher_id,
        allowFallback: false // Don't show random materials if subject materials are empty
    });
    
    // Use query data directly instead of syncing to local state via useEffect
    const materials = queryData;

    const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
    const [isTeacher, setIsTeacher] = useState(false);
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

    // State to keep track of collapsed sections
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

    const toggleSection = (sectionTitle: string) => {
        setCollapsedSections(prev => ({
            ...prev,
            [sectionTitle]: !prev[sectionTitle]
        }));
    };

    // Grouping materials by weekly lesson number
    const sectionsMap: { [key: string]: any[] } = {};
    materials.forEach((m: any) => {
        const weekNum = m.week_number;
        const key = weekNum ? `Week ${weekNum}` : "General Resources";
        if (!sectionsMap[key]) sectionsMap[key] = [];
        sectionsMap[key].push(m);
    });

    const sortedKeys = Object.keys(sectionsMap).sort((a, b) => {
        if (a === "General Resources") return 1;
        if (b === "General Resources") return -1;
        const numA = parseInt(a.replace("Week ", ""), 10);
        const numB = parseInt(b.replace("Week ", ""), 10);
        return numA - numB;
    });

    const sections = sortedKeys.map(key => {
        const isCollapsed = !!collapsedSections[key];
        return {
            title: key,
            data: isCollapsed ? [] : sectionsMap[key],
            isCollapsed
        };
    });

    if (selectedMaterial) {
        return (
            <DetailedMaterialView 
                material={selectedMaterial} 
                onBack={() => setSelectedMaterial(null)} 
            />
        );
    }

    if (isLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
                <Text style={{ marginTop: 12, color: Colors.light.textSecondary }}>Loading materials...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={{ backgroundColor: '#E0F2FE', padding: 8, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#BAE6FD' }}>
                <Text style={{ fontSize: 10, color: '#0369A1', fontWeight: 'bold' }}>
                    📡 ID: {id} | 📄 Materials: {materials?.length || 0}
                </Text>
            </View>
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.content}
                renderItem={({ item }) => (
                    <MaterialItem
                        title={item.title}
                        type={item.type}
                        date={item.date}
                        onPress={() => setSelectedMaterial(item)}
                    />
                )}
                renderSectionHeader={({ section }) => {
                    const isCollapsed = (section as any).isCollapsed;
                    return (
                        <TouchableOpacity 
                            style={styles.sectionHeaderContainer} 
                            onPress={() => toggleSection(section.title)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.sectionHeaderLeft}>
                                <Ionicons 
                                    name={isCollapsed ? "caret-forward" : "caret-down"} 
                                    size={16} 
                                    color="#1E293B" 
                                    style={{ marginRight: 8 }} 
                                />
                                <Text style={styles.sectionHeaderTitle}>{section.title}</Text>
                            </View>
                            <TouchableOpacity style={styles.moreButton} onPress={(e) => e.stopPropagation()}>
                                <Ionicons name="ellipsis-horizontal" size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="document-outline" size={64} color="#CBD5E1" />
                        <Text style={styles.emptyText}>No materials found for this subject.</Text>
                        <Text style={styles.emptySubText}>
                            When your teacher uploads study materials (PDFs, DOCs), they will appear here.
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
        backgroundColor: "#FFFFFF",
    },
    content: {
        paddingBottom: 100, // Extra space for FAB
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    emptyText: {
        fontSize: 18,
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
        marginBottom: 32,
        alignItems: "center",
        paddingTop: 16,
    },
    itemContainer: {
        backgroundColor: "#FFFFFF",
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    iconWrapper: {
        position: 'relative',
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
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
        fontSize: 7,
        fontWeight: 'bold',
    },
    itemTextContainer: {
        flex: 1,
    },
    title: {
        fontSize: 15,
        fontWeight: "500",
        color: Colors.light.text,
        marginBottom: 2,
    },
    date: {
        fontSize: 12,
        color: Colors.light.textSecondary,
    },
    largeIconPlaceholder: {
        width: 80,
        height: 80,
        backgroundColor: "#F1F5F9",
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    largeIconText: {
        fontSize: 20,
        fontWeight: "bold",
        color: Colors.light.primary,
    },
    detailedTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: Colors.light.text,
        marginBottom: 8,
        textAlign: "center",
    },
    detailedDate: {
        fontSize: 14,
        color: Colors.light.textSecondary,
    },
    actionContainer: {
        marginBottom: 32,
    },
    infoContainer: {
        backgroundColor: "#FFFFFF",
        padding: 20,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: Colors.light.text,
        marginBottom: 8,
    },
    infoText: {
        fontSize: 15,
        color: Colors.light.textSecondary,
        lineHeight: 22,
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
    sectionHeaderContainer: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionHeaderTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
    },
    moreButton: {
        padding: 4,
    },
});
