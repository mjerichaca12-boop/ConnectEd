import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TextInput, TouchableOpacity, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../../src/components/common/AppHeader";
import Colors from "../../../src/constants/Colors";

import { useMeetingsQuery } from "../../../src/hooks/query/meetings/use-meetings-query";

export default function VideoConferenceScreen() {
    const [searchQuery, setSearchQuery] = useState("");
    const { data: meetings = [], isLoading } = useMeetingsQuery();

    // Compute stats from real data
    const now = new Date();
    const liveCount = meetings.filter(m => {
        const mTime = new Date(m.time);
        const diff = (now.getTime() - mTime.getTime()) / (1000 * 60);
        return diff >= 0 && diff < 60; // Assume 1hr duration if not specified
    }).length;

    const stats = [
        { label: "Total Meetings", value: meetings.length.toString(), icon: "videocam", color: Colors.light.primary },
        { label: "Live Now", value: liveCount.toString(), icon: "play-circle", color: "#EF4444" },
        { label: "Scheduled", value: (meetings.length - liveCount).toString(), icon: "calendar", color: "#3B82F6" },
        { label: "Participants", value: "--", icon: "people", color: "#6366F1" },
    ];

    const renderStatCard = (stat: any) => (
        <View style={styles.statCard} key={stat.label}>
            <View style={styles.statIconContainer}>
                <Ionicons name={stat.icon as any} size={20} color={stat.color} />
            </View>
            <View>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
            </View>
        </View>
    );

    const renderMeetingCard = (meeting: any) => {
        const mDate = new Date(meeting.time);
        const isLive = Math.abs(now.getTime() - mDate.getTime()) < (60 * 60 * 1000); // Simple 1h window
        const status = isLive ? "Ongoing" : (mDate > now ? "Scheduled" : "Passed");

        return (
            <View style={styles.meetingCard} key={meeting.id}>
                <View style={styles.cardTop}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <View style={styles.titleRow}>
                            <Text style={styles.meetingTitle} numberOfLines={2}>{meeting.title}</Text>
                            <View style={[styles.statusBadge, status === "Ongoing" ? styles.bgRed : styles.bgBlue]}>
                                <View style={[styles.dot, status === "Ongoing" ? styles.dotRed : styles.dotBlue]} />
                                <Text style={[styles.statusText, status === "Ongoing" ? styles.textRed : styles.textBlue]}>{status}</Text>
                            </View>
                        </View>
                        <View style={styles.metaRow}>
                            <View style={styles.metaItem}>
                                <Ionicons name="book-outline" size={14} color="#64748B" />
                                <Text style={styles.metaText}>{meeting.subject || meeting.subject_code || "N/A"}</Text>
                            </View>
                            <View style={styles.metaItem}>
                                <Ionicons name="calendar-outline" size={14} color="#64748B" />
                                <Text style={styles.metaText}>{mDate.toLocaleDateString()}</Text>
                            </View>
                            <View style={styles.metaItem}>
                                <Ionicons name="time-outline" size={14} color="#64748B" />
                                <Text style={styles.metaText}>{mDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({meeting.duration})</Text>
                            </View>
                        </View>
                    </View>
                    {status === "Ongoing" && (
                        <TouchableOpacity style={styles.joinButton}>
                            <Ionicons name="videocam" size={18} color="#FFFFFF" />
                            <Text style={styles.joinButtonText}>Join</Text>
                        </TouchableOpacity>
                    )}
                </View>
                
                <View style={styles.linkContainer}>
                    <Text style={styles.linkText} numberOfLines={1}>{meeting.meeting_link || "No link available"}</Text>
                    <TouchableOpacity style={styles.copyButton}>
                        <Ionicons name="copy-outline" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader title="Video Conferencing" hasNotifications={true} />
            
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Banner */}
                <View style={styles.banner}>
                    <View style={styles.bannerLeft}>
                        <Text style={styles.bannerTitle}>Video Conferencing</Text>
                        <Text style={styles.bannerSub}>Manage your virtual classes and meetings</Text>
                    </View>
                    <TouchableOpacity style={styles.scheduleButton}>
                        <Ionicons name="add" size={24} color={Colors.light.primary} />
                        <Text style={styles.scheduleButtonText}>Schedule Meeting</Text>
                    </TouchableOpacity>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    {stats.map(renderStatCard)}
                </View>

                {/* Controls */}
                <View style={styles.controlsRow}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={18} color="#94A3B8" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search meetings by title, class..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                    <TouchableOpacity style={styles.filterButton}>
                        <Ionicons name="videocam-outline" size={20} color="#64748B" />
                        <Text style={styles.filterButtonText}>All Status</Text>
                        <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                </View>

                {/* Meetings List */}
                <View style={styles.listSection}>
                    {meetings.filter((m: any) => 
                        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (m.subject && m.subject.toLowerCase().includes(searchQuery.toLowerCase()))
                    ).map(renderMeetingCard)}
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
    banner: {
        backgroundColor: Colors.light.primary,
        padding: 24,
        margin: 16,
        borderRadius: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    bannerLeft: { flex: 1, marginRight: 16 },
    bannerTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#FFFFFF",
    },
    bannerSub: {
        fontSize: 13,
        color: "rgba(255, 255, 255, 0.8)",
        marginTop: 4,
    },
    scheduleButton: {
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: "center",
    },
    scheduleButtonText: {
        color: Colors.light.primary,
        fontWeight: "bold",
        marginLeft: 6,
        fontSize: 13,
    },
    statsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: 16,
        justifyContent: "space-between",
        marginBottom: 24,
    },
    statCard: {
        backgroundColor: "#FFFFFF",
        width: "48%",
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    statIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#F8FAFC",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    statLabel: {
        fontSize: 11,
        color: "#94A3B8",
        fontWeight: "600",
    },
    statValue: {
        fontSize: 18,
        fontWeight: "bold",
        marginTop: 2,
    },
    controlsRow: {
        flexDirection: "row",
        paddingHorizontal: 16,
        marginBottom: 20,
        justifyContent: "space-between",
    },
    searchBar: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        height: 50,
        borderRadius: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 14,
    },
    filterButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    filterButtonText: {
        fontSize: 14,
        color: "#1E293B",
        marginHorizontal: 8,
    },
    listSection: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    meetingCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    cardTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 16,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    meetingTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#1E293B",
        marginRight: 10,
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    statusText: {
        fontSize: 10,
        fontWeight: "bold",
    },
    bgRed: { backgroundColor: "#FEF2F2" },
    textRed: { color: "#EF4444" },
    dotRed: { backgroundColor: "#EF4444" },
    bgBlue: { backgroundColor: "#EFF6FF" },
    textBlue: { color: "#3B82F6" },
    dotBlue: { backgroundColor: "#3B82F6" },
    metaRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginBottom: 4,
    },
    metaItem: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 16,
        marginBottom: 4,
    },
    metaText: {
        fontSize: 12,
        color: "#64748B",
        marginLeft: 6,
    },
    joinButton: {
        backgroundColor: "#10B981",
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: "center",
    },
    joinButtonText: {
        color: "#FFFFFF",
        fontWeight: "bold",
        marginLeft: 6,
        fontSize: 14,
    },
    linkContainer: {
        backgroundColor: "#F8FAFC",
        borderRadius: 8,
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    linkText: {
        fontSize: 12,
        color: "#94A3B8",
        flex: 1,
        marginRight: 10,
    },
    copyButton: {
        padding: 4,
    },
});
