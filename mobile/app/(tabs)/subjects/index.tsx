import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, StatusBar, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../../../src/constants/Colors";
import SubjectCard from "../../../src/components/cards/SubjectCard";
import AppHeader from "../../../src/components/common/AppHeader";
import { useMyEnrollmentsQuery } from "../../../src/hooks/query/enrollments/use-my-enrollments-query";

export default function SubjectsScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");

    const { data: myEnrollments = [], isLoading, refetch, isError } = useMyEnrollmentsQuery();

    // Refetch every time this screen comes into focus
    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [refetch])
    );

    const enrichedSubjects = Array.from(
        new Map(
            myEnrollments
                .filter(enrollment => enrollment.subjects)
                .map(enrollment => {
                    const sub = enrollment.subjects!;
                    return [
                        sub.id,
                        {
                            id: sub.id ?? "",
                            code: sub.code ?? "",
                            name: sub.name ?? "",
                            teacher: sub.profiles
                                ? `${sub.profiles.first_name || ""} ${sub.profiles.last_name || ""}`.trim()
                                : "Faculty",
                            enrollStatus: enrollment.status,
                        }
                    ];
                })
        ).values()
    ).filter(s => s.id !== "");

    const filteredSubjects = enrichedSubjects.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusIcon = (status: string) => {
        if (status === "accepted") return "checkmark-circle-outline";
        if (status === "pending") return "time-outline";
        return "close-circle-outline";
    };

    const getStatusColor = (status: string) => {
        if (status === "accepted") return "#15803D";
        if (status === "pending") return "#D97706";
        return "#DC2626";
    };

    const getStatusLabel = (status: string) => {
        if (status === "accepted") return "Enrolled ✓";
        if (status === "pending") return "Waiting for Approval";
        return "Not Accepted";
    };

    const getStatusBtnStyle = (status: string) => {
        if (status === "accepted") return styles.acceptedBtn;
        if (status === "pending") return styles.pendingBtn;
        return styles.rejectedBtn;
    };

    const getStatusTextStyle = (status: string) => {
        if (status === "accepted") return styles.acceptedBtnText;
        if (status === "pending") return styles.pendingBtnText;
        return styles.rejectedBtnText;
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.light.forestGreen} />
            <AppHeader title="My Subjects" hasNotifications={true} />

            <View style={styles.banner}>
                <Text style={styles.bannerTitle}>Your Subjects</Text>
                <Text style={styles.bannerSub}>Subjects added by your teacher will appear here</Text>
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={20} color="#94A3B8" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search subjects..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                    <Text style={styles.loadingText}>Loading your subjects...</Text>
                </View>
            ) : filteredSubjects.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="book-outline" size={56} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>No Subjects Yet</Text>
                    <Text style={styles.emptyText}>
                        Your teacher will add you to subjects.{'\n'}You&apos;ll see them here once added!
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredSubjects}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <View style={styles.subjectCardWrapper}>
                            <SubjectCard
                                code={item.code}
                                title={item.name}
                                teacher={item.teacher}
                                schedule={"TBA"}
                                onPress={() => {
                                    if (item.enrollStatus === "accepted") {
                                        router.push(`/subjects/${item.id}` as any);
                                    }
                                }}
                                style={{
                                    marginBottom: 0,
                                    borderBottomLeftRadius: 0,
                                    borderBottomRightRadius: 0,
                                    borderBottomWidth: 0,
                                }}
                            />
                            <View style={getStatusBtnStyle(item.enrollStatus)}>
                                <Ionicons
                                    name={getStatusIcon(item.enrollStatus)}
                                    size={16}
                                    color={getStatusColor(item.enrollStatus)}
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={getStatusTextStyle(item.enrollStatus)}>
                                    {getStatusLabel(item.enrollStatus)}
                                </Text>
                            </View>
                        </View>
                    )}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    banner: {
        backgroundColor: Colors.light.primary,
        padding: 24,
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 16,
    },
    bannerTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#FFFFFF",
    },
    bannerSub: {
        fontSize: 14,
        color: "rgba(255, 255, 255, 0.85)",
        marginTop: 4,
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        marginHorizontal: 16,
        marginTop: 16,
        paddingHorizontal: 16,
        height: 50,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: "#1E293B",
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    subjectCardWrapper: {
        marginBottom: 16,
    },
    pendingBtn: {
        backgroundColor: "#FEF3C7",
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderTopWidth: 0,
    },
    pendingBtnText: {
        color: "#D97706",
        fontWeight: "bold",
        fontSize: 14,
    },
    acceptedBtn: {
        backgroundColor: "#DCFCE7",
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderTopWidth: 0,
    },
    acceptedBtnText: {
        color: "#15803D",
        fontWeight: "bold",
        fontSize: 14,
    },
    rejectedBtn: {
        backgroundColor: "#FEE2E2",
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderTopWidth: 0,
    },
    rejectedBtnText: {
        color: "#DC2626",
        fontWeight: "bold",
        fontSize: 14,
    },
    loadingContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    loadingText: {
        marginTop: 12,
        color: "#64748B",
        fontSize: 14,
    },
    emptyContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 40,
        paddingTop: 20,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1E293B",
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: "#64748B",
        textAlign: "center",
        lineHeight: 22,
    },
});
