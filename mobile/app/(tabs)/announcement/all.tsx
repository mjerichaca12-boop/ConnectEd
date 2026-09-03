import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, FlatList, ActivityIndicator, TouchableOpacity, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../../../src/constants/Colors";
import AppHeader from "../../../src/components/common/AppHeader";
import AnnouncementCard from "../../../src/components/cards/AnnouncementCard";
import { useAnnouncementsQuery } from "../../../src/hooks/query/announcements/use-announcements-query";

export default function AllAnnouncementsScreen() {
    const router = useRouter();
    const { data: announcements = [], isLoading } = useAnnouncementsQuery();

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.light.forestGreen} />
            <AppHeader
                title="All Announcements"
                showBack={true}
                onBack={() => router.replace("/(tabs)/home" as any)}
                hasNotifications={true}
            />

            <View style={styles.banner}>
                <Text style={styles.bannerTitle}>Announcements</Text>
                <Text style={styles.bannerSub}>Stay up-to-date with the latest news</Text>
            </View>

            {isLoading ? (
                <ActivityIndicator size="large" color={Colors.light.primary} style={{ marginTop: 40 }} />
            ) : announcements.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="megaphone-outline" size={56} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>No Announcements</Text>
                    <Text style={styles.emptyText}>There are no announcements yet. Check back soon!</Text>
                </View>
            ) : (
                <FlatList
                    data={announcements}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <AnnouncementCard
                            title={item.title}
                            content={item.content}
                            date={item.date}
                            author={item.author || "Faculty"}
                            attachments={item.attachments}
                            onPress={() =>
                                router.push({
                                    pathname: `/(tabs)/announcement/${item.id}`,
                                    params: { from: "home" },
                                } as any)
                            }
                        />
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
        marginBottom: 8,
    },
    bannerTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#FFFFFF",
    },
    bannerSub: {
        fontSize: 14,
        color: "rgba(255,255,255,0.8)",
        marginTop: 4,
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    emptyContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 40,
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
