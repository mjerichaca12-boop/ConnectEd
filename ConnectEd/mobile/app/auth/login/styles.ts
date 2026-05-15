import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 24,
    },
    header: {
        fontSize: 32,
        fontWeight: "bold",
        color: "#1A202C", // Deep Charcoal
        marginBottom: 8,
    },
    subtext: {
        fontSize: 16,
        color: "#64748B",
        marginBottom: 32,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 12,
        marginBottom: 16,
        paddingHorizontal: 16,
        height: 56,
        backgroundColor: "#FAFAFA",
    },
    icon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: "#1A202C",
        height: "100%",
    },
    loginButton: {
        backgroundColor: "#009664",
        borderRadius: 12,
        height: 56,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 16,
        shadowColor: "#009664",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
    },
    loginButtonText: {
        color: "#FFFFFF",
        fontSize: 18,
        fontWeight: "600",
    },
    footer: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 32,
    },
    footerText: {
        fontSize: 14,
        color: "#64748B",
    },
    signUpText: {
        fontSize: 14,
        color: "#009664",
        fontWeight: "bold",
    },
});

export default styles;