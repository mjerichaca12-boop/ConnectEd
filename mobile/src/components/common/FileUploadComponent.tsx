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

    return (
        <View style={[styles.outerContainer, style]}>
            <TouchableOpacity style={styles.container} onPress={onPickFile}>
                {fileUri && isImage ? (
                    <View style={styles.previewContainer}>
                        <Image source={{ uri: fileUri }} style={styles.previewImage} />
                        <View style={styles.overlay}>
                            <Ionicons name="camera" size={20} color="#FFF" />
                            <Text style={styles.overlayText}>Change</Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.content}>
                        <Ionicons 
                            name={fileName ? "document-text" : "cloud-upload-outline"} 
                            size={32} 
                            color={Colors.light.primary} 
                        />
                        <Text style={styles.text}>
                            {fileName ? fileName : "Tap to upload file or image"}
                        </Text>
                        {!fileName && <Text style={styles.subtext}>Max size: 150MB</Text>}
                    </View>
                )}
            </TouchableOpacity>

            {fileName && onRemoveFile && (
                <TouchableOpacity 
                    style={styles.removeButton} 
                    onPress={onRemoveFile}
                    activeOpacity={0.7}
                >
                    <Ionicons name="close" size={20} color="#FFF" />
                </TouchableOpacity>
            )}
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
    removeButton: {
        position: "absolute",
        top: 8,
        right: 8,
        backgroundColor: "rgba(239, 68, 68, 0.9)",
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    content: {
        alignItems: "center",
        padding: 20,
    },
    previewContainer: {
        width: "100%",
        height: 120,
        justifyContent: "center",
        alignItems: "center",
    },
    previewImage: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.3)",
        justifyContent: "center",
        alignItems: "center",
    },
    overlayText: {
        color: "#FFF",
        fontWeight: "600",
        marginTop: 4,
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
});

export default FileUploadComponent;
