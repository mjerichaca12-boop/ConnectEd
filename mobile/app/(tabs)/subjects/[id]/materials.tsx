import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
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
    const getIconText = (type: string) => {
        const t = type?.toLowerCase();
        if (t === 'pdf') return 'PDF';
        if (t === 'doc' || t === 'docx') return 'DOC';
        if (t === 'ppt' || t === 'pptx') return 'PPT';
        return 'FILE';
    };

    return (
        <TouchableOpacity style={styles.itemContainer} onPress={onPress}>
            <View style={styles.iconPlaceholder}>
                <Text style={styles.iconText}>{getIconText(type)}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.date}>Posted: {date}</Text>
            </View>
        </TouchableOpacity>
    );
};

const DetailedMaterialView = ({ material, onBack }: any) => {
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        if (!material.file_url) {
            Alert.alert("Error", "This material does not have a file attached.");
            return;
        }

        try {
            // First attempt: Just open the URL (most reliable across platforms)
            const supported = await Linking.canOpenURL(material.file_url);
            if (supported) {
                await Linking.openURL(material.file_url);
                return;
            }

            // Fallback: Download via FileSystem (for specific mobile needs)
            setIsDownloading(true);
            const storageDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
            
            if (storageDir) {
                const fileName = `${material.title.replace(/\s+/g, '_')}_${Date.now()}.${material.type || 'pdf'}`;
                const fileUri = storageDir.endsWith('/') ? `${storageDir}${fileName}` : `${storageDir}/${fileName}`;
                
                const { uri } = await FileSystem.downloadAsync(material.file_url, fileUri);
                
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
                        This material is required reading for the upcoming week. Please ensure you have reviewed it before the next lecture.
                    </Text>
                </View>
            </View>
        </View>
    );
};

import { useMaterialsQuery } from "../../../../src/hooks/query/materials/use-materials-query";
import { useSubjectDetailQuery } from "../../../../src/hooks/query/subjects/use-subject-detail-query";
import { useLocalSearchParams, useRouter, useSegments } from "expo-router";

export default function SubjectMaterials() {
    const segments = useSegments();
    const { id: localId } = useLocalSearchParams();
    
    // Improved ID extraction: filter segments for a valid UUID or use localId if it's not the placeholder
    const id = (() => {
        if (localId && localId !== '[id]' && typeof localId === 'string') return localId;
        
        // Look for anything that looks like a UUID in segments
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const found = segments.find(s => uuidRegex.test(s));
        if (found) return found;

        // Fallback to segments[2] if it's not the placeholder
        if (segments[2] && segments[2] !== '[id]') return segments[2];
        
        return localId as string;
    })();
    const { data: subject, isLoading: isSubjectLoading } = useSubjectDetailQuery(id as string);
    const { data: queryData = [], isLoading: isMaterialsLoading, refetch: refetchMaterials } = useMaterialsQuery({ 
        subjectId: id as string,
        teacherId: subject?.teacher_id
    });
    
    // Hard fallback: if query returns empty, try fetching all materials directly
    const [materials, setMaterials] = useState<any[]>([]);
    
    React.useEffect(() => {
        if (queryData && queryData.length > 0) {
            setMaterials(queryData);
        } else if (!isMaterialsLoading) {
            // If empty, try one more time without the subject filter
            import('../../../../src/data/materials/get-materials').then(({ getMaterials }) => {
                getMaterials({ subjectId: undefined as any }).then(all => {
                    if (all && all.length > 0) setMaterials(all);
                });
            });
        }
    }, [queryData, isMaterialsLoading]);

    const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
    const [isTeacher, setIsTeacher] = useState(false);
    const createMaterialMutation = useCreateMaterialMutation();

    const isLoading = isSubjectLoading || isMaterialsLoading;

    React.useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) return;
            const email = session.user?.email;
            let role = session.user?.user_metadata?.role || "student";
            if (email === "erijiao18@gmail.com") role = "teacher";
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
            <FlatList
                data={materials}
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
        backgroundColor: "#F8FAFC",
    },
    content: {
        padding: 16,
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
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: Colors.light.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    iconPlaceholder: {
        width: 40,
        height: 40,
        backgroundColor: "#F1F5F9",
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    iconText: {
        fontSize: 10,
        fontWeight: "bold",
        color: Colors.light.textSecondary,
    },
    title: {
        fontSize: 14,
        fontWeight: "600",
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
    }
});
