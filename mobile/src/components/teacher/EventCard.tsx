import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../../constants/Colors";

interface EventCardProps {
    title: string;
    date: string;
    type: "exam" | "event" | "deadline";
}

export default function EventCard({ title, date, type }: EventCardProps) {
    const getIcon = () => {
        switch (type) {
            case "exam": return "document-text-outline";
            case "event": return "star-outline";
            case "deadline": return "time-outline";
            default: return "notifications-outline";
        }
    };

    const getColor = () => {
        switch (type) {
            case "exam": return "#3B82F6"; // Blue
            case "event": return Colors.light.forestGreen;
            case "deadline": return "#EF4444"; // Red
            default: return "#64748B";
        }
    };

    const color = getColor();

    return (
        <View style={styles.card}>
            <View style={[styles.iconContainer, { backgroundColor: color + "1A" }]}>
                <Ionicons name={getIcon()} size={20} color={color} />
            </View>
            <View style={styles.content}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.date}>{date}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 16,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1E293B",
    },
    date: {
        fontSize: 13,
        color: "#64748B",
        marginTop: 2,
    },
});
