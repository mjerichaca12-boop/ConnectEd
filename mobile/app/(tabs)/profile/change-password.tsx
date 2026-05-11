import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    StatusBar,
    ScrollView,
    ActivityIndicator,
    Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../../../src/constants/Colors";
import AppHeader from "../../../src/components/common/AppHeader";
import { supabase } from "../../../src/lib/supabase";

function validatePassword(password: string): string | null {
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password.length > 12) return "Password must be at most 12 characters.";
    const specialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/;
    if (!specialChar.test(password)) return "Password must contain at least 1 special character.";
    const numbers = password.replace(/\D/g, "");
    if (numbers.length < 2) return "Password must contain at least 2 numbers.";
    return null;
}

export default function ChangePasswordScreen() {
    const router = useRouter();
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [modalConfig, setModalConfig] = useState({ visible: false, success: false, message: "" });

    const handleReset = async () => {
        const validationError = validatePassword(newPassword);
        if (validationError) {
            setModalConfig({ visible: true, success: false, message: validationError });
            return;
        }
        if (newPassword !== confirmPassword) {
            setModalConfig({ visible: true, success: false, message: "Passwords do not match." });
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            setModalConfig({
                visible: true,
                success: true,
                message: "Your password has been updated successfully!",
            });
        } catch (err: any) {
            setModalConfig({
                visible: true,
                success: false,
                message: err?.message || "Failed to update password. Please try again.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.light.forestGreen} />
            <AppHeader
                title="Change Password"
                showBack={true}
                onBack={() => router.back()}
            />
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

                <View style={styles.iconBox}>
                    <Ionicons name="lock-closed" size={44} color={Colors.light.primary} />
                </View>

                <Text style={styles.pageTitle}>Create New Password</Text>
                <Text style={styles.pageSubtitle}>
                    Your new password must be 8–12 characters and include at least 1 special character and 2 numbers.
                </Text>

                {/* New Password */}
                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>New Password</Text>
                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={styles.input}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry={!showNew}
                            placeholder="Enter new password"
                            placeholderTextColor="#94A3B8"
                            maxLength={12}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity onPress={() => setShowNew(v => !v)} style={styles.eyeBtn}>
                            <Ionicons name={showNew ? "eye-off-outline" : "eye-outline"} size={20} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>

                    {/* Requirements checklist */}
                    <View style={styles.requirements}>
                        <RequirementRow met={newPassword.length >= 8 && newPassword.length <= 12} text="8–12 characters" />
                        <RequirementRow met={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)} text="At least 1 special character" />
                        <RequirementRow met={newPassword.replace(/\D/g, "").length >= 2} text="At least 2 numbers" />
                    </View>
                </View>

                {/* Confirm Password */}
                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Confirm Password</Text>
                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={styles.input}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirm}
                            placeholder="Re-enter new password"
                            placeholderTextColor="#94A3B8"
                            maxLength={12}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                            <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={20} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                    {confirmPassword.length > 0 && (
                        <Text style={[styles.matchText, newPassword === confirmPassword ? styles.matchOk : styles.matchErr]}>
                            {newPassword === confirmPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
                        </Text>
                    )}
                </View>

                <TouchableOpacity
                    style={[styles.resetBtn, isLoading && styles.resetBtnDisabled]}
                    onPress={handleReset}
                    disabled={isLoading}
                    activeOpacity={0.85}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.resetBtnText}>Reset Password</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>

            <Modal
                transparent
                visible={modalConfig.visible}
                animationType="fade"
                onRequestClose={() => setModalConfig(p => ({ ...p, visible: false }))}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Ionicons
                            name={modalConfig.success ? "checkmark-circle" : "alert-circle"}
                            size={52}
                            color={modalConfig.success ? Colors.light.primary : "#EF4444"}
                        />
                        <Text style={styles.modalTitle}>{modalConfig.success ? "Success!" : "Error"}</Text>
                        <Text style={styles.modalMessage}>{modalConfig.message}</Text>
                        <TouchableOpacity
                            style={[styles.modalBtn, !modalConfig.success && styles.modalBtnErr]}
                            onPress={() => {
                                setModalConfig(p => ({ ...p, visible: false }));
                                if (modalConfig.success) router.back();
                            }}
                        >
                            <Text style={styles.modalBtnText}>{modalConfig.success ? "Done" : "OK"}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function RequirementRow({ met, text }: { met: boolean; text: string }) {
    return (
        <View style={reqStyles.row}>
            <Ionicons
                name={met ? "checkmark-circle" : "ellipse-outline"}
                size={16}
                color={met ? Colors.light.primary : "#94A3B8"}
            />
            <Text style={[reqStyles.text, met && reqStyles.textMet]}>{text}</Text>
        </View>
    );
}

const reqStyles = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", marginTop: 6 },
    text: { fontSize: 13, color: "#94A3B8", marginLeft: 8 },
    textMet: { color: Colors.light.primary, fontWeight: "600" },
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    content: {
        padding: 24,
        paddingBottom: 48,
    },
    iconBox: {
        alignSelf: "center",
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: Colors.light.primary + "15",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
        marginTop: 8,
    },
    pageTitle: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#1E293B",
        textAlign: "center",
        marginBottom: 10,
    },
    pageSubtitle: {
        fontSize: 14,
        color: "#64748B",
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 32,
    },
    fieldGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 15,
        fontWeight: "600",
        color: "#1E293B",
        marginBottom: 10,
    },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        paddingHorizontal: 16,
        height: 52,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: "#1E293B",
    },
    eyeBtn: {
        padding: 4,
    },
    requirements: {
        marginTop: 12,
        paddingLeft: 4,
    },
    matchText: {
        marginTop: 8,
        fontSize: 13,
        fontWeight: "600",
        paddingLeft: 4,
    },
    matchOk: { color: Colors.light.primary },
    matchErr: { color: "#EF4444" },
    resetBtn: {
        backgroundColor: Colors.light.primary,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: "center",
        marginTop: 8,
    },
    resetBtnDisabled: {
        opacity: 0.6,
    },
    resetBtnText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "bold",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    modalBox: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 32,
        alignItems: "center",
        width: "100%",
        maxWidth: 340,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#1E293B",
        marginTop: 12,
        marginBottom: 8,
    },
    modalMessage: {
        fontSize: 15,
        color: "#64748B",
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 24,
    },
    modalBtn: {
        backgroundColor: Colors.light.primary,
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 12,
        width: "100%",
        alignItems: "center",
    },
    modalBtnErr: {
        backgroundColor: "#EF4444",
    },
    modalBtnText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "bold",
    },
});
