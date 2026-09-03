import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Modal,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Href } from "expo-router";
import registerStyles from "./_styles";
import { validatePassword, passwordStrengthLabel } from "../../../src/utils/password-validator";

const GRADE_LEVELS = ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];

/** Student self-registration screen. */
export default function RegisterScreen() {
    const router = useRouter();

    // -- Form state
    const [firstName, setFirstName] = useState("");
    const [middleName, setMiddleName] = useState("");
    const [lastName, setLastName] = useState("");
    const [gradeLevel, setGradeLevel] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showGradePicker, setShowGradePicker] = useState(false);

    // -- OTP & UI state
    const [isLoading, setIsLoading] = useState(false);
    const [showOtp, setShowOtp] = useState(false);
    const [otpCode, setOtpCode] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [success, setSuccess] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState("");
    const [formErrors, setFormErrors] = useState<string[]>([]);
    const [otpError, setOtpError] = useState("");

    // Live password validation
    const pwValidation = validatePassword(password);
    const strength = passwordStrengthLabel(password);
    const strengthWidth = strength === "weak" ? "33%" : strength === "fair" ? "66%" : "100%";
    const strengthStyle =
        strength === "weak"
            ? registerStyles.strengthWeak
            : strength === "fair"
            ? registerStyles.strengthFair
            : registerStyles.strengthStrong;

    const validate = (): string[] => {
        const errors: string[] = [];
        if (!firstName.trim()) errors.push("First name is required.");
        if (!lastName.trim()) errors.push("Last name is required.");
        if (!gradeLevel) errors.push("Please select a grade level.");
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email.trim()) {
            errors.push("Email is required.");
        } else if (!emailRegex.test(email.trim())) {
            errors.push("Please enter a valid email address.");
        }
        
        if (!pwValidation.valid) errors.push(...pwValidation.errors);
        if (password !== confirmPassword) errors.push("Passwords do not match.");
        return errors;
    };

    const handleRegister = async () => {
        if (isLoading) return; // Prevent spam-clicking/double submits!

        const errors = validate();
        if (errors.length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors([]);
        setIsLoading(true);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        try {
            const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
            const response = await fetch(`${API_URL}/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Bypass-Tunnel-Reminder": "true",
                },
                body: JSON.stringify({
                    email: email.trim(),
                    password,
                    role: "student",
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    middleName: middleName.trim(),
                    year: gradeLevel,
                    section: "", // Section is no longer captured
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const data = await response.json();

            if (!response.ok) {
                const msgs: string[] = Array.isArray(data.details)
                    ? data.details
                    : [data.error || "Registration failed. Please try again."];
                setFormErrors(msgs);
                return;
            }

            // Move to OTP screen
            setRegisteredEmail(email.trim());
            setShowOtp(true);
        } catch (err: any) {
            clearTimeout(timeoutId);
            if (err.name === "AbortError") {
                setFormErrors(["Request timed out. Please check your connection and try again."]);
            } else {
                setFormErrors([err.message || "Network error. Please try again."]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (isVerifying || otpCode.trim().length !== 6) return;

        setOtpError("");
        setIsVerifying(true);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
            const response = await fetch(`${API_URL}/auth/verify-register-otp`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Bypass-Tunnel-Reminder": "true",
                },
                body: JSON.stringify({
                    email: registeredEmail,
                    code: otpCode.trim(),
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const data = await response.json();

            if (!response.ok) {
                setOtpError(data.error || "Invalid verification code.");
                return;
            }

            // OTP verified! Show success view
            setSuccess(true);
        } catch (err: any) {
            clearTimeout(timeoutId);
            if (err.name === "AbortError") {
                setOtpError("Request timed out. Please try again.");
            } else {
                setOtpError(err.message || "Failed to verify OTP.");
            }
        } finally {
            setIsVerifying(false);
        }
    };

    // ──────────────────────────────────────────────────────────────
    // 1. SUCCESS VIEW (Account Activated)
    // ──────────────────────────────────────────────────────────────
    if (success) {
        return (
            <SafeAreaView style={successStyles.container}>
                <View style={successStyles.content}>
                    <View style={successStyles.iconCircle}>
                        <Ionicons name="checkmark-circle" size={72} color="#009664" />
                    </View>

                    <Text style={successStyles.title}>Account Activated!</Text>
                    <Text style={successStyles.subtitle}>
                        Your email address has been verified successfully.
                    </Text>

                    <View style={successStyles.card}>
                        <View style={successStyles.cardRow}>
                            <Ionicons name="school" size={22} color="#009664" style={{ marginRight: 12 }} />
                            <Text style={successStyles.cardText}>
                                Welcome <Text style={{ fontWeight: "bold" }}>{firstName} {lastName}</Text> to ConnectEd!
                            </Text>
                        </View>
                        <View style={successStyles.divider} />
                        <View style={successStyles.cardRow}>
                            <Ionicons name="shield-checkmark" size={22} color="#009664" style={{ marginRight: 12 }} />
                            <Text style={successStyles.cardText}>
                                Your credentials are now fully active and ready to use.
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={successStyles.button}
                        onPress={() => router.replace("/(auth)/login" as Href)}
                        activeOpacity={0.85}
                    >
                        <Text style={successStyles.buttonText}>Go to Login</Text>
                        <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ──────────────────────────────────────────────────────────────
    // 2. OTP INPUT VIEW (Enter 6-Digit Code)
    // ──────────────────────────────────────────────────────────────
    if (showOtp) {
        return (
            <SafeAreaView style={otpStyles.container}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        contentContainerStyle={otpStyles.content}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={otpStyles.iconContainer}>
                            <Ionicons name="mail-open-outline" size={48} color="#009664" />
                        </View>

                        <Text style={otpStyles.title}>Verification Code</Text>
                        <Text style={otpStyles.subtitle}>
                            We sent a 6-digit activation code to{"\n"}
                            <Text style={otpStyles.emailText}>{registeredEmail}</Text>
                        </Text>

                        {/* Error message */}
                        {otpError.length > 0 && (
                            <View style={otpStyles.errorBox}>
                                <Ionicons name="alert-circle-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
                                <Text style={otpStyles.errorText}>{otpError}</Text>
                            </View>
                        )}

                        {/* 6-Digit input */}
                        <Text style={otpStyles.label}>Enter Code</Text>
                        <View style={otpStyles.inputContainer}>
                            <TextInput
                                style={otpStyles.input}
                                placeholder="000000"
                                placeholderTextColor="#94A3B8"
                                value={otpCode}
                                onChangeText={(text) => setOtpCode(text.replace(/[^0-9]/g, "").slice(0, 6))}
                                keyboardType="number-pad"
                                maxLength={6}
                                autoFocus
                            />
                        </View>

                        <TouchableOpacity
                            style={[
                                otpStyles.verifyButton,
                                (isVerifying || otpCode.length !== 6) && otpStyles.verifyButtonDisabled,
                            ]}
                            onPress={handleVerifyOtp}
                            disabled={isVerifying || otpCode.length !== 6}
                            activeOpacity={0.85}
                        >
                            {isVerifying ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <>
                                    <Text style={otpStyles.verifyButtonText}>Verify & Activate</Text>
                                    <Ionicons name="checkmark-done" size={20} color="#FFF" style={{ marginLeft: 8 }} />
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={otpStyles.backButton}
                            onPress={() => setShowOtp(false)}
                            disabled={isVerifying}
                        >
                            <Text style={otpStyles.backButtonText}>Back to Sign Up</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    // ──────────────────────────────────────────────────────────────
    // 3. REGISTRATION FORM (Initial State)
    // ──────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={registerStyles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={registerStyles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={registerStyles.header}>Create Account</Text>
                    <Text style={registerStyles.subtext}>
                        Fill in your details to register as a student.
                    </Text>

                    {/* ── Form Errors ── */}
                    {formErrors.length > 0 && (
                        <View style={registerStyles.errorList}>
                            {formErrors.map((e, i) => (
                                <Text key={i} style={registerStyles.errorText}>• {e}</Text>
                            ))}
                        </View>
                    )}

                    {/* ── Name ── */}
                    <Text style={registerStyles.sectionLabel}>
                        First Name <Text style={registerStyles.required}>*</Text>
                    </Text>
                    <View style={registerStyles.inputContainer}>
                        <Ionicons name="person-outline" size={20} color="#94A3B8" style={registerStyles.icon} />
                        <TextInput
                            style={registerStyles.input}
                            placeholder="First Name"
                            placeholderTextColor="#94A3B8"
                            value={firstName}
                            onChangeText={setFirstName}
                            autoCapitalize="words"
                        />
                    </View>

                    <Text style={registerStyles.sectionLabel}>Middle Name</Text>
                    <View style={registerStyles.inputContainer}>
                        <Ionicons name="person-outline" size={20} color="#94A3B8" style={registerStyles.icon} />
                        <TextInput
                            style={registerStyles.input}
                            placeholder="Middle Name (optional)"
                            placeholderTextColor="#94A3B8"
                            value={middleName}
                            onChangeText={setMiddleName}
                            autoCapitalize="words"
                        />
                    </View>

                    <Text style={registerStyles.sectionLabel}>
                        Last Name <Text style={registerStyles.required}>*</Text>
                    </Text>
                    <View style={registerStyles.inputContainer}>
                        <Ionicons name="person-outline" size={20} color="#94A3B8" style={registerStyles.icon} />
                        <TextInput
                            style={registerStyles.input}
                            placeholder="Last Name"
                            placeholderTextColor="#94A3B8"
                            value={lastName}
                            onChangeText={setLastName}
                            autoCapitalize="words"
                        />
                    </View>

                    <View style={registerStyles.divider} />

                    {/* ── Grade Level ── */}
                    <Text style={registerStyles.sectionLabel}>
                        Grade Level <Text style={registerStyles.required}>*</Text>
                    </Text>
                    <TouchableOpacity
                        style={registerStyles.pickerContainer}
                        onPress={() => setShowGradePicker(true)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="school-outline" size={20} color="#94A3B8" style={registerStyles.icon} />
                        <Text
                            style={[
                                registerStyles.pickerText,
                                gradeLevel ? registerStyles.pickerValue : registerStyles.pickerPlaceholder,
                            ]}
                        >
                            {gradeLevel || "Select Grade Level"}
                        </Text>
                        <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                    </TouchableOpacity>

                    <View style={registerStyles.divider} />

                    {/* ── Email ── */}
                    <Text style={registerStyles.sectionLabel}>
                        Email Address <Text style={registerStyles.required}>*</Text>
                    </Text>
                    <View style={registerStyles.inputContainer}>
                        <Ionicons name="mail-outline" size={20} color="#94A3B8" style={registerStyles.icon} />
                        <TextInput
                            style={registerStyles.input}
                            placeholder="email@example.com"
                            placeholderTextColor="#94A3B8"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                        />
                    </View>

                    {/* ── Password ── */}
                    <Text style={registerStyles.sectionLabel}>
                        Password <Text style={registerStyles.required}>*</Text>
                    </Text>
                    <View style={registerStyles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={registerStyles.icon} />
                        <TextInput
                            style={registerStyles.input}
                            placeholder="Min 12 chars, uppercase, digit, special"
                            placeholderTextColor="#94A3B8"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                            <Ionicons
                                name={showPassword ? "eye-off-outline" : "eye-outline"}
                                size={20}
                                color="#94A3B8"
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Strength bar */}
                    {password.length > 0 && (
                        <>
                            <View style={[registerStyles.strengthBar, { width: strengthWidth }, strengthStyle]} />
                            {!pwValidation.valid && (
                                <View style={registerStyles.errorList}>
                                    {pwValidation.errors.map((e, i) => (
                                        <Text key={i} style={registerStyles.errorText}>• {e}</Text>
                                    ))}
                                </View>
                            )}
                        </>
                    )}

                    {/* ── Confirm Password ── */}
                    <Text style={registerStyles.sectionLabel}>
                        Confirm Password <Text style={registerStyles.required}>*</Text>
                    </Text>
                    <View
                        style={[
                            registerStyles.inputContainer,
                            confirmPassword.length > 0 && password !== confirmPassword && registerStyles.inputError,
                        ]}
                    >
                        <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={registerStyles.icon} />
                        <TextInput
                            style={registerStyles.input}
                            placeholder="Re-enter password"
                            placeholderTextColor="#94A3B8"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                            <Ionicons
                                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                                size={20}
                                color="#94A3B8"
                            />
                        </TouchableOpacity>
                    </View>
                    {confirmPassword.length > 0 && password !== confirmPassword && (
                        <Text style={[registerStyles.errorText, { marginTop: -10, marginBottom: 10 }]}>
                            • Passwords do not match.
                        </Text>
                    )}

                    {/* ── Submit ── */}
                    <TouchableOpacity
                        style={[registerStyles.button, isLoading && registerStyles.buttonDisabled]}
                        onPress={handleRegister}
                        disabled={isLoading}
                        activeOpacity={0.85}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={registerStyles.buttonText}>Create Account</Text>
                        )}
                    </TouchableOpacity>

                    {/* ── Footer ── */}
                    <View style={registerStyles.footer}>
                        <Text style={registerStyles.footerText}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => router.replace("/(auth)/login" as Href)}>
                            <Text style={registerStyles.footerLink}>Sign In</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ── Grade Level Picker Modal ── */}
            <Modal
                visible={showGradePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowGradePicker(false)}
            >
                <TouchableOpacity
                    style={registerStyles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowGradePicker(false)}
                >
                    <View style={registerStyles.modalSheet}>
                        <Text style={registerStyles.modalTitle}>Select Grade Level</Text>
                        {GRADE_LEVELS.map((g) => (
                            <TouchableOpacity
                                key={g}
                                style={registerStyles.modalOption}
                                onPress={() => {
                                    setGradeLevel(g);
                                    setShowGradePicker(false);
                                }}
                            >
                                <Text style={registerStyles.modalOptionText}>{g}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={registerStyles.modalCancel}
                            onPress={() => setShowGradePicker(false)}
                        >
                            <Text style={registerStyles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

// ──────────────────────────────────────────────────────────────
// Success Screen Styles
// ──────────────────────────────────────────────────────────────
const successStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F0FAF5",
    },
    content: {
        flex: 1,
        paddingHorizontal: 28,
        paddingTop: 60,
        paddingBottom: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: "#ECFDF5",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 24,
        borderWidth: 2,
        borderColor: "#A7F3D0",
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 8,
        textAlign: "center",
    },
    subtitle: {
        fontSize: 15,
        color: "#64748B",
        marginBottom: 28,
        textAlign: "center",
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 20,
        width: "100%",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        marginBottom: 32,
    },
    cardRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
    },
    cardText: {
        flex: 1,
        fontSize: 14,
        color: "#334155",
        lineHeight: 20,
    },
    divider: {
        height: 1,
        backgroundColor: "#F1F5F9",
    },
    button: {
        backgroundColor: "#009664",
        borderRadius: 14,
        height: 56,
        width: "100%",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#009664",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 4,
    },
    buttonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "bold",
    },
});

// ──────────────────────────────────────────────────────────────
// Native OTP Verification Screen Styles
// ──────────────────────────────────────────────────────────────
const otpStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    content: {
        flexGrow: 1,
        paddingHorizontal: 28,
        paddingTop: 60,
        paddingBottom: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    iconContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: "#ECFDF5",
        borderWidth: 2,
        borderColor: "#A7F3D0",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 24,
    },
    title: {
        fontSize: 26,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 8,
        textAlign: "center",
    },
    subtitle: {
        fontSize: 15,
        color: "#64748B",
        lineHeight: 22,
        textAlign: "center",
        marginBottom: 28,
    },
    emailText: {
        color: "#009664",
        fontWeight: "bold",
    },
    errorBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FEF2F2",
        borderWidth: 1,
        borderColor: "#FCA5A5",
        borderRadius: 12,
        padding: 14,
        width: "100%",
        marginBottom: 24,
    },
    errorText: {
        color: "#DC2626",
        fontSize: 14,
        fontWeight: "500",
        flex: 1,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: "#64748B",
        alignSelf: "flex-start",
        marginBottom: 8,
    },
    inputContainer: {
        width: "100%",
        backgroundColor: "#F8FAFC",
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: "#E2E8F0",
        height: 60,
        marginBottom: 32,
        justifyContent: "center",
        paddingHorizontal: 16,
    },
    input: {
        fontSize: 24,
        fontWeight: "bold",
        letterSpacing: 8,
        textAlign: "center",
        color: "#1E293B",
    },
    verifyButton: {
        backgroundColor: "#009664",
        borderRadius: 14,
        height: 56,
        width: "100%",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#009664",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 4,
        marginBottom: 16,
    },
    verifyButtonDisabled: {
        backgroundColor: "#94A3B8",
        shadowOpacity: 0,
        elevation: 0,
    },
    verifyButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "bold",
    },
    backButton: {
        paddingVertical: 12,
    },
    backButtonText: {
        color: "#64748B",
        fontSize: 14,
        fontWeight: "600",
    },
});
