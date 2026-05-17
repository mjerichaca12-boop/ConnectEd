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
import { Link, useRouter, Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import styles from "./_styles";

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        if (!email) {
            alert("Please enter your email");
            return;
        }

        setIsLoading(true);
        try {
            const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

            const response = await fetch(`${API_URL}/auth/direct-login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Bypass-Tunnel-Reminder": "true"
                },
                body: JSON.stringify({ email: email.trim() }),
            });

            if (!response.ok) {
                const textError = await response.text();
                throw new Error(textError.includes('Tunnel') ? 'Backend tunnel is down. Please restart it.' : textError);
            }

            const data = await response.json();

            if (data.success && data.session) {
                // Import supabase if not already present
                const { supabase } = require("../../../src/lib/supabase");
                
                const { error } = await supabase.auth.setSession({
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                });

                if (error) {
                    throw error;
                }

                const userRole = data.user?.user_metadata?.role || 'student';
                router.replace(userRole === "teacher" ? "/(tabs)/teacher-home" : "/(tabs)/home" as Href);
            } else {
                alert(data.error || "Login Failed");
            }
        } catch (error: any) {
            console.error("Login failed:", error);
            alert(error.message || "Network error logging in.");
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
                            placeholder="Email Address"
                            placeholderTextColor="#94A3B8"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#94A3B8"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

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

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Don't have an account? </Text>
                        <TouchableOpacity onPress={() => router.push("/(auth)/register" as Href)}>
                            <Text style={styles.signUpText}>Sign Up</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
