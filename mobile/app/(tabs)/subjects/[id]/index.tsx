import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Colors from "../../../../src/constants/Colors";
import Layout from "../../../../src/constants/Layout";

import { useSubjectDetailQuery } from "../../../../src/hooks/query/subjects/use-subject-detail-query";
import { ActivityIndicator } from "react-native";

export default function SubjectOverview() {
    const { id } = useLocalSearchParams();
    const { data: subject, isLoading } = useSubjectDetailQuery(id as string);

    if (isLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.card}>
                <Text style={styles.title}>Welcome to {subject?.name || id}</Text>
                <Text style={styles.description}>
                    {subject?.description || "This course covers advanced topics in the field. Please check announcements regularly."}
                </Text>
            </View>

            <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Instructor</Text>
                <View style={styles.row}>
                    <View style={styles.avatar} />
                    <View>
                        <Text style={styles.name}>{subject?.teacher_name || "Dr. Professor"}</Text>
                        <Text style={styles.email}>{subject?.teacher_email || "professor@university.edu"}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Schedule</Text>
                <Text style={styles.text}>Mon/Wed 10:00 AM - 11:30 AM</Text>
                <Text style={styles.text}>Room 305 / Online</Text>
            </View>
        </ScrollView>
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
    card: {
        backgroundColor: "#FFFFFF",
        padding: 24,
        borderRadius: 16,
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: Colors.light.primary,
        marginBottom: 8,
    },
    description: {
        fontSize: 16,
        color: Colors.light.textSecondary,
        lineHeight: 24,
    },
    infoSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: Colors.light.text,
        marginBottom: 12,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "#CBD5E1",
        marginRight: 16,
    },
    name: {
        fontSize: 16,
        fontWeight: "600",
        color: Colors.light.text,
    },
    email: {
        fontSize: 14,
        color: Colors.light.primary,
    },
    text: {
        fontSize: 16,
        color: Colors.light.text,
        marginBottom: 4,
    },
});
