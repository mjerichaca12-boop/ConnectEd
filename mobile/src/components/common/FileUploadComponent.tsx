import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../../constants/Colors";

interface FileUploadComponentProps {
    onPickFile: () => void;
    onRemoveFile?: () => void;
    fileName?: string;
    fileUri?: string;
    fileType?: string;
    style?: ViewStyle;
}

export const FileUploadComponent: React.FC<FileUploadComponentProps> = ({
    onPickFile,
    onRemoveFile,
    fileName,
    fileUri,
    fileType,
    style,
}) => {
    const isImage = fileType?.startsWith('image/') || fileName?.match(/\.(jpg|jpeg|png|gif)$/i);

    if (fileName) {
        return (
            <View style={[styles.selectedOuterContainer, style]}>
                {/* Preview Container */}
                <View style={styles.selectedContainer}>
                    {fileUri && isImage ? (
                        <View style={styles.previewContainer}>
                            <Image source={{ uri: fileUri }} style={styles.previewImage} />
                        </View>
                    ) : (
                        <View style={styles.selectedContent}>
                            <Ionicons name="document-text" size={32} color={Colors.light.primary} />
                            <Text style={styles.selectedText} numberOfLines={1}>
                                {fileName}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Actions bottom bar */}
                {onRemoveFile && (
                    <View style={styles.actionBar}>
                        <TouchableOpacity 
                            style={styles.actionButtonDanger} 
                            onPress={onRemoveFile}
                            activeOpacity={0.7}
                            accessibilityLabel="Remove selected file"
                        >
                            <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                            <Text style={styles.actionButtonDangerText}>Remove (X)</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    }

    return (
        <View style={[styles.outerContainer, style]}>
            <TouchableOpacity style={styles.container} onPress={onPickFile} activeOpacity={0.7}>
                <View style={styles.content}>
                    <Ionicons 
                        name="cloud-upload-outline" 
                        size={32} 
                        color={Colors.light.primary} 
                    />
                    <Text style={styles.text}>
                        Tap to upload file or image
                    </Text>
                    <Text style={styles.subtext}>Max size: 150MB</Text>
                </View>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    outerContainer: {
        position: "relative",
    },
    container: {
        borderWidth: 2,
        borderColor: Colors.light.primary,
        borderStyle: "dashed",
        borderRadius: 16,
        minHeight: 120,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F0FAF5",
        overflow: "hidden",
    },
    content: {
        alignItems: "center",
        padding: 20,
    },
    text: {
        color: Colors.light.primary,
        fontSize: 16,
        fontWeight: "600",
        marginTop: 12,
        textAlign: "center",
    },
    subtext: {
        color: Colors.light.textSecondary,
        fontSize: 12,
        marginTop: 4,
    },
    selectedOuterContainer: {
        borderWidth: 1.5,
        borderColor: "#E2E8F0",
        borderRadius: 16,
        backgroundColor: "#FFFFFF",
        overflow: "hidden",
    },
    selectedContainer: {
        backgroundColor: "#F8FAFC",
        minHeight: 140,
        justifyContent: "center",
        alignItems: "center",
    },
    selectedContent: {
        alignItems: "center",
        padding: 20,
    },
    selectedText: {
        color: "#1E293B",
        fontSize: 14,
        fontWeight: "600",
        marginTop: 8,
        paddingHorizontal: 16,
        textAlign: "center",
    },
    previewContainer: {
        width: "100%",
        height: 180,
        padding: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    previewImage: {
        width: "100%",
        height: "100%",
        resizeMode: "contain",
        borderRadius: 8,
    },
    actionBar: {
        flexDirection: "row",
        borderTopWidth: 1,
        borderTopColor: "#E2E8F0",
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "flex-start",
    },
    actionButtonDanger: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#FCA5A5",
        backgroundColor: "#FEF2F2",
    },
    actionButtonDangerText: {
        color: "#DC2626",
        fontSize: 13,
        fontWeight: "600",
    },
});

export default FileUploadComponent;
