import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F0FAF5", // Keeping the breezy background for registration too? Or maybe white? 
        // Request says "keeps it airy". Let's stick with a light background, maybe white or very light green.
        // The request mentions "background: Full-screen gradient or solid #F0FAF5" for Splash.
        // "Join ConnectEd" background isn't explicitly defined but keeping it #F0FAF5 gives a nice consistency.
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: "center",
        padding: 24,
    },
    header: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#1A202C",
        marginBottom: 24,
        textAlign: "center",
    },
    roleContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 24,
        backgroundColor: "#FFFFFF",
        padding: 4,
        borderRadius: 50,
        // Add subtle shadow to the toggle container
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    roleChip: {
        flex: 1,
        paddingVertical: 10,
        alignItems: "center",
        borderRadius: 24,
    },
    roleChipActive: {
        backgroundColor: "#009664",
    },
    roleChipText: {
        color: "#64748B",
        fontWeight: "600",
        fontSize: 14,
    },
    roleChipTextActive: {
        color: "#FFFFFF",
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 }, // Elevation 2-ish feel
        shadowOpacity: 0.1, // iOS
        shadowRadius: 8,
        elevation: 2, // Android
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        color: "#475569",
        marginBottom: 8,
        fontWeight: "500",
    },
    input: {
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: "#1A202C",
        backgroundColor: "#FAFAFA",
    },
    registerButton: {
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
        elevation: 3,
    },
    registerButtonText: {
        color: "#FFFFFF",
        fontSize: 18,
        fontWeight: "600",
    },
    footer: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 24,
        marginBottom: 20,
    },
    footerText: {
        color: "#64748B",
        fontSize: 14,
    },
    signInText: {
        color: "#009664",
        fontWeight: "bold",
        fontSize: 14,
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
        elevation: 3,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: "#FFFFFF",
        fontSize: 18,
        fontWeight: "600",
    },
    footerLink: {
        color: "#009664",
        fontWeight: "bold",
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    modalSheet: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        maxHeight: "80%",
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1A202C",
        marginBottom: 16,
        textAlign: "center",
    },
    modalOption: {
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    modalOptionText: {
        fontSize: 16,
        color: "#334155",
        textAlign: "center",
    },
    modalCancel: {
        marginTop: 16,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: "#F1F5F9",
    },
    modalCancelText: {
        fontSize: 16,
        color: "#64748B",
        fontWeight: "600",
        textAlign: "center",
    },
    icon: {
        marginRight: 10,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: "600",
        color: "#334155",
        marginBottom: 6,
        marginTop: 12,
    },
    required: {
        color: "#DC2626",
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FAFAFA",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 52,
    },
    inputError: {
        borderColor: "#EF4444",
    },
    strengthBar: {
        height: 4,
        borderRadius: 2,
        marginTop: 6,
        marginBottom: 4,
    },
    strengthWeak: {
        backgroundColor: "#EF4444",
    },
    strengthFair: {
        backgroundColor: "#F59E0B",
    },
    strengthStrong: {
        backgroundColor: "#10B981",
    },
    errorList: {
        marginTop: 6,
        marginBottom: 4,
    },
    errorText: {
        color: "#EF4444",
        fontSize: 12,
        marginTop: 2,
    },
    subtext: {
        fontSize: 15,
        color: "#64748B",
        textAlign: "center",
        marginBottom: 20,
    },
    divider: {
        height: 1,
        backgroundColor: "#E2E8F0",
        marginVertical: 16,
    },
    pickerContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FAFAFA",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 52,
    },
    pickerText: {
        flex: 1,
        fontSize: 16,
    },
    pickerValue: {
        color: "#1E293B",
    },
    pickerPlaceholder: {
        color: "#94A3B8",
    },
});

export default styles;