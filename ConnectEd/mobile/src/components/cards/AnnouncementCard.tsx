import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, Image } from "react-native";
import Colors from "../../constants/Colors";

interface AnnouncementCardProps {
    title: string;
    content: string;
    date: string;
    author: string;
    author_role?: string;
    image_url?: string;
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
});

export default AnnouncementCard;
