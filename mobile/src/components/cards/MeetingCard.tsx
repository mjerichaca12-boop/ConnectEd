import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import Colors from "../../constants/Colors";
import Button from "../common/Button";

interface MeetingCardProps {
    subject: string;
    title: string;
    time: string;
    duration: string;
    onJoin: () => void;
    style?: ViewStyle;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({
    subject,
    title,
    time,
    duration,
    onJoin,
    style,
}) => {
    return (
        <View style={[styles.card, style]}>
            <View style={styles.leftBorder} />
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.time}>{time}</Text>
                    <Text style={styles.duration}>• {duration}</Text>
                </View>
                <Text style={styles.subject}>{subject}</Text>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                <View style={styles.actionContainer}>
                    <Button
                        title="Join Meeting"
                        onPress={onJoin}
                        size="small"
                        style={styles.button}
                    />
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
        backgroundColor: Colors.light.primary,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 4,
    },
    time: {
        fontWeight: "700",
        fontSize: 14,
        color: Colors.light.text,
    },
    duration: {
        fontSize: 12,
        color: Colors.light.textSecondary,
        marginLeft: 4,
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
