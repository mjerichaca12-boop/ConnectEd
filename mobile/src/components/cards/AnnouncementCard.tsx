import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, Image } from "react-native";
import Colors from "../../constants/Colors";
import { Ionicons } from "@expo/vector-icons";

interface AnnouncementCardProps {
    title: string;
    content: string;
    date: string;
    author: string;
    author_role?: string;
    image_url?: string;
    attachments?: Array<{ file_name: string; file_url?: string; file_type?: string }>;
    onPress: () => void;
    style?: ViewStyle;
}

export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
    title,
    content,
    date,
    author,
    author_role,
    image_url,
    attachments,
    onPress,
    style,
}) => {
    return (
        <TouchableOpacity style={[styles.card, style]} onPress={onPress}>
            <View style={styles.header}>
                <Text style={styles.author}>{author} {author_role ? `(${author_role})` : ''}</Text>
                <Text style={styles.date}>{date}</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            {image_url && (
                <View style={styles.imageContainer}>
                    <Image source={{ uri: image_url }} style={styles.image} resizeMode="cover" />
                </View>
            )}
            <Text style={styles.content} numberOfLines={3}>{content}</Text>
            
            {attachments && attachments.length > 0 && (
                <View style={styles.attachmentsRow}>
                    {attachments.map((att, idx) => (
                        <View key={idx} style={styles.attachmentPill}>
                            <Ionicons name={"paper-clip" as any} size={14} color={Colors.light.primary} />
                            <Text style={styles.attachmentText} numberOfLines={1}>
                                {att.file_name || "Attached File"}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: Colors.light.primary,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    imageContainer: {
        marginBottom: 10,
        borderRadius: 8,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: 150,
    },
    author: {
        fontSize: 12,
        fontWeight: "600",
        color: Colors.light.primary,
        backgroundColor: "#F0FAF5",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    date: {
        fontSize: 12,
        color: Colors.light.textSecondary,
    },
    title: {
        fontSize: 16,
        fontWeight: "700",
        color: Colors.light.text,
        marginBottom: 6,
    },
    content: {
        fontSize: 14,
        color: Colors.light.textSecondary,
        lineHeight: 20,
    },
    attachmentsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
    },
    attachmentPill: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 4,
        maxWidth: '100%',
    },
    attachmentText: {
        fontSize: 12,
        fontWeight: "500",
        color: "#334155",
        flexShrink: 1,
    },
});

export default AnnouncementCard;
