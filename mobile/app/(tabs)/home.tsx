import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../../src/constants/Colors";
import AnnouncementCard from "../../src/components/cards/AnnouncementCard";
import AppHeader from "../../src/components/common/AppHeader";
import { supabase } from "../../src/lib/supabase";
import { useAnnouncementsQuery } from "../../src/hooks/query/announcements/use-announcements-query";
import { useEventsQuery } from "../../src/hooks/query/events/use-events-query";
import { useMyEnrollmentsQuery } from "../../src/hooks/query/enrollments/use-my-enrollments-query";
import { useMyAssignmentsQuery } from "../../src/hooks/query/assignments/use-my-assignments-query";
import { TaskSummarySection } from "../../src/components/sections/TaskSummarySection";

export default function HomeScreen() {
    const router = useRouter();
    const [displayName, setDisplayName] = useState("Student");
    const { data: announcementsData, isLoading: isAnnouncementsLoading, refetch: refetchAnnouncements } = useAnnouncementsQuery({ limit: 3 });
    const { data: eventsData, isLoading: isEventsLoading } = useEventsQuery(3);
    const { data: enrollments, isLoading: isEnrollmentsLoading } = useMyEnrollmentsQuery();
    
    const { data: assignments = [], isLoading: isAssignmentsLoading } = useMyAssignmentsQuery();
    
    const announcements = announcementsData || [];
    const events = eventsData || [];

    const taskSummary = {
        upcoming: assignments.filter(a => a.status === 'pending').length,
        submitted: assignments.filter(a => a.status === 'submitted' || a.status === 'graded' || a.status === 'returned').length,
        late: assignments.filter(a => a.status === 'late').length
    };

    const isEnrolled = enrollments?.some(e => e.status === 'accepted') || false;

    const loadDisplayName = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            const userId = session.user.id;

            // Try profiles table first (reflects edits made in profile page)
            const { data: profile } = await supabase
                .from("profiles")
                .select("first_name, last_name, is_verified")
                .eq("id", userId)
                .single();

            if (profile?.first_name) {
                const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
                setDisplayName(fullName);
                return;
            }

            // Fallback: user_metadata.firstName set at registration
            const meta = session.user.user_metadata || {};
            if (meta.firstName) {
                setDisplayName(meta.firstName);
                return;
            }

            // Last resort: derive from email
            const email = session.user.email || "";
            const name = email.split("@")[0];
            setDisplayName(name.charAt(0).toUpperCase() + name.slice(1));
        } catch (err) {
            console.warn("Failed to load display name:", err);
        }
    }, []);

    // Re-load name every time this screen comes into focus
    // (so profile name changes are reflected immediately)
    useFocusEffect(
        useCallback(() => {
            loadDisplayName();
            refetchAnnouncements();
        }, [loadDisplayName, refetchAnnouncements])
    );


    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.light.forestGreen} />
            <AppHeader
                title="Student Portal"
                showBack={false}
                hasNotifications={true}
            />
            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Green Welcome Banner */}
                <View style={styles.welcomeBanner}>
                    <Text style={styles.welcomeTitle}>Welcome, {displayName}!</Text>
                    <Text style={styles.welcomeSub}>Here&apos;s what&apos;s happening today</Text>
                </View>

                {/* Task Summary Section */}
                <TaskSummarySection counts={taskSummary} />

                {/* Latest Announcements Section - Visible only if Enrolled */}
                {isEnrolled && !isAnnouncementsLoading && announcements.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Latest Announcements</Text>
                            <TouchableOpacity onPress={() => router.push("/(tabs)/announcement/all" as any)}>
                                <Text style={styles.link}>See All</Text>
                            </TouchableOpacity>
                        </View>
                        {announcements.map((ann) => (
                            <AnnouncementCard
                                key={ann.id}
                                title={ann.title}
                                content={ann.content}
                                date={ann.date}
                                author={ann.author || "Faculty"}
                                author_role={ann.author_role}
                                image_url={ann.image_url}
                                attachments={ann.attachments}
                                onPress={() =>
                                    router.push({
                                        pathname: `/(tabs)/announcement/${ann.id}`,
                                        params: { from: "home" },
                                    } as any)
                                }
                            />
                        ))}
                    </View>
                )}

                {/* School Calendar Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>School Calendar</Text>
                        <TouchableOpacity onPress={() => router.push("/(tabs)/calendar" as any)}>
                            <Text style={styles.link}>View Full</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                        style={styles.calendarMiniCard}
                        onPress={() => router.push("/(tabs)/calendar" as any)}
                    >
                        <View style={styles.calendarIconBox}>
                            <Ionicons name="calendar" size={24} color={Colors.light.primary} />
                        </View>
                        <View style={styles.calendarMiniInfo}>
                            <Text style={styles.calendarMiniTitle}>View School Events</Text>
                            <Text style={styles.calendarMiniSub}>Tap to see upcoming events & holidays</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                    </TouchableOpacity>
                </View>

                {/* Upcoming Events Section - Visible only if Enrolled */}
                {isEnrolled && (isEventsLoading || events.length > 0) && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Upcoming Events</Text>
                        </View>
                        {isEventsLoading ? (
                            <ActivityIndicator size="small" color={Colors.light.primary} />
                        ) : (
                            events.map((event) => (
                                <View key={event.id} style={styles.eventItem}>
                                    <View style={[styles.eventColorBar, { backgroundColor: event.color || Colors.light.primary }]} />
                                    <View style={styles.eventInfo}>
                                        <Text style={styles.eventTitle}>{event.title}</Text>
                                        <Text style={styles.eventDate}>{event.date}</Text>
                                    </View>
                                    <View style={styles.eventTypeTag}>
                                        <Text style={styles.eventTypeText}>{event.type}</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    scrollContainer: {
        flex: 1,
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    welcomeBanner: {
        backgroundColor: Colors.light.primary,
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
    },
    welcomeTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#FFFFFF",
        marginBottom: 4,
    },
    welcomeSub: {
        fontSize: 14,
        color: "rgba(255, 255, 255, 0.85)",
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1E293B",
    },
    link: {
        color: Colors.light.primary,
        fontWeight: "600",
        fontSize: 14,
    },
    calendarMiniCard: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    calendarIconBox: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: "#F0FDF4",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 16,
    },
    calendarMiniInfo: {
        flex: 1,
    },
    calendarMiniTitle: {
        fontSize: 15,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 2,
    },
    calendarMiniSub: {
        fontSize: 12,
        color: "#64748B",
    },
    emptyCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 28,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    emptyText: {
        fontSize: 14,
        color: "#94A3B8",
        textAlign: "center",
    },
    eventItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    eventColorBar: {
        width: 4,
        height: "80%",
        borderRadius: 2,
        marginRight: 12,
    },
    eventInfo: {
        flex: 1,
    },
    eventTitle: {
        fontSize: 15,
        fontWeight: "bold",
        color: "#1E293B",
    },
    eventDate: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 2,
    },
    eventTypeTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: "#F1F5F9",
        borderRadius: 6,
    },
    eventTypeText: {
        fontSize: 10,
        fontWeight: "bold",
        color: "#64748B",
        textTransform: "uppercase",
    },
});
