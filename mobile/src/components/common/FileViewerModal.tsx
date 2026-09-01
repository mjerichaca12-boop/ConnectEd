import React, { useState } from "react";
import { 
    Modal, 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    ActivityIndicator, 
    Platform, 
    Image, 
    SafeAreaView,
    Alert
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import Colors from "../../constants/Colors";

interface FileViewerModalProps {
    visible: boolean;
    onClose: () => void;
    url: string | null;
    fileName: string | null;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
    visible,
    onClose,
    url,
    fileName,
}) => {
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);

    if (!url) return null;

    const lowerUrl = url.toLowerCase();
    const lowerName = (fileName || "").toLowerCase();
    
    // Determine if it's an image
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".heic"];
    const isImage = imageExtensions.some(ext => lowerUrl.endsWith(ext) || lowerName.endsWith(ext)) || lowerUrl.includes("image") || lowerUrl.includes("photo");

    // Determine if it's a doc (PDF, docx, etc.)
    const docExtensions = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt", ".csv"];
    const isDoc = docExtensions.some(ext => lowerUrl.endsWith(ext) || lowerName.endsWith(ext)) || lowerUrl.includes("pdf");

    // On Android, WebView does not render raw PDF/DOC directly. We wrap it in Google Docs Viewer.
    let targetUrl = url;
    if (Platform.OS === "android" && (isDoc || !isImage)) {
        targetUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
    }

    const handleDownload = async () => {
        if (!url) return;
        try {
            setDownloading(true);
            if (isImage) {
                const { status } = await MediaLibrary.requestPermissionsAsync();
                if (status === 'granted') {
                    const storageDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
                    if (storageDir) {
                        const cleanExt = lowerUrl.split('?')[0].split('.').pop() || 'jpg';
                        const fileUri = `${storageDir}/photo_${Date.now()}.${cleanExt}`;
                        const { uri } = await FileSystem.downloadAsync(url, fileUri);
                        await MediaLibrary.saveToLibraryAsync(uri);
                        Alert.alert("Saved", "Photo saved to gallery!");
                        return;
                    }
                }
            }

            const storageDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
            if (storageDir) {
                const cleanName = fileName || `file_${Date.now()}`;
                const fileUri = `${storageDir}/${cleanName}`;
                const { uri } = await FileSystem.downloadAsync(url, fileUri);
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri);
                } else {
                    Alert.alert("Success", "File downloaded successfully.");
                }
            }
        } catch (err: any) {
            console.error("Viewer download error:", err);
            Alert.alert("Download Error", err.message || "Failed to download file");
        } finally {
            setDownloading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close file viewer">
                        <Ionicons name="close-outline" size={28} color="#1E293B" />
                    </TouchableOpacity>
                    <Text style={styles.title} numberOfLines={1}>
                        {fileName || "File Viewer"}
                    </Text>
                    <TouchableOpacity onPress={handleDownload} style={styles.downloadButton} disabled={downloading}>
                        {downloading ? (
                            <ActivityIndicator size="small" color={Colors.light.primary} />
                        ) : (
                            <Ionicons name="download-outline" size={24} color={Colors.light.primary} />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Content Container */}
                <View style={styles.content}>
                    {isImage ? (
                        <View style={styles.imageContainer}>
                            <Image
                                source={{ uri: url }}
                                style={styles.image}
                                resizeMode="contain"
                                onLoadStart={() => setLoading(true)}
                                onLoadEnd={() => setLoading(false)}
                            />
                            {loading && (
                                <ActivityIndicator 
                                    size="large" 
                                    color={Colors.light.primary} 
                                    style={styles.loadingIndicator} 
                                />
                            )}
                        </View>
                    ) : (
                        <View style={styles.webviewContainer}>
                            <WebView
                                source={{ uri: targetUrl }}
                                style={styles.webview}
                                onLoadStart={() => setLoading(true)}
                                onLoadEnd={() => setLoading(false)}
                                startInLoadingState={true}
                                renderLoading={() => (
                                    <ActivityIndicator 
                                        size="large" 
                                        color={Colors.light.primary} 
                                        style={styles.loadingIndicator} 
                                    />
                                )}
                            />
                        </View>
                    )}
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    header: {
        height: 56,
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        backgroundColor: "#FFFFFF",
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 1,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    closeButton: {
        padding: 4,
    },
    downloadButton: {
        padding: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1E293B",
        flex: 1,
        textAlign: "center",
        marginHorizontal: 12,
    },
    content: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    imageContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
    },
    image: {
        width: "100%",
        height: "100%",
    },
    webviewContainer: {
        flex: 1,
    },
    webview: {
        flex: 1,
    },
    loadingIndicator: {
        position: "absolute",
        alignSelf: "center",
        top: "50%",
        transform: [{ translateY: -20 }],
    },
});

export default FileViewerModal;
