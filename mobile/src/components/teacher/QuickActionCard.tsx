import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../../constants/Colors";

interface QuickActionCardProps {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    color?: string;
}

export default function QuickActionCard({ title, icon, onPress, color = Colors.light.forestGreen }: QuickActionCardProps) {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress}>
            <View style={[styles.iconContainer, { backgroundColor: color + "1A" }]}>
                <Ionicons name={icon} size={28} color={color} />
            </View>
            <Text style={styles.title}>{title}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        width: "48%",
        marginBottom: 16,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 12,
    },
    title: {
        fontSize: 14,
        fontWeight: "600",
        color: "#1E293B",
        textAlign: "center",
    },
});
