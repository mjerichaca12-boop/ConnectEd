import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../../src/constants/Colors";
import Layout from "../../src/constants/Layout";
import AppHeader from "../../src/components/common/AppHeader";

export default function EnrollmentScreen() {
    const [requirements, setRequirements] = useState([
        { id: 1, label: "Registration Form", completed: true },
        { id: 2, label: "Medical Certificate", completed: true },
        { id: 3, label: "Payment of Fees", completed: false },
        { id: 4, label: "ID Photo Submission", completed: true },
        { id: 5, label: "Student Handbook Agreement", completed: false },
    ]);

    const toggleRequirement = (id: number) => {
        setRequirements(requirements.map(item => 
            item.id === id ? { ...item, completed: !item.completed } : item
        ));
    };

    const completedCount = requirements.filter((r) => r.completed).length;

    return (
        <View style={styles.container}>
            <AppHeader title="Enrollment" />
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.header}>Requirements Checklist</Text>

                <View style={styles.progressCard}>
                    <Text style={styles.progressLabel}>Completion Status</Text>
                    <Text style={styles.progressValue}>{completedCount}/{requirements.length}</Text>
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${(completedCount / requirements.length) * 100}%` }]} />
                    </View>
                </View>

                {requirements.map((item) => (
                    <TouchableOpacity 
                        key={item.id} 
                        style={styles.requirementItem}
                        onPress={() => toggleRequirement(item.id)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.checkbox, item.completed && styles.checkboxCompleted]}>
                            {item.completed && (
                                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                            )}
                        </View>
                        <Text style={[styles.requirementLabel, item.completed && styles.requirementCompleted]}>
                            {item.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    content: {
        padding: Layout.spacing.m,
    },
    header: {
        fontSize: 22,
        fontWeight: "bold",
        color: Colors.light.text,
        marginBottom: Layout.spacing.m,
    },
    progressCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
    },
    progressLabel: {
        fontSize: 14,
        color: Colors.light.textSecondary,
        marginBottom: 8,
    },
    progressValue: {
        fontSize: 32,
        fontWeight: "bold",
        color: Colors.light.primary,
        marginBottom: 12,
    },
    progressBar: {
        height: 8,
        backgroundColor: Colors.light.background,
        borderRadius: 4,
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        backgroundColor: Colors.light.primary,
        borderRadius: 4,
    },
    requirementItem: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: Colors.light.border,
        marginRight: 14,
        justifyContent: "center",
        alignItems: "center",
    },
    checkboxCompleted: {
        backgroundColor: Colors.light.primary,
        borderColor: Colors.light.primary,
    },
    requirementLabel: {
        fontSize: 16,
        color: Colors.light.text,
        flex: 1,
    },
    requirementCompleted: {
        textDecorationLine: "line-through",
        color: Colors.light.textSecondary,
    },
});
