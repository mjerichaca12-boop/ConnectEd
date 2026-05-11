import React from "react";
import { View, StyleSheet, FlatList } from "react-native";
import Colors from "../../../../src/constants/Colors";
import MeetingCard from "../../../../src/components/cards/MeetingCard";

import { useLocalSearchParams } from "expo-router";
import { useMeetingsQuery } from "../../../../src/hooks/query/meetings/use-meetings-query";
import { ActivityIndicator } from "react-native";

export default function SubjectMeetings() {
    const { id } = useLocalSearchParams();
    const { data: meetings = [], isLoading } = useMeetingsQuery({ subjectId: id as string });

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
