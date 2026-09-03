import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F0FAF5",
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: "center",
    },
    backButton: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 32,
    },
    backText: {
        fontSize: 15,
        color: "#009664",
        fontWeight: "600",
        marginLeft: 4,
    },
    header: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 8,
    },
    subtext: {
        fontSize: 15,
        color: "#64748B",
        marginBottom: 32,
        lineHeight: 22,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 12,
        paddingHorizontal: 16,
        marginBottom: 16,
        height: 56,
    },
    icon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: "#1E293B",
    },
    button: {
        backgroundColor: "#009664",
        borderRadius: 12,
        height: 56,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 8,
        shadowColor: "#009664",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "bold",
    },
    successBanner: {
        backgroundColor: "#ECFDF5",
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: "#6EE7B7",
        alignItems: "center",
    },
    successText: {
        color: "#065F46",
        fontSize: 14,
        lineHeight: 22,
        textAlign: "center",
        fontWeight: "500",
    },
    errorText: {
        fontSize: 13,
        color: "#EF4444",
        marginBottom: 12,
        lineHeight: 20,
    },
});

export default styles;
