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
    SafeAreaView 
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
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

    if (!url) return null;

    const lowerUrl = url.toLowerCase();
    const lowerName = (fileName || "").toLowerCase();
    
    // Determine if it's an image
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"];
    const isImage = imageExtensions.some(ext => lowerUrl.endsWith(ext) || lowerName.endsWith(ext)) || lowerUrl.includes("image") || lowerUrl.includes("photo");

    // Determine if it's a PDF
    const isPdf = lowerUrl.endsWith(".pdf") || lowerName.endsWith(".pdf") || lowerUrl.includes("pdf");

    // On Android, WebView does not render PDFs directly. We wrap it in Google Docs Viewer.
    let targetUrl = url;
    if (Platform.OS === "android" && isPdf) {
        targetUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
    }

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
                    {/* Placeholder to balance the header layout */}
                    <View style={styles.placeholder} />
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
    title: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1E293B",
        flex: 1,
        textAlign: "center",
        marginHorizontal: 16,
    },
    placeholder: {
        width: 36,
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
