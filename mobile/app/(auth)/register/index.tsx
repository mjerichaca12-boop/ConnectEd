import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Alert,
} from "react-native";
import { useRouter, Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import styles from "./_styles";

export default function RegisterScreen() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [role, setRole] = useState<"student" | "teacher">("student");

    const [formData, setFormData] = useState({
        firstName: "",
        middleName: "",
        lastName: "",
        email: "",
        phone: "",
        gradeLevel: "",
        password: "",
        confirmPassword: "",
    });

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const validatePassword = (pass: string) => {
        if (pass.length < 12) return "Password must be at least 12 characters long.";
        if (!/[0-9]/.test(pass)) return "Password must contain at least one number.";
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(pass)) return "Password must contain at least one special character.";
        return null;
    };

    const handleRegister = async () => {
        const { firstName, lastName, email, phone, gradeLevel, password, confirmPassword } = formData;

        if (!firstName || !lastName || !email || !password || (role === "student" && !gradeLevel)) {
            Alert.alert("Error", "Please fill in all required fields.");
            return;
        }

        if (!email.toLowerCase().endsWith("@gmail.com")) {
            Alert.alert("Error", "Please use a valid Gmail account.");
            return;
        }

        const passError = validatePassword(password);
        if (passError) {
            Alert.alert("Error", passError);
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert("Error", "Passwords do not match.");
            return;
        }

        setIsLoading(true);
        try {
            const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

            const response = await fetch(`${API_URL}/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    password,
                    role,
                    firstName: firstName.trim(),
                    middleName: formData.middleName.trim(),
                    lastName: lastName.trim(),
                    year: gradeLevel,
                    phone: phone.trim(),
                    status: "Active",
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Registration failed");
            }

            Alert.alert(
                "Success",
                "Account created! Please check your email for verification.",
                [{ text: "OK", onPress: () => router.replace("/login" as Href) }]
            );
        } catch (error: any) {
            console.error("Registration error:", error);
            Alert.alert("Registration Failed", error.message || "An error occurred.");
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
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <TouchableOpacity 
                        style={{ position: 'absolute', top: 10, left: 0, zIndex: 10 }} 
                        onPress={() => router.back()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#1A202C" />
                    </TouchableOpacity>

                    <Text style={styles.header}>Create Account</Text>

                    <View style={styles.roleContainer}>
                        <TouchableOpacity 
                            style={[styles.roleChip, role === "student" && styles.roleChipActive]}
                            onPress={() => setRole("student")}
                        >
                            <Text style={[styles.roleChipText, role === "student" && styles.roleChipTextActive]}>Student</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.roleChip, role === "teacher" && styles.roleChipActive]}
                            onPress={() => setRole("teacher")}
                        >
                            <Text style={[styles.roleChipText, role === "teacher" && styles.roleChipTextActive]}>Teacher</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.card}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>First Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Juan"
                                value={formData.firstName}
                                onChangeText={(val) => handleInputChange("firstName", val)}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Middle Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Optional"
                                value={formData.middleName}
                                onChangeText={(val) => handleInputChange("middleName", val)}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Last Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Dela Cruz"
                                value={formData.lastName}
                                onChangeText={(val) => handleInputChange("lastName", val)}
                            />
                        </View>

                        {role === "student" && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Grade Level *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. 10"
                                    value={formData.gradeLevel}
                                    onChangeText={(val) => handleInputChange("gradeLevel", val)}
                                    keyboardType="numeric"
                                />
                            </View>
                        )}

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Gmail Address *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="example@gmail.com"
                                value={formData.email}
                                onChangeText={(val) => handleInputChange("email", val)}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Phone Number</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="09XXXXXXXXX"
                                value={formData.phone}
                                onChangeText={(val) => handleInputChange("phone", val)}
                                keyboardType="phone-pad"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Password *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="••••••••••••"
                                value={formData.password}
                                onChangeText={(val) => handleInputChange("password", val)}
                                secureTextEntry
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Confirm Password *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="••••••••••••"
                                value={formData.confirmPassword}
                                onChangeText={(val) => handleInputChange("confirmPassword", val)}
                                secureTextEntry
                            />
                        </View>

                        <TouchableOpacity 
                            style={[styles.registerButton, isLoading && { opacity: 0.7 }]} 
                            onPress={handleRegister}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.registerButtonText}>Register</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => router.replace("/login" as Href)}>
                            <Text style={styles.signInText}>Sign In</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
