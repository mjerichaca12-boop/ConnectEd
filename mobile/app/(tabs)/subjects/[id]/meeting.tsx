import React from "react";
import { View, StyleSheet, FlatList } from "react-native";
import Colors from "../../../../src/constants/Colors";
import MeetingCard from "../../../../src/components/cards/MeetingCard";

import { useLocalSearchParams, useGlobalSearchParams, useSegments } from "expo-router";
import { useMeetingsQuery } from "../../../../src/hooks/query/meetings/use-meetings-query";
import { ActivityIndicator } from "react-native";

export default function SubjectMeetings() {
    const segments = useSegments();
    const { id: globalId } = useGlobalSearchParams();
    const { id: localId } = useLocalSearchParams();
    
    // Robust ID extraction from params or route segments
    const subjectId = (() => {
        if (globalId && globalId !== '[id]' && typeof globalId === 'string') return globalId;
        if (localId && localId !== '[id]' && typeof localId === 'string') return localId;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const found = segments.find(s => uuidRegex.test(s));
        if (found) return found;
        if (segments[2] && segments[2] !== '[id]') return segments[2];
        return localId as string;
    })();

    const { data: meetings = [], isLoading } = useMeetingsQuery({ subjectId });

    if (isLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={meetings}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.content}
                renderItem={({ item }) => (
                    <MeetingCard
                        subject={item.subject}
                        title={item.title}
                        time={item.time}
                        duration={item.duration}
                        onJoin={() => { }}
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
    content: {
        padding: 16,
    },
});
