import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from "react-native";
import Colors from "../../constants/Colors";

interface ButtonProps {
    onPress: () => void;
    title: string;
    variant?: "primary" | "secondary" | "outline" | "ghost";
    size?: "small" | "medium" | "large";
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
    onPress,
    title,
    variant = "primary",
    size = "medium",
    disabled = false,
    loading = false,
    style,
    textStyle,
}) => {
    const getBackgroundColor = () => {
        if (disabled) return "#CBD5E1";
        switch (variant) {
            case "primary": return Colors.light.primary;
            case "secondary": return "#E2E8F0";
            case "outline": return "transparent";
            case "ghost": return "transparent";
            default: return Colors.light.primary;
        }
    };

    const getTextColor = () => {
        if (disabled) return "#94A3B8";
        switch (variant) {
            case "primary": return "#FFFFFF";
            case "secondary": return "#1A202C";
            case "outline": return Colors.light.primary;
            case "ghost": return Colors.light.textSecondary;
            default: return "#FFFFFF";
        }
    };

    const getHeight = () => {
        switch (size) {
            case "small": return 32;
            case "medium": return 48;
            case "large": return 56;
            default: return 48;
        }
    };

    const handlePress = () => {
        if (typeof onPress === 'function') {
            onPress();
        }
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            disabled={disabled || loading}
            style={[
                styles.container,
                {
                    backgroundColor: getBackgroundColor(),
                    height: getHeight(),
                    borderColor: variant === "outline" ? Colors.light.primary : "transparent",
                    borderWidth: variant === "outline" ? 1 : 0,
                },
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} />
            ) : (
                <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
                    {typeof title === 'string' ? title : String(title || '')}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 16,
    },
    text: {
        fontWeight: "600",
        fontSize: 16,
    },
});

export default Button;
