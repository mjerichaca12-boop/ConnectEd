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
        if (!email || !password) {
            alert("Please enter your username/ email address and password.");
            return;
        }

        setIsLoading(true);
        try {
            const normalizedInput = email.trim().toLowerCase();

            // First, find profile by email or username
            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("id, role, must_change_password, email, username")
                .or(`email.ilike.${normalizedInput},username.ilike.${normalizedInput}`)
                .maybeSingle();

            if (profileError || !profile) {
                alert("Wrong password or email/username. Please check your credentials and try again.");
                setIsLoading(false);
                return;
            }

            // Try signing in with the email from the profile first
            let signInResult = await supabase.auth.signInWithPassword({
                email: profile.email,
                password,
            });

            // Fallback: try logging in with username@temp.local if email sign-in fails and username exists
            if (signInResult.error && profile.username) {
                const retryResult = await supabase.auth.signInWithPassword({
                    email: `${profile.username.toLowerCase()}@temp.local`,
                    password,
                });
                if (!retryResult.error) {
                    signInResult = retryResult;
                }
            }

            if (signInResult.error) throw signInResult.error;

            if (profile.role !== 'student') {
                await supabase.auth.signOut();
                alert("Only student accounts are permitted to use the mobile application. Teachers must use the web portal.");
                return;
            }

            if (profile.must_change_password) {
                router.replace("/(auth)/secure-account" as Href);
            } else {
                router.replace("/(tabs)/home" as Href);
            }
        } catch (error: any) {
            console.log("Login failed: invalid credentials or network error");
            if (error.message && error.message.toLowerCase().includes("credentials")) {
                alert("Wrong password or email/username. Please check your credentials and try again.");
            } else {
                alert(error.message || "Wrong password or email/username.");
            }
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
                            onChangeText={(text) => setEmail(text.replace(/\s/g, '').slice(0, 30))}
                            maxLength={30}
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
                            onChangeText={(text) => setPassword(text.replace(/\s/g, '').slice(0, 15))}
                            maxLength={15}
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
