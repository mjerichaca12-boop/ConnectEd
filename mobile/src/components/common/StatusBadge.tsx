import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import Colors from "../../constants/Colors";

interface StatusBadgeProps {
    status: "pending" | "submitted" | "late" | "graded" | "approved" | "rejected";
    style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, style }) => {
    const getStyles = () => {
        switch (status) {
            case "pending":
                return { bg: "#FFF7ED", text: "#EA580C" }; // Orange
            case "submitted":
                return { bg: "#F0FDFA", text: "#0D9488" }; // Teal (close to primary)
            case "approved":
            case "graded":
                return { bg: "#F0FDF4", text: "#16A34A" }; // Green
            case "late":
            case "rejected":
                return { bg: "#FEF2F2", text: "#DC2626" }; // Red
            default:
                return { bg: "#F1F5F9", text: "#64748B" }; // Gray
        }
    };

    const { bg, text } = getStyles();

    return (
        <View style={[styles.container, { backgroundColor: bg }, style]}>
            <Text style={[styles.text, { color: text }]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: "flex-start",
    },
    text: {
        fontSize: 12,
        fontWeight: "600",
    },
});

export default StatusBadge;
