import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import styles from "./_styles";

type StepType = 1 | 2 | 3 | 4; // 1: Email Request, 2: OTP Entry, 3: New Password, 4: Success Screen

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const [step, setStep] = useState<StepType>(1);
    const [email, setEmail] = useState("");
    const [otpCode, setOtpCode] = useState("");
    
    // Password state
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // States for errors, loader, timers
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [resendTimer, setResendTimer] = useState(60);

    // Countdown Timer for OTP Resend
    useEffect(() => {
        let interval: any;
        if (step === 2 && resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [step, resendTimer]);

    // Live Password Strength Checklist logic
    const validatePassword = () => {
        const hasLen = password.length >= 12;
        const hasUpper = /[A-Z]/.test(password);
        const hasDigit = /[0-9]/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        const matches = password.length > 0 && password === confirmPassword;

        // Calculate strength bar progress (score out of 4)
        let score = 0;
        if (hasLen) score++;
        if (hasUpper) score++;
        if (hasDigit) score++;
        if (hasSpecial) score++;

        return {
            hasLen,
            hasUpper,
            hasDigit,
            hasSpecial,
            matches,
            score,
            valid: hasLen && hasUpper && hasDigit && hasSpecial && matches,
        };
    };

    const pwCheck = validatePassword();

    // 1. Submit email to receive 6-digit OTP
    const handleSendOTP = async () => {
        setError("");
        if (!email.trim()) {
            setError("Please enter your email address.");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            setError("Please enter a valid email address.");
            return;
        }

        setIsLoading(true);
        try {
            const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
            const response = await fetch(`${API_URL}/auth/forgot-password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Bypass-Tunnel-Reminder": "true",
                },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });

            const responseText = await response.text();
            let data: any = {};
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                throw new Error("Unable to reach the server. Please check your network connection.");
            }

            if (!response.ok) {
                setError(data.error || "No account found with this email.");
                return;
            }

            // OTP successfully sent, advance to step 2!
            setResendTimer(60);
            setStep(2);
        } catch (err: any) {
            setError(err.message || "Network connection error. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // 2. Verify the 6-digit OTP code input
    const handleVerifyOTP = async () => {
        setError("");
        if (otpCode.trim().length !== 6) {
            setError("Please enter the 6-digit verification code.");
            return;
        }

        setIsLoading(true);
        try {
            const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
            const response = await fetch(`${API_URL}/auth/verify-reset-otp`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Bypass-Tunnel-Reminder": "true",
                },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    code: otpCode.trim(),
                }),
            });

            const responseText = await response.text();
            let data: any = {};
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                throw new Error("Server communication failed. Please try again.");
            }

            if (!response.ok) {
                setError(data.error || "Invalid or expired verification code.");
                return;
            }

            // OTP verified, proceed to new password screen (step 3)!
            setStep(3);
        } catch (err: any) {
            setError(err.message || "Network error. Please verify your connection.");
        } finally {
            setIsLoading(false);
        }
    };

    // 3. Save new password and update Supabase!
    const handleSaveNewPassword = async () => {
        setError("");
        if (!pwCheck.valid) {
            setError("Please satisfy all password validation constraints.");
            return;
        }

        setIsLoading(true);
        try {
            const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
            const response = await fetch(`${API_URL}/auth/update-password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Bypass-Tunnel-Reminder": "true",
                },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    code: otpCode.trim(),
                    password: password,
                }),
            });

            const responseText = await response.text();
            let data: any = {};
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                throw new Error("Unable to save password. Server returned an error.");
            }

            if (!response.ok) {
                setError(data.error || "Failed to update password. Please try again.");
                return;
            }

            // Password saved! Transition to success (step 4)
            setStep(4);
        } catch (err: any) {
            setError(err.message || "Connection error. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardView}
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
                    <View style={styles.content}>
                        
                        {/* BACK BUTTON (Only for non-success states) */}
                        {step !== 4 && (
                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => {
                                    if (step === 1) router.back();
                                    else {
                                        setError("");
                                        setStep((prev) => (prev - 1) as StepType);
                                    }
                                }}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="arrow-back" size={20} color="#009664" />
                                <Text style={styles.backText}>
                                    {step === 1 ? "Back to Login" : `Back to Step ${step - 1}`}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {/* STEP 1: ENTER EMAIL FOR RESET OTP */}
                        {step === 1 && (
                            <View>
                                <Text style={styles.header}>Forgot Password?</Text>
                                <Text style={styles.subtext}>
                                    Enter your email address to receive a secure 6-digit password reset verification code.
                                </Text>

                                {error ? <Text style={styles.errorText}>• {error}</Text> : null}

                                <View style={styles.inputContainer}>
                                    <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.icon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="email@example.com"
                                        placeholderTextColor="#94A3B8"
                                        value={email}
                                        onChangeText={setEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoComplete="email"
                                    />
                                </View>

                                <TouchableOpacity
                                    style={[styles.button, isLoading && styles.buttonDisabled]}
                                    onPress={handleSendOTP}
                                    disabled={isLoading}
                                    activeOpacity={0.85}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <Text style={styles.buttonText}>Send Verification Code</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* STEP 2: ENTER 6-DIGIT RESET OTP */}
                        {step === 2 && (
                            <View>
                                <Text style={styles.header}>Enter Code</Text>
                                <Text style={styles.subtext}>
                                    We sent a 6-digit secure password reset code to{"\n"}
                                    <Text style={{ fontWeight: "bold", color: "#1E293B" }}>{email}</Text>.{"\n"}
                                    Please enter it below to verify your identity.
                                </Text>

                                {error ? <Text style={styles.errorText}>• {error}</Text> : null}

                                <View style={styles.inputContainer}>
                                    <Ionicons name="key-outline" size={20} color="#94A3B8" style={styles.icon} />
                                    <TextInput
                                        style={[styles.input, { letterSpacing: 4, fontWeight: "bold" }]}
                                        placeholder="000000"
                                        placeholderTextColor="#94A3B8"
                                        value={otpCode}
                                        onChangeText={(val) => setOtpCode(val.replace(/[^0-9]/g, "").slice(0, 6))}
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        autoFocus
                                    />
                                </View>

                                <TouchableOpacity
                                    style={[styles.button, isLoading && styles.buttonDisabled]}
                                    onPress={handleVerifyOTP}
                                    disabled={isLoading}
                                    activeOpacity={0.85}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <Text style={styles.buttonText}>Verify Code</Text>
                                    )}
                                </TouchableOpacity>

                                {/* Resend Code Timer */}
                                <View style={{ alignItems: "center", marginTop: 24 }}>
                                    {resendTimer > 0 ? (
                                        <Text style={{ color: "#64748B", fontSize: 14 }}>
                                            Resend code in <Text style={{ fontWeight: "bold", color: "#009664" }}>{resendTimer}s</Text>
                                        </Text>
                                    ) : (
                                        <TouchableOpacity onPress={handleSendOTP}>
                                            <Text style={{ color: "#009664", fontSize: 14, fontWeight: "bold" }}>
                                                Resend Verification Code
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* STEP 3: CHOOSE NEW PASSWORD */}
                        {step === 3 && (
                            <View>
                                <Text style={styles.header}>New Password</Text>
                                <Text style={styles.subtext}>
                                    Choose a secure new password that meets our complexity constraints.
                                </Text>

                                {error ? <Text style={styles.errorText}>• {error}</Text> : null}

                                {/* New Password Field */}
                                <Text style={{ fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6 }}>New Password *</Text>
                                <View style={styles.inputContainer}>
                                    <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.icon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter secure password"
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

                                {/* Confirm Password Field */}
                                <Text style={{ fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6 }}>Confirm Password *</Text>
                                <View style={styles.inputContainer}>
                                    <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.icon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Confirm secure password"
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

                                {/* Live Password Strength Bar */}
                                {password.length > 0 && (
                                    <View style={{ height: 4, backgroundColor: "#E2E8F0", borderRadius: 2, marginBottom: 16, overflow: "hidden" }}>
                                        <View style={{
                                            height: "100%",
                                            width: `${pwCheck.score * 25}%`,
                                            backgroundColor: pwCheck.score === 1 ? "#EF4444" : pwCheck.score === 2 ? "#F59E0B" : pwCheck.score === 3 ? "#3B82F6" : "#009664"
                                        }} />
                                    </View>
                                )}

                                {/* Validation checklist */}
                                <View style={{ backgroundColor: "#FFFFFF", padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 20 }}>
                                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: pwCheck.hasLen ? "#009664" : "#94A3B8", marginRight: 8 }} />
                                        <Text style={{ fontSize: 12, color: pwCheck.hasLen ? "#009664" : "#64748B", fontWeight: pwCheck.hasLen ? "600" : "500" }}>At least 12 characters long</Text>
                                    </View>
                                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: pwCheck.hasUpper ? "#009664" : "#94A3B8", marginRight: 8 }} />
                                        <Text style={{ fontSize: 12, color: pwCheck.hasUpper ? "#009664" : "#64748B", fontWeight: pwCheck.hasUpper ? "600" : "500" }}>Contains an uppercase letter</Text>
                                    </View>
                                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: pwCheck.hasDigit ? "#009664" : "#94A3B8", marginRight: 8 }} />
                                        <Text style={{ fontSize: 12, color: pwCheck.hasDigit ? "#009664" : "#64748B", fontWeight: pwCheck.hasDigit ? "600" : "500" }}>Contains a digit (0-9)</Text>
                                    </View>
                                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: pwCheck.hasSpecial ? "#009664" : "#94A3B8", marginRight: 8 }} />
                                        <Text style={{ fontSize: 12, color: pwCheck.hasSpecial ? "#009664" : "#64748B", fontWeight: pwCheck.hasSpecial ? "600" : "500" }}>Contains a special character (!@#$%^&*)</Text>
                                    </View>
                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: pwCheck.matches ? "#009664" : "#94A3B8", marginRight: 8 }} />
                                        <Text style={{ fontSize: 12, color: pwCheck.matches ? "#009664" : "#64748B", fontWeight: pwCheck.matches ? "600" : "500" }}>Passwords match</Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[styles.button, (!pwCheck.valid || isLoading) && styles.buttonDisabled]}
                                    onPress={handleSaveNewPassword}
                                    disabled={!pwCheck.valid || isLoading}
                                    activeOpacity={0.85}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <Text style={styles.buttonText}>Save New Password</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* STEP 4: SUCCESS VIEW */}
                        {step === 4 && (
                            <View style={styles.successBanner}>
                                <Ionicons name="checkmark-circle-outline" size={48} color="#009664" />
                                <Text style={[styles.successText, { fontSize: 20, fontWeight: "bold", marginTop: 12, marginBottom: 8 }]}>
                                    Reset Successful!
                                </Text>
                                <Text style={[styles.successText, { color: "#64748B", marginBottom: 24, paddingHorizontal: 12 }]}>
                                    Your password has been successfully updated with full security validation. You can now sign in with your new credentials.
                                </Text>

                                <TouchableOpacity
                                    style={[styles.button, { width: "100%", marginTop: 0 }]}
                                    onPress={() => router.replace("/(auth)/login")}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.buttonText}>Go to Login</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
