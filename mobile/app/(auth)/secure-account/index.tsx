import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    StyleSheet,
    ScrollView,
} from "react-native";
import { useRouter, Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../src/lib/supabase";

export default function SecureAccountScreen() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.replace("/login" as Href);
                return;
            }
            setUser(user);
        };
        checkUser();
    }, []);

    // Password requirements checks
    const isMinLength = newPassword.length >= 8;
    const hasLetterAndNumber = /[a-zA-Z]/.test(newPassword) && /[0-9]/.test(newPassword);
    const isPasswordValid = isMinLength && hasLetterAndNumber;

    const handlePasswordChange = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            alert("Please fill in all fields.");
            return;
        }

        if (!isPasswordValid) {
            alert("New password does not meet the complexity requirements.");
            return;
        }

        if (newPassword !== confirmPassword) {
            alert("New passwords do not match.");
            return;
        }

        if (currentPassword === newPassword) {
            alert("New password must be different from your temporary password.");
            return;
        }

        setIsLoading(true);
        try {
            // 1. Verify current temporary password by signing in again
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email!,
                password: currentPassword
            });

            if (signInError) {
                alert("The current temporary password you entered is incorrect.");
                setIsLoading(false);
                return;
            }

            // 2. Update password in Supabase Auth
            const { error: updateAuthError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateAuthError) throw updateAuthError;

            // 3. Update profiles table to set must_change_password = false
            const { error: profileError } = await supabase
                .from("profiles")
                .update({ must_change_password: false })
                .eq("id", user.id);

            if (profileError) throw profileError;

            alert("Password updated successfully!");
            router.replace("/(tabs)/home" as Href);
        } catch (err: any) {
            console.error("Forced password change error:", err);
            alert(err.message || "An error occurred while setting your password.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardView}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    
                    {/* Shield Logo Header */}
                    <View style={styles.headerContainer}>
                        <View style={styles.shieldWrapper}>
                            <View style={styles.shieldCircle}>
                                <Ionicons name="shield-checkmark" size={32} color="#2563EB" />
                            </View>
                        </View>
                        <Text style={styles.header}>Secure Your Account</Text>
                        <Text style={styles.subtext}>
                            For your security, you must change your temporary password before accessing your dashboard.
                        </Text>
                    </View>

                    {/* Inputs Card */}
                    <View style={styles.card}>
                        
                        {/* Current Password */}
                        <Text style={styles.inputLabel}>Current Temporary Password</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your temporary password"
                                placeholderTextColor="#94A3B8"
                                value={currentPassword}
                                onChangeText={setCurrentPassword}
                                secureTextEntry={!showCurrent}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)} style={styles.eyeIcon}>
                                <Ionicons
                                    name={showCurrent ? "eye-off-outline" : "eye-outline"}
                                    size={20}
                                    color="#94A3B8"
                                />
                            </TouchableOpacity>
                        </View>

                        {/* New Password */}
                        <Text style={styles.inputLabel}>New Password</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Minimum 8 characters, letters & numbers"
                                placeholderTextColor="#94A3B8"
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry={!showNew}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowNew(!showNew)} style={styles.eyeIcon}>
                                <Ionicons
                                    name={showNew ? "eye-off-outline" : "eye-outline"}
                                    size={20}
                                    color="#94A3B8"
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Dynamic requirements indicators */}
                        <View style={styles.requirementsContainer}>
                            <View style={styles.requirementItem}>
                                <Ionicons 
                                    name={isMinLength ? "checkmark-circle" : "checkmark-circle-outline"} 
                                    size={16} 
                                    color={isMinLength ? "#10B981" : "#94A3B8"} 
                                />
                                <Text style={[styles.requirementText, isMinLength && styles.requirementMet]}>8+ chars</Text>
                            </View>
                            <View style={styles.requirementItem}>
                                <Ionicons 
                                    name={hasLetterAndNumber ? "checkmark-circle" : "checkmark-circle-outline"} 
                                    size={16} 
                                    color={hasLetterAndNumber ? "#10B981" : "#94A3B8"} 
                                />
                                <Text style={[styles.requirementText, hasLetterAndNumber && styles.requirementMet]}>Letter & Number</Text>
                            </View>
                        </View>

                        {/* Confirm Password */}
                        <Text style={styles.inputLabel}>Confirm New Password</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Re-enter your new password"
                                placeholderTextColor="#94A3B8"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry={!showConfirm}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeIcon}>
                                <Ionicons
                                    name={showConfirm ? "eye-off-outline" : "eye-outline"}
                                    size={20}
                                    color="#94A3B8"
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Submit button */}
                        <TouchableOpacity 
                            style={[styles.button, isLoading && { opacity: 0.7 }]} 
                            onPress={handlePasswordChange}
                            disabled={isLoading}
                            activeOpacity={0.8}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.buttonText}>Change Password & Continue</Text>
                            )}
                        </TouchableOpacity>

                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    loaderContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F8FAFC",
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100%",
    },
    headerContainer: {
        alignItems: "center",
        marginBottom: 28,
        width: "100%",
    },
    shieldWrapper: {
        width: 64,
        height: 64,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 20,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    shieldCircle: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: "#EFF6FF",
        alignItems: "center",
        justifyContent: "center",
    },
    header: {
        fontSize: 26,
        fontWeight: "800",
        color: "#0F172A",
        marginBottom: 8,
        textAlign: "center",
    },
    subtext: {
        fontSize: 14,
        color: "#64748B",
        textAlign: "center",
        lineHeight: 20,
        paddingHorizontal: 12,
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "#F1F5F9",
        padding: 24,
        width: "100%",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 3,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: "700",
        color: "#64748B",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 8,
        marginLeft: 4,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 16,
        height: 52,
        paddingHorizontal: 16,
        marginBottom: 18,
    },
    icon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: "#0F172A",
    },
    eyeIcon: {
        padding: 4,
    },
    requirementsContainer: {
        flexDirection: "row",
        gap: 16,
        marginTop: -6,
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    requirementItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    requirementText: {
        fontSize: 12,
        color: "#94A3B8",
        fontWeight: "600",
    },
    requirementMet: {
        color: "#10B981",
    },
    button: {
        backgroundColor: "#2563EB",
        borderRadius: 20,
        height: 54,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 10,
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    buttonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
    },
}) as any;
