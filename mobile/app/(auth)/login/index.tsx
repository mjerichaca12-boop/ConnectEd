import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from "react-native";
import { useRouter, Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../src/lib/supabase";
import styles from "./_styles";

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async () => {
        if (!email.trim() || !password) {
            alert("Please enter your username/ email address and password.");
            return;
        }

        setIsLoading(true);
        try {
            const normalizedInput = email.trim().toLowerCase();

            // 1. Try to find profile by email or username
            const { data: profile } = await supabase
                .from("profiles")
                .select("id, role, must_change_password, email, username")
                .or(`email.ilike.${normalizedInput},username.ilike.${normalizedInput}`)
                .maybeSingle();

            let signInResult: any = null;

            if (profile?.email) {
                // Try signing in with the email from the profile first
                signInResult = await supabase.auth.signInWithPassword({
                    email: profile.email,
                    password,
                });
            }

            // Fallback 1: try logging in with username@temp.local if email sign-in fails
            if ((!signInResult || signInResult.error) && profile?.username) {
                const retryResult = await supabase.auth.signInWithPassword({
                    email: `${profile.username.toLowerCase()}@temp.local`,
                    password,
                });
                if (!retryResult.error) {
                    signInResult = retryResult;
                }
            }

            // Fallback 2: try signing in directly with the exact input entered
            if (!signInResult || signInResult.error) {
                const directResult = await supabase.auth.signInWithPassword({
                    email: normalizedInput,
                    password,
                });
                if (!directResult.error) {
                    signInResult = directResult;
                }
            }

            if (!signInResult || signInResult.error) {
                alert("Wrong password or email/username. Please check your credentials and try again.");
                setIsLoading(false);
                return;
            }

            // Fetch the authenticated user's profile
            const authUserId = signInResult.data?.user?.id;
            let currentProfile = profile;
            if (!currentProfile && authUserId) {
                const { data: pData } = await supabase
                    .from("profiles")
                    .select("id, role, must_change_password, email, username")
                    .eq("id", authUserId)
                    .maybeSingle();
                currentProfile = pData;
            }

            if (currentProfile && currentProfile.role && currentProfile.role !== 'student') {
                await supabase.auth.signOut();
                alert("Only student accounts are permitted to use the mobile application. Teachers must use the web portal.");
                return;
            }

            if (currentProfile?.must_change_password) {
                router.replace("/(auth)/secure-account" as Href);
            } else {
                router.replace("/(tabs)/home" as Href);
            }
        } catch (error: any) {
            console.log("Login failed:", error);
            alert("Wrong password or email/username. Please check your credentials and try again.");
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
                <View style={styles.content}>
                    <Text style={styles.header}>Welcome Back.</Text>
                    <Text style={styles.subtext}>Sign in to access your school portal.</Text>

                    <View style={styles.inputContainer}>
                        <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Username/Email Address"
                            placeholderTextColor="#94A3B8"
                            value={email}
                            onChangeText={(text) => setEmail(text.trim())}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Password field with visibility icon toggle */}
                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#94A3B8"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                            <Ionicons
                                name={showPassword ? "eye-off-outline" : "eye-outline"}
                                size={20}
                                color="#94A3B8"
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Forgot Password link */}
                    <TouchableOpacity
                        onPress={() => router.push("/(auth)/forgot-password" as Href)}
                        style={{ alignSelf: "flex-end", marginTop: -8, marginBottom: 16 }}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.signUpText}>Forgot Password?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.loginButton, isLoading && { opacity: 0.7 }]} 
                        onPress={handleLogin}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.loginButtonText}>Login</Text>
                        )}
                    </TouchableOpacity>

                    <View style={{ height: 20 }} />
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
