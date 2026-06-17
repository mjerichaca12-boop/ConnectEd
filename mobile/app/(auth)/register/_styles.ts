import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F0FAF5",
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 60,
    },
    header: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 6,
    },
    subtext: {
        fontSize: 15,
        color: "#64748B",
        marginBottom: 28,
        lineHeight: 22,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: "600",
        color: "#475569",
        marginBottom: 6,
        marginTop: 4,
    },
    required: {
        color: "#EF4444",
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 12,
        paddingHorizontal: 16,
        marginBottom: 14,
        height: 56,
    },
    inputError: {
        borderColor: "#EF4444",
    },
    icon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: "#1E293B",
    },
    pickerContainer: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 12,
        marginBottom: 14,
        height: 56,
        justifyContent: "center",
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
    },
    pickerText: {
        flex: 1,
        fontSize: 16,
    },
    pickerPlaceholder: {
        color: "#94A3B8",
    },
    pickerValue: {
        color: "#1E293B",
    },
    strengthBar: {
        height: 4,
        borderRadius: 2,
        marginTop: -10,
        marginBottom: 8,
    },
    strengthWeak: { backgroundColor: "#EF4444" },
    strengthFair: { backgroundColor: "#F59E0B" },
    strengthStrong: { backgroundColor: "#10B981" },
    errorList: {
        marginBottom: 10,
        paddingLeft: 4,
    },
    errorText: {
        fontSize: 12,
        color: "#EF4444",
        marginBottom: 2,
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
    footer: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 24,
    },
    footerText: {
        color: "#64748B",
        fontSize: 14,
    },
    footerLink: {
        color: "#009664",
        fontSize: 14,
        fontWeight: "bold",
    },
    successBanner: {
        backgroundColor: "#ECFDF5",
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "#6EE7B7",
    },
    successText: {
        color: "#065F46",
        fontSize: 14,
        lineHeight: 22,
        fontWeight: "500",
    },
    divider: {
        height: 1,
        backgroundColor: "#E2E8F0",
        marginVertical: 20,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "flex-end",
    },
    modalSheet: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        paddingBottom: 40,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 16,
    },
    modalOption: {
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    modalOptionText: {
        fontSize: 16,
        color: "#1E293B",
    },
    modalCancel: {
        marginTop: 16,
        alignItems: "center",
    },
    modalCancelText: {
        fontSize: 16,
        color: "#EF4444",
        fontWeight: "600",
    },
});

export default styles;
