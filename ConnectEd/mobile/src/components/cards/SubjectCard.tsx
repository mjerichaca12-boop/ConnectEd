import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import Colors from "../../constants/Colors";

interface SubjectCardProps {
    title: string;
    code: string;
    teacher: string;
    schedule: string;
    onPress: () => void;
    style?: ViewStyle;
}

export const SubjectCard: React.FC<SubjectCardProps> = ({
    title,
    code,
    teacher,
    schedule,
    onPress,
    style,
}) => {
    return (
        <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.header}>
                <Text style={styles.code}>{code}</Text>
            </View>
            <View style={styles.content}>
                <Text style={styles.title} numberOfLines={2}>{title}</Text>
                <View style={styles.infoRow}>
                    <Text style={styles.label}>Teacher:</Text>
                    <Text style={styles.value}>{teacher}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.label}>Schedule:</Text>
                    <Text style={styles.value}>{schedule}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    header: {
        backgroundColor: Colors.light.primary,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    code: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 14,
    },
    content: {
        padding: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: "bold",
        color: Colors.light.text,
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: "row",
        marginBottom: 4,
    },
    label: {
        color: Colors.light.textSecondary,
        fontSize: 14,
        marginRight: 6,
        fontWeight: "500",
    },
    value: {
        color: Colors.light.text,
        fontSize: 14,
        flex: 1,
    },
});

export default SubjectCard;
