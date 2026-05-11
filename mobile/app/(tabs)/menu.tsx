import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Colors from "../../src/constants/Colors";
import AppHeader from "../../src/components/common/AppHeader";

export default function MenuScreen() {
    // This screen is just a placeholder - the menu button triggers a bottom sheet instead
    return (
        <View style={styles.container}>
            <AppHeader title="More" />
            <View style={styles.content}>
                <Text style={styles.text}>Use the bottom sheet menu to access more options.</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    text: {
        fontSize: 16,
        color: Colors.light.textSecondary,
        textAlign: "center",
    },
});
