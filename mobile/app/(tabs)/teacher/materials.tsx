import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../../src/components/common/AppHeader";
import Colors from "../../../src/constants/Colors";
import { useMaterialsQuery } from "../../../src/hooks/query/materials/use-materials-query";
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function TeacherMaterialsScreen() {
    // Passing undefined for subjectId to fetch ALL materials for the current teacher (as per my update to getMaterials)
    const { data: materials = [], isLoading } = useMaterialsQuery({ subjectId: undefined as any });

    const handleDownload = async (material: any) => {
        if (!material.file_url) {
            Alert.alert("Error", "No file attached.");
            return;
        }

        try {
            const storageDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
            if (!storageDir) {
                Linking.openURL(material.file_url);
                return;
            }

            const fileName = `${material.title.replace(/\s+/g, '_')}`;
            const fileUri = storageDir.endsWith('/') ? `${storageDir}${fileName}` : `${storageDir}/${fileName}`;
            
            const { uri } = await FileSystem.downloadAsync(material.file_url, fileUri);
            
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            }
        } catch (error) {
            console.error('Download error:', error);
            Linking.openURL(material.file_url);
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.itemCard}>
            <View style={styles.iconBox}>
                <Ionicons 
                    name={item.type === 'pdf' ? "document-text" : "document"} 
                    size={28} 
                    color={Colors.light.primary} 
                />
            </View>
            <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.meta}>{item.date} • {item.type.toUpperCase()}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDownload(item)} style={styles.downloadBtn}>
                <Ionicons name="download-outline" size={20} color={Colors.light.primary} />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <AppHeader title="All Materials" showBack={true} />
            
            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                </View>
            ) : materials.length > 0 ? (
                <FlatList
                    data={materials}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                />
            ) : (
                <View style={styles.centered}>
                    <Ionicons name="document-outline" size={64} color="#CBD5E1" />
                    <Text style={styles.emptyText}>No materials uploaded yet</Text>
                </View>
            )}
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
        padding: 20,
    },
    list: {
        padding: 16,
    },
    itemCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF",
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: "#F0FDF4",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 16,
    },
    info: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#1E293B",
    },
    meta: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 2,
    },
    downloadBtn: {
        padding: 8,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: "#94A3B8",
    }
});
