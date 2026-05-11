import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Colors from "../../constants/Colors";

interface WelcomeBannerProps {
    name: string;
}

export default function WelcomeBanner({ name }: WelcomeBannerProps) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Welcome,</Text>
            <Text style={styles.name}>{name}!</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.light.forestGreen,
        borderRadius: 20,
        padding: 24,
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    title: {
        fontSize: 16,
        color: "#D1FAE5",
        fontWeight: "500",
    },
    name: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#FFFFFF",
        marginTop: 4,
    },
});
