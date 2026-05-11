import React, { useState } from "react";
import { View, StyleSheet, FlatList, Text, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Colors from "../../../../src/constants/Colors";
import Layout from "../../../../src/constants/Layout";
import AppHeader from "../../../../src/components/common/AppHeader";
import AnnouncementCard from "../../../../src/components/cards/AnnouncementCard";
import { useAnnouncementsQuery } from "../../../../src/hooks/query/announcements/use-announcements-query";

export default function SubjectAnnouncements() {
    const { id: subjectId } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    
    const { data: announcements, isLoading } = useAnnouncementsQuery({ subjectId });

    if (isLoading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <AppHeader title="Subject Announcements" showBack={true} />
            <FlatList
                data={announcements}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.content}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No announcements found for this subject.</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <AnnouncementCard
                        title={item.title}
                        content={item.content}
                        date={item.date}
                        author={item.author}
                        image_url={item.image_url}
                        onPress={() => router.push({ pathname: `/(tabs)/announcement/${item.id}`, params: { from: 'subject' } } as any)}
                    />
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    centered: {
        justifyContent: "center",
        alignItems: "center",
    },
    emptyContainer: {
        padding: 40,
        alignItems: "center",
    },
    emptyText: {
        fontSize: 16,
        color: Colors.light.textSecondary,
        textAlign: "center",
    },
    content: {
        padding: Layout.spacing.m,
    },
});

