import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '../../constants/Colors';

interface TaskSummaryProps {
    counts: {
        upcoming: number;
        submitted: number;
        late: number;
    };
    onPress?: () => void;
}

export const TaskSummarySection = ({ counts }: TaskSummaryProps) => {
    const router = useRouter();

    const handlePress = () => {
        router.push("/(tabs)/assignment" as any);
    };

    return (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Your Tasks</Text>
                <TouchableOpacity onPress={handlePress}>
                    <Text style={styles.link}>View All</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.taskSummaryContainer}>
                <TouchableOpacity 
                    style={[styles.taskSummaryCard, { backgroundColor: '#F0F9FF' }]}
                    onPress={handlePress}
                >
                    <Text style={[styles.taskCount, { color: '#0369A1' }]}>{counts.upcoming}</Text>
                    <Text style={styles.taskLabel}>Upcoming</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={[styles.taskSummaryCard, { backgroundColor: '#F0FDF4' }]}
                    onPress={handlePress}
                >
                    <Text style={[styles.taskCount, { color: '#15803D' }]}>{counts.submitted}</Text>
                    <Text style={styles.taskLabel}>Submitted</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.taskSummaryCard, { backgroundColor: '#FEF2F2' }]}
                    onPress={handlePress}
                >
                    <Text style={[styles.taskCount, { color: '#B91C1C' }]}>{counts.late}</Text>
                    <Text style={styles.taskLabel}>Late</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
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
    taskSummaryContainer: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 8,
    },
    taskSummaryCard: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.05)",
    },
    taskCount: {
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 2,
    },
    taskLabel: {
        fontSize: 12,
        color: "#64748B",
        fontWeight: "600",
    },
});
