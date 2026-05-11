import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface StatCardProps {
    label: string;
    value: string;
    icon?: React.ReactNode;
}

export default function StatCard({ label, value, icon }: StatCardProps) {
    return (
        <View style={styles.card}>
            <View style={styles.content}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.value}>{value}</Text>
            </View>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        flex: 1,
        marginHorizontal: 4,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    content: {
        flex: 1,
    },
    label: {
        fontSize: 12,
        color: "#64748B",
        marginBottom: 4,
        fontWeight: "500",
    },
    value: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#1E293B",
    },
    iconContainer: {
        marginLeft: 8,
    },
});
