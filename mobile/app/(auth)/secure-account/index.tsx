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
    Alert,
    BackHandler,
} from "react-native";
import { useRouter, Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../src/lib/supabase";
import { createClient } from "@supabase/supabase-js";

export default function SecureAccountScreen() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [needsOtp, setNeedsOtp] = useState(false);
    const [otp, setOtp] = useState("");
    const [generatedOtp, setGeneratedOtp] = useState("");
    const [timer, setTimer] = useState(59);

    const [currentPassword, setCurrentPassword] = useState("");
    const [personalEmail, setPersonalEmail] = useState("");
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

            // If user has already finished account security setup, forward to dashboard
            const { data: profile } = await supabase
                .from("profiles")
                .select("must_change_password")
                .eq("id", user.id)
                .maybeSingle();

            if (profile && !profile.must_change_password) {
                router.replace("/(tabs)/home" as Href);
                return;
            }

            setUser(user);
        };
        checkUser();

        // Lock navigation on Android hardware back button
        const backHandler = BackHandler.addEventListener("hardwareBackPress", () => true);
        return () => backHandler.remove();
    }, []);

    // OTP timer countdown effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (needsOtp && timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [needsOtp, timer]);

    const [emailTouched, setEmailTouched] = useState(false);
    const [emailServerError, setEmailServerError] = useState("");

    // Password requirements checks
    const isMinLength = newPassword.length >= 8;
    const hasLetterAndNumber = /[a-zA-Z]/.test(newPassword) && /[0-9]/.test(newPassword);
    const isPasswordValid = isMinLength && hasLetterAndNumber;

    const validateEmailRealness = (emailStr: string): boolean => {
        const trimmed = emailStr.trim().toLowerCase();
        if (!trimmed) return false;
        
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
        if (!emailRegex.test(trimmed)) return false;

        const parts = trimmed.split("@");
        if (parts.length !== 2) return false;
        const [username, domain] = parts;

        if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return false;
        const tld = domain.split(".").pop();
        if (!tld || tld.length < 2) return false;

        const fakeDomains = [
            "mailinator.com", "tempmail.com", "guerrillamail.com", "trashmail.com",
            "fake.com", "test.com", "example.com", "temp-mail.org", "yopmail.com",
            "10minutemail.com", "sharklasers.com", "throwawaymail.com", "dispostable.com"
        ];
        if (fakeDomains.includes(domain)) return false;

        if (domain === "gmail.com") {
            const cleanUser = username.replace(/\./g, "");
            if (cleanUser.length < 6 || cleanUser.length > 30) return false;
        }

        return true;
    };

    const isEmailValid = validateEmailRealness(personalEmail);
    const isEmailFormatPotentiallyFinished = personalEmail.includes("@") && personalEmail.indexOf("@") < personalEmail.lastIndexOf(".");
    const showEmailNotReal = Boolean(
        emailServerError ||
        (personalEmail.length > 0 && (emailTouched || isEmailFormatPotentiallyFinished) && !isEmailValid)
    );

    const showConfirmPasswordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
    const isFormValid = currentPassword.length > 0 &&
                        isEmailValid &&
                        isPasswordValid &&
                        confirmPassword.length > 0 &&
                        newPassword === confirmPassword;

    const handlePasswordChange = async () => {
        const trimmedEmail = personalEmail.trim().toLowerCase();

        if (!currentPassword || !trimmedEmail || !newPassword || !confirmPassword) {
            Alert.alert("Error", "Please fill in all fields.");
            return;
        }

        if (!validateEmailRealness(trimmedEmail)) {
            setEmailTouched(true);
            setEmailServerError("Not a real email");
            Alert.alert("Invalid Email", "Please enter a real, valid personal email address.");
            return;
        }

        if (!isPasswordValid) {
            Alert.alert("Error", "New password does not meet the complexity requirements.");
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert("Error", "New passwords do not match.");
            return;
        }

        if (currentPassword === newPassword) {
            Alert.alert("Error", "New password must be different from your temporary password.");
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
                Alert.alert("Error", "The current temporary password you entered is incorrect.");
                setIsLoading(false);
                return;
            }

            // 2. Generate 4-digit OTP code
            const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
            const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

            // 3. Verify real email and deliver the OTP via backend service first!
            const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
            if (!backendUrl) {
                Alert.alert("Error", "Backend server connection URL is not configured. Please contact administrator.");
                setIsLoading(false);
                return;
            }

            const otpResponse = await fetch(`${backendUrl}/auth/send-secure-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: trimmedEmail,
                    otp: otpCode
                })
            });

            const otpData = await otpResponse.json().catch(() => ({}));
            if (!otpResponse.ok || !otpData.success) {
                setEmailServerError("Not a real email");
                Alert.alert(
                    "Invalid Email",
                    otpData.error || "The email address could not receive the verification code. Please make sure you entered a real, active email address."
                );
                setIsLoading(false);
                return;
            }

            // 4. Update password and email in Supabase Auth securely using admin client
            const supabaseAdmin = createClient(
                "https://pyeckxqaowusxcmeuolk.supabase.co",
                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg",
                { auth: { persistSession: false, autoRefreshToken: false } }
            );

            // Check if another profile is already using this email
            const { data: profileWithEmail } = await supabaseAdmin
                .from("profiles")
                .select("id, email")
                .ilike("email", trimmedEmail)
                .neq("id", user.id)
                .maybeSingle();

            if (profileWithEmail) {
                setEmailServerError("This email is already in use by another active account.");
                Alert.alert("Email In Use", "This email address is already in use by another active account. Please provide a different personal email address.");
                setIsLoading(false);
                return;
            }

            // Check if an orphaned auth account exists with this email (e.g. deleted from profiles table)
            const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
            if (listData?.users) {
                const existingAuthUser = listData.users.find(
                    u => u.email?.toLowerCase() === trimmedEmail && u.id !== user.id
                );
                if (existingAuthUser) {
                    const { data: existingProfile } = await supabaseAdmin
                        .from("profiles")
                        .select("id")
                        .eq("id", existingAuthUser.id)
                        .maybeSingle();

                    if (!existingProfile) {
                        // Orphaned auth record without a profile in the database — delete it so the user can claim their email
                        await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id);
                    } else {
                        setEmailServerError("This email is already in use by another active account.");
                        Alert.alert("Email In Use", "This email address is already in use by another active account. Please provide a different personal email address.");
                        setIsLoading(false);
                        return;
                    }
                }
            }

            const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
                user.id,
                { email: trimmedEmail, password: newPassword, email_confirm: true }
            );

            if (updateAuthError) throw updateAuthError;

            // 5. Store OTP code and expiry in profiles table
            const { error: profileError } = await supabase
                .from("profiles")
                .update({ 
                    must_change_password: false,
                    email: trimmedEmail,
                    phone: otpCode,
                    avatar_url: expiry
                })
                .eq("id", user.id);

            if (profileError) throw profileError;

            // 6. Transition to OTP screen
            setGeneratedOtp(otpCode);
            setOtp("");
            setTimer(59);
            setNeedsOtp(true);
            Alert.alert(
                "Verification Code Sent",
                `A 4-digit verification code has been sent to ${trimmedEmail}.\n\nPlease check your inbox (or spam folder) to complete your account setup.`
            );
        } catch (err: any) {
            let errorMessage = err.message || "An error occurred while setting your password.";
            if (errorMessage === "Error updating user" || errorMessage.toLowerCase().includes("email already exists") || errorMessage.toLowerCase().includes("already in use")) {
                errorMessage = "This email is already in use. Please use a different email address.";
                setEmailServerError("This email is already in use.");
            }
            Alert.alert("Error", errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setIsLoading(true);
        try {
            const trimmedEmail = personalEmail.trim().toLowerCase();
            const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
            const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
            if (backendUrl) {
                const res = await fetch(`${backendUrl}/auth/send-secure-otp`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: trimmedEmail,
                        otp: otpCode
                    })
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.success) {
                    Alert.alert("Send Error", data.error || "Failed to resend verification code. Please ensure the email is real and reachable.");
                    setIsLoading(false);
                    return;
                }
            }

            // Update profile with the new OTP code
            const { error: profileError } = await supabase
                .from("profiles")
                .update({ 
                    phone: otpCode,
                    avatar_url: expiry
                })
                .eq("id", user.id);

            if (profileError) throw profileError;

            setGeneratedOtp(otpCode);
            setOtp("");
            setTimer(59);
            Alert.alert("Verification Code Sent", `A new 4-digit verification code has been sent to ${trimmedEmail}.`);
        } catch (err: any) {
            console.error("Resend OTP error:", err);
            Alert.alert("Error", "Failed to resend verification OTP. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otp.length < 4) {
            Alert.alert("Error", "Please enter the 4-digit OTP.");
            return;
        }

        setIsLoading(true);
        try {
            // Get phone (OTP) and avatar_url (expiry) from user profile to verify
            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("phone, avatar_url")
                .eq("id", user.id)
                .single();

            if (profileError || !profile) {
                Alert.alert("Error", "Failed to read verification token. Please try again.");
                setIsLoading(false);
                return;
            }

            const savedOtp = profile.phone;
            const expiryStr = profile.avatar_url;

            if (!savedOtp || otp !== savedOtp) {
                Alert.alert("Error", "Incorrect OTP. Please check the code and try again.");
                setIsLoading(false);
                return;
            }

            // Check if token is expired
            const isExpired = expiryStr && new Date(expiryStr) <= new Date();
            if (isExpired) {
                Alert.alert("Error", "OTP has expired. Please request a new code.");
                setIsLoading(false);
                return;
            }

            // Mark user as verified and clear OTP fields in profiles table
            const { error: updateError } = await supabase
                .from("profiles")
                .update({ 
                    is_verified: true,
                    phone: null,
                    avatar_url: null
                })
                .eq("id", user.id);

            if (updateError) throw updateError;

            Alert.alert("Success", "Account verified successfully! You will now be redirected to the login page.", [
                { text: "OK", onPress: () => router.replace("/login" as Href) }
            ]);
        } catch (err: any) {
            console.error("OTP verification error:", err);
            Alert.alert("Error", "Verification failed. Please try again.");
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

    if (needsOtp) {
        const digits = otp.split("");
        const formattedTimer = timer < 10 ? `00:0${timer}s` : `00:${timer}s`;

        return (
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.keyboardView}
                >
                    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                        {/* OTP Verification Card */}
                        <View style={styles.card}>
                            <Text style={styles.otpHeader}>OTP verification</Text>
                            <Text style={styles.otpSubtext}>
                                Please enter the OTP (one time password) sent to your registered email to complete your verification.
                            </Text>

                            {/* Styled 4 digit code boxes */}
                            <View style={styles.otpWrapper}>
                                {[0, 1, 2, 3].map((index) => {
                                    const digit = digits[index] || "";
                                    const isFocused = otp.length === index;
                                    return (
                                        <View 
                                            key={index} 
                                            style={[
                                                styles.otpBox, 
                                                isFocused && styles.otpBoxFocused
                                            ]}
                                        >
                                            <Text style={styles.otpDigit}>{digit}</Text>
                                        </View>
                                    );
                                })}
                                {/* Hidden Input Field */}
                                <TextInput
                                    style={styles.hiddenInput}
                                    value={otp}
                                    onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, "").slice(0, 4))}
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    autoFocus={true}
                                />
                            </View>

                            {/* Timer and Resend */}
                            <View style={styles.timerContainer}>
                                <Text style={styles.timerText}>Remaining time: {formattedTimer}</Text>
                                <Text style={styles.resendText}>
                                    Didn't got the code?{" "}
                                    <Text 
                                        style={styles.resendLink}
                                        onPress={handleResendOtp}
                                    >
                                        Resend
                                    </Text>
                                </Text>
                            </View>

                            {/* Buttons */}
                            <TouchableOpacity 
                                style={[styles.button, isLoading && { opacity: 0.7 }]} 
                                onPress={handleVerifyOtp}
                                disabled={isLoading}
                                activeOpacity={0.8}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.buttonText}>Verify</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.cancelButton} 
                                onPress={() => setNeedsOtp(false)}
                                disabled={isLoading}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
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
                                <Ionicons name="shield-checkmark" size={32} color="#1b5bf7" />
                            </View>
                        </View>
                        <Text style={styles.header}>Secure Your Account</Text>
                        <Text style={styles.subtext}>
                            For your security, you must set a new password and link your personal email before accessing your dashboard.
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
                                onChangeText={(text) => setCurrentPassword(text.slice(0, 20))}
                                maxLength={20}
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

                        {/* Personal Email Address */}
                        <Text style={styles.inputLabel}>Personal Email Address</Text>
                        <View style={[styles.inputContainer, showEmailNotReal && { borderColor: "#EF4444", borderWidth: 1.5 }]}>
                            <Ionicons name="mail-outline" size={20} color={showEmailNotReal ? "#EF4444" : "#94A3B8"} style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder="name@gmail.com"
                                placeholderTextColor="#94A3B8"
                                value={personalEmail}
                                onChangeText={(text) => {
                                    setPersonalEmail(text.slice(0, 40));
                                    if (emailServerError) setEmailServerError("");
                                }}
                                onBlur={() => setEmailTouched(true)}
                                maxLength={40}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>
                        {showEmailNotReal ? (
                            <Text style={{ fontSize: 11, color: "#EF4444", marginTop: -12, marginBottom: 16, marginLeft: 4, fontWeight: "600" }}>
                                {emailServerError || "Not a real email"}
                            </Text>
                        ) : (
                            <Text style={{ fontSize: 11, color: "#94A3B8", marginTop: -12, marginBottom: 16, marginLeft: 4 }}>
                                This email will be used for password resets.
                            </Text>
                        )}

                        {/* New Password */}
                        <Text style={styles.inputLabel}>New Password</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Minimum 8 characters, letters & numbers"
                                placeholderTextColor="#94A3B8"
                                value={newPassword}
                                onChangeText={(text) => setNewPassword(text.slice(0, 20))}
                                maxLength={20}
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
                        <View style={[styles.inputContainer, showConfirmPasswordMismatch && { borderColor: "#EF4444", borderWidth: 1.5 }]}>
                            <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Re-enter your new password"
                                placeholderTextColor="#94A3B8"
                                value={confirmPassword}
                                onChangeText={(text) => setConfirmPassword(text.slice(0, 20))}
                                maxLength={20}
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
                        {showConfirmPasswordMismatch && (
                            <Text style={{ fontSize: 11, color: "#EF4444", marginTop: -12, marginBottom: 16, marginLeft: 4 }}>
                                Passwords do not match.
                            </Text>
                        )}

                        {/* Submit button */}
                        <TouchableOpacity 
                            style={[styles.button, (!isFormValid || isLoading) && { backgroundColor: "#94A3B8", opacity: 0.7 }]} 
                            onPress={handlePasswordChange}
                            disabled={!isFormValid || isLoading}
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
    otpHeader: {
        fontSize: 28,
        fontWeight: "800",
        color: "#0F172A",
        marginBottom: 12,
    },
    otpSubtext: {
        fontSize: 14,
        color: "#64748B",
        lineHeight: 20,
        marginBottom: 24,
    },
    otpWrapper: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
        alignSelf: "center",
        position: "relative",
        marginVertical: 24,
        paddingHorizontal: 8,
    },
    otpBox: {
        width: 58,
        height: 58,
        borderWidth: 1.5,
        borderColor: "#CBD5E1",
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F8FAFC",
    },
    otpBoxFocused: {
        borderColor: "#2563EB",
        backgroundColor: "#FFFFFF",
    },
    otpDigit: {
        fontSize: 22,
        fontWeight: "700",
        color: "#0F172A",
    },
    hiddenInput: {
        position: "absolute",
        opacity: 0,
        width: "100%",
        height: "100%",
    },
    timerContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
        marginBottom: 28,
        paddingHorizontal: 2,
    },
    timerText: {
        fontSize: 12.5,
        color: "#64748B",
        fontWeight: "500",
    },
    resendText: {
        fontSize: 12.5,
        color: "#64748B",
        fontWeight: "500",
    },
    resendLink: {
        color: "#2563EB",
        fontWeight: "700",
    },
    cancelButton: {
        borderWidth: 1.5,
        borderColor: "#CBD5E1",
        borderRadius: 20,
        height: 54,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 12,
    },
    cancelButtonText: {
        color: "#64748B",
        fontSize: 16,
        fontWeight: "700",
    },
}) as any;
