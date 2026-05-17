import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, StatusBar } from "react-native";
import { WebView } from "react-native-webview";
import Colors from "../../src/constants/Colors";
import Layout from "../../src/constants/Layout";
import MeetingCard from "../../src/components/cards/MeetingCard";
import AppHeader from "../../src/components/common/AppHeader";

const ActiveMeetingView = ({ meeting, onLeave }: any) => {
    // Generate a clean room name to avoid invalid URLs
    const roomName = `ConnectEd-${meeting.subject}-${meeting.title}`.replace(/[^a-zA-Z0-9-]/g, "");
    
    return (
        <View style={styles.meetingContainer}>
            <AppHeader title={meeting.title} showBack={true} onBack={onLeave} hasNotifications={true} />
            <WebView 
                source={{ uri: `https://meet.jit.si/${roomName}` }} 
                style={styles.webview} 
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
            />
        </View>
    );
};

import { useMeetingsQuery } from "../../src/hooks/query/meetings/use-meetings-query";

export default function MeetingsScreen() {
    const [activeMeeting, setActiveMeeting] = useState<any>(null);
    const { data: meetings = [], isLoading } = useMeetingsQuery();

    if (activeMeeting) {
        return <ActiveMeetingView meeting={activeMeeting} onLeave={() => setActiveMeeting(null)} />;
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.light.forestGreen} />
            <AppHeader title="Meet" hasNotifications={true} />
            
            <View style={styles.banner}>
                <View style={styles.bannerLeft}>
                    <Text style={styles.bannerTitle}>Virtual Class</Text>
                    <Text style={styles.bannerSub}>Join your scheduled video classes</Text>
                </View>
                <View style={styles.statsBadge}>
                    <Text style={styles.statsNumber}>{meetings.length}</Text>
                    <Text style={styles.statsLabel}>Today</Text>
                </View>
            </View>

            <FlatList
                data={meetings}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <MeetingCard
                        subject={item.subject}
                        title={item.title}
                        time={item.time}
                        status={item.status}
                        onJoin={() => setActiveMeeting(item)}
                    />
                )}
                ListHeaderComponent={() => (
                    <Text style={styles.header}>Scheduled Meetings</Text>
                )}
                showsVerticalScrollIndicator={false}
            />
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
        margin: 16,
        borderRadius: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    bannerLeft: { flex: 1 },
    bannerTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#FFFFFF",
    },
    bannerSub: {
        fontSize: 14,
        color: "rgba(255, 255, 255, 0.8)",
        marginTop: 4,
    },
    statsBadge: {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: "center",
    },
    statsNumber: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#FFFFFF",
    },
    statsLabel: {
        fontSize: 10,
        color: "#FFFFFF",
        fontWeight: "600",
        textTransform: "uppercase",
    },
    meetingContainer: {
        flex: 1,
        backgroundColor: "#000",
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    header: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 16,
    },
    webview: {
        flex: 1,
    }
});
