import React from "react";
import { View, Text, TextInput, StyleSheet, TextInputProps, ViewStyle } from "react-native";
import Colors from "../../constants/Colors";

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    containerStyle,
    style,
    ...props
}) => {
    return (
        <View style={[styles.container, containerStyle]}>
            {label && <Text style={styles.label}>{label}</Text>}
            <TextInput
                style={[
                    styles.input,
                    error ? styles.inputError : null,
                    style,
                ]}
                placeholderTextColor="#94A3B8"
                {...props}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        color: Colors.light.textSecondary,
        marginBottom: 8,
        fontWeight: "500",
    },
    input: {
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: Colors.light.text,
        backgroundColor: "#FAFAFA",
    },
    inputError: {
        borderColor: Colors.light.error,
    },
    errorText: {
        color: Colors.light.error,
        fontSize: 12,
        marginTop: 4,
    },
});

export default Input;
