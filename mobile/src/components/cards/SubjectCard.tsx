import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../../constants/Colors";

interface SubjectCardProps {
    title: string;
    code: string;
    teacher: string;
    schedule: string;
    credits?: number;
    description?: string;
    gradeLevel?: string;
    capacity?: number | string;
    enrolled?: number | string;
    onPress: () => void;
    style?: ViewStyle;
}

export const SubjectCard: React.FC<SubjectCardProps> = ({
    title,
    code,
    teacher,
    schedule,
    credits,
    description,
    gradeLevel,
    capacity,
    enrolled,
    onPress,
    style,
}) => {
    // Safely parse capacity and enrolled
    const parsedCapacity = Number(capacity) || 40;
    const parsedEnrolled = Number(enrolled) || 0;
    const progressPercent = Math.min(100, Math.max(0, (parsedEnrolled / parsedCapacity) * 100));

    return (
        <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.7}>
            {/* Soft Pastel Green Header */}
            <View style={styles.header}>
                <Text style={styles.code}>{code}</Text>
            </View>

            {/* Card Content Body */}
            <View style={styles.content}>
                {/* Subject Title */}
                <Text style={styles.title} numberOfLines={2}>{title}</Text>

                {/* Subject Description */}
                {description ? (
                    <Text style={styles.description} numberOfLines={3}>{description}</Text>
                ) : null}

                {/* Teacher Info Row */}
                <View style={styles.infoRow}>
                    <Ionicons name="person-outline" size={16} color="#64748B" style={styles.icon} />
                    <Text style={styles.value}>{teacher}</Text>
                </View>

                {/* Grade Level Info Row */}
                {gradeLevel ? (
                    <View style={styles.infoRow}>
                        <Ionicons name="book-outline" size={16} color="#64748B" style={styles.icon} />
                        <Text style={styles.value}>{gradeLevel}</Text>
                    </View>
                ) : null}

                {/* Schedule Info Row */}
                <View style={styles.infoRow}>
                    <Ionicons name="time-outline" size={16} color="#64748B" style={styles.icon} />
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
        backgroundColor: "#E2F1E7",
        paddingVertical: 10,
        paddingHorizontal: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#D1E7DD",
    },
    code: {
        color: "#1B4232",
        fontWeight: "700",
        fontSize: 14,
    },
    credits: {
        color: "#1B4232",
        fontWeight: "600",
        fontSize: 12,
        backgroundColor: "rgba(27, 66, 50, 0.08)",
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    content: {
        padding: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: "bold",
        color: Colors.light.text,
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: "#64748B",
        marginBottom: 12,
        lineHeight: 18,
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    icon: {
        marginRight: 8,
    },
    value: {
        color: "#475569",
        fontSize: 14,
        flex: 1,
    },
    enrollmentContainer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
    },
    enrollmentLabel: {
        color: "#64748B",
        fontSize: 12,
        fontWeight: "600",
        marginBottom: 4,
    },
    enrollmentValue: {
        color: "#1E293B",
        fontSize: 14,
        fontWeight: "700",
        marginBottom: 6,
    },
    progressBarBg: {
        height: 6,
        backgroundColor: "#E2E8F0",
        borderRadius: 3,
        overflow: "hidden",
    },
    progressBarFill: {
        height: "100%",
        backgroundColor: "#10B981",
        borderRadius: 3,
    },
});

export default SubjectCard;
