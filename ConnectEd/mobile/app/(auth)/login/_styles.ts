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
    header: {
        fontSize: 32,
        fontWeight: "bold",
        color: "#1E293B",
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
        elevation: 4,
    },
    loginButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "bold",
    },
    footer: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 32,
    },
    footerText: {
        color: "#64748B",
        fontSize: 14,
    },
    signUpText: {
        color: "#009664",
        fontSize: 14,
        fontWeight: "bold",
    },
});

export default styles;
