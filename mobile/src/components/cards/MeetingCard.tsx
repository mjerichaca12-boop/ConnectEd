import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import Colors from "../../constants/Colors";
import Button from "../common/Button";

interface MeetingCardProps {
    subject: string;
    title: string;
    time: string;
    status?: "Pending" | "Ongoing" | "Done";
    onJoin: () => void;
    style?: ViewStyle;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({
    subject,
    title,
    time,
    status = "Pending",
    onJoin,
    style,
}) => {
    const getStatusColor = () => {
        switch (status) {
            case "Ongoing": return "#EF4444"; // Red
            case "Pending": return "#3B82F6"; // Blue
            case "Done": return "#64748B"; // Slate
            default: return "#64748B";
        }
    };

    const getStatusBg = () => {
        switch (status) {
            case "Ongoing": return "#FEF2F2";
            case "Pending": return "#EFF6FF";
            case "Done": return "#F8FAFC";
            default: return "#F8FAFC";
        }
    };

    return (
        <View style={[styles.card, style]}>
            <View style={[styles.leftBorder, { backgroundColor: getStatusColor() }]} />
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.time}>{time}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusBg() }]}>
                        <Text style={[styles.statusText, { color: getStatusColor() }]}>{status}</Text>
                    </View>
                </View>
                <Text style={styles.subject}>{subject}</Text>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                <View style={styles.actionContainer}>
                    {status !== "Done" && (
                        <Button
                            title={status === "Ongoing" ? "Join Meeting" : "Waiting..."}
                            onPress={onJoin}
                            size="small"
                            disabled={status === "Pending"}
                            style={[styles.button, status === "Ongoing" ? { backgroundColor: "#EF4444" } : {}]}
                        />
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
        flexDirection: "row",
        overflow: "hidden",
    },
    leftBorder: {
        width: 6,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    time: {
        fontWeight: "700",
        fontSize: 14,
        color: Colors.light.text,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    statusText: {
        fontSize: 10,
        fontWeight: "bold",
        textTransform: "uppercase",
    },
    subject: {
        fontSize: 12,
        color: Colors.light.primary,
        fontWeight: "600",
        marginBottom: 2,
    },
    title: {
        fontSize: 16,
        color: Colors.light.text,
        fontWeight: "700",
        marginBottom: 12,
    },
    actionContainer: {
        alignItems: "flex-start",
    },
    button: {
        height: 36,
    },
});

export default MeetingCard;
