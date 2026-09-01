import { useRouter, Href } from "expo-router";
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Platform, StatusBar, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import AppHeader from "../../src/components/common/AppHeader";
import Colors from "../../src/constants/Colors";
import WelcomeBanner from "../../src/components/teacher/WelcomeBanner";
import QuickActionCard from "../../src/components/teacher/QuickActionCard";
import StatCard from "../../src/components/teacher/StatCard";
import EventCard from "../../src/components/teacher/EventCard";
import { useEventsQuery } from "../../src/hooks/query/events/use-events-query";
import { ActivityIndicator } from "react-native";

export default function TeacherHomeScreen() {
    const router = useRouter();
    const [userName, setUserName] = useState("Teacher");
    const { data: events = [], isLoading: isEventsLoading } = useEventsQuery(3);


    useEffect(() => {
        const loadProfile = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            if (session.user.email) {
                const name = session.user.email.split("@")[0];
                setUserName(name.charAt(0).toUpperCase() + name.slice(1));
            }
        };
        loadProfile();
    }, []);

    const handleAction = (action: string) => {
        switch(action) {
            case "Grades":
                router.push("/(tabs)/teacher/grades" as Href);
                break;
            case "Announcement":
                router.push("/(tabs)/teacher/announcements" as Href);
                break;
            case "Message":
                router.push("/(tabs)/messages" as Href);
                break;
            case "Materials":
                router.push("/(tabs)/teacher/materials" as Href);
                break;
        }
    };



    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.light.forestGreen} />
            <AppHeader title="Dashboard" hasNotifications={true} />
            
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Green Welcome Banner */}
                <View style={styles.welcomeBanner}>
                    <Text style={styles.welcomeTitle}>Welcome, {userName}!</Text>
                    <Text style={styles.welcomeSub}>Here&apos;s an overview of your teaching responsibilities</Text>
                </View>

                {/* Quick Actions Grid */}
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.grid}>
                    <TouchableOpacity style={styles.actionCard} onPress={() => handleAction("Grades")}>
                        <Ionicons name="trending-up" size={28} color="#3B82F6" />
                        <View style={styles.actionTextContainer}>
                            <Text style={styles.actionTitle}>Encode Grades</Text>
                            <Text style={styles.actionDesc}>Input student grades</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionCard} onPress={() => handleAction("Announcement")}>
                        <Ionicons name="megaphone" size={28} color="#F59E0B" />
                        <View style={styles.actionTextContainer}>
                            <Text style={styles.actionTitle}>Post Announcement</Text>
                            <Text style={styles.actionDesc}>Share with students</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionCard} onPress={() => handleAction("Message")}>
                        <Ionicons name="chatbubble-ellipses" size={28} color="#6366F1" />
                        <View style={styles.actionTextContainer}>
                            <Text style={styles.actionTitle}>Send Message</Text>
                            <Text style={styles.actionDesc}>Contact students</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionCard} onPress={() => handleAction("Materials")}>
                        <Ionicons name="folder-open" size={28} color={Colors.light.primary} />
                        <View style={styles.actionTextContainer}>
                            <Text style={styles.actionTitle}>Materials</Text>
                            <Text style={styles.actionDesc}>Manage all files</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Upcoming Events Section */}
                {(isEventsLoading || events.length > 0) && (
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

                {/* School Calendar Placeholder */}
                <View style={styles.calendarSection}>
                    <TouchableOpacity style={styles.calendarHeader} onPress={() => router.push("/(tabs)/calendar" as Href)}>
                        <Ionicons name="calendar-outline" size={20} color={Colors.light.primary} />
                        <Text style={styles.calendarHeaderText}>School Calendar</Text>
                        <Ionicons name="chevron-forward" size={16} color="#94A3B8" style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>
                    <View style={styles.calendarContent}>
                        <Text style={styles.calendarMonth}>May 2026</Text>
                        <View style={styles.calendarGrid}>
                            <Text style={styles.calendarPlaceholder}>[ Calendar Interface ]</Text>
                            <Text style={styles.calendarEvent}>• Labor Day (May 1)</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
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
        marginBottom: 8,
    },
    welcomeSub: {
        fontSize: 14,
        color: "rgba(255, 255, 255, 0.8)",
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 16,
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginBottom: 24,
    },
    actionCard: {
        width: "48%",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#F1F5F9",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    actionTextContainer: {
        marginTop: 12,
    },
    actionTitle: {
        fontSize: 15,
        fontWeight: "bold",
        color: "#1E293B",
    },
    actionDesc: {
        fontSize: 12,
        color: "#64748B",
        marginTop: 4,
    },
    calendarSection: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    calendarHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    calendarHeaderText: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#1E293B",
        marginLeft: 8,
    },
    calendarContent: {
        alignItems: "center",
    },
    calendarMonth: {
        fontSize: 15,
        fontWeight: "700",
        color: "#1E293B",
        marginBottom: 12,
    },
    calendarGrid: {
        width: "100%",
        padding: 12,
        backgroundColor: "#F8FAFC",
        borderRadius: 8,
        alignItems: "center",
    },
    calendarPlaceholder: {
        color: "#94A3B8",
        fontStyle: "italic",
        marginBottom: 8,
    },
    calendarEvent: {
        fontSize: 13,
        color: Colors.light.primary,
        fontWeight: "600",
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
