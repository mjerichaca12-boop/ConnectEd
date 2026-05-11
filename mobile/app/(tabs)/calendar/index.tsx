import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../../src/components/common/AppHeader";
import Colors from "../../../src/constants/Colors";
import { supabase } from "../../../src/lib/supabase";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const EVENTS = [
    { id: "1", date: "2026-05-01", title: "Labor Day", type: "Holiday", color: "#EF4444" },
    { id: "2", date: "2026-05-15", title: "Mid-term Exams", type: "Academic", color: "#3B82F6" },
    { id: "3", date: "2026-05-20", title: "Faculty Meeting", type: "Meeting", color: "#10B981" },
    { id: "4", date: "2026-05-25", title: "Foundation Day", type: "Event", color: "#F59E0B" },
];

import { useCalendarEventsQuery } from "../../../src/hooks/query/calendar/use-calendar-events-query";
import { useEventsQuery } from "../../../src/hooks/query/events/use-events-query";

export default function SchoolCalendarScreen() {
    const { data: calendarEvents = [], isLoading: isCalendarLoading } = useCalendarEventsQuery();
    const { data: schoolEvents = [], isLoading: isSchoolEventsLoading } = useEventsQuery();
    const [currentDate, setCurrentDate] = useState(new Date()); // current month

    const isLoading = isCalendarLoading || isSchoolEventsLoading;
    const allEvents = [...calendarEvents]; // merge or keep separate? User said "below upcoming events"

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const cells = [];
        // Empty cells for first week
        for (let i = 0; i < firstDay; i++) {
            cells.push(<View key={`empty-${i}`} style={styles.cell} />);
        }

        const now = new Date();
        const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

        // Days of month
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const hasEvent = calendarEvents.some(e => e.date === dateStr);
            const isToday = isCurrentMonth && i === now.getDate();

            cells.push(
                <TouchableOpacity key={i} style={styles.cell}>
                    <View style={[styles.dateCircle, isToday && styles.todayCircle]}>
                        <Text style={[styles.dateText, isToday && styles.todayText]}>{i}</Text>
                    </View>
                    {hasEvent && <View style={styles.eventDot} />}
                </TouchableOpacity>
            );
        }

        return cells;
    };

    const nextMonth = () => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)));
    const prevMonth = () => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)));

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.light.forestGreen} />
            <AppHeader title="School Calendar" hasNotifications={true} />
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Full-width Banner */}
                <View style={styles.banner}>
                    <Text style={styles.bannerTitle}>Academic Year 2025-2026</Text>
                    <Text style={styles.bannerSub}>Stay updated with important school events and holidays</Text>
                </View>

                {/* Calendar Interface */}
                <View style={styles.calendarCard}>
                    <View style={styles.calendarHeader}>
                        <TouchableOpacity onPress={prevMonth}>
                            <Ionicons name="chevron-back" size={24} color={Colors.light.primary} />
                        </TouchableOpacity>
                        <Text style={styles.monthTitle}>{MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}</Text>
                        <TouchableOpacity onPress={nextMonth}>
                            <Ionicons name="chevron-forward" size={24} color={Colors.light.primary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.daysRow}>
                        {DAYS.map(day => (
                            <Text key={day} style={styles.dayLabel}>{day}</Text>
                        ))}
                    </View>

                    <View style={styles.grid}>
                        {renderCalendar()}
                    </View>
                </View>

                {/* Upcoming Events */}
                <Text style={styles.sectionTitle}>Upcoming Events</Text>
                
                {isLoading ? (
                    <ActivityIndicator size="small" color={Colors.light.primary} style={{ marginTop: 20 }} />
                ) : calendarEvents.length === 0 && schoolEvents.length === 0 ? (
                    <Text style={styles.emptyText}>No upcoming events scheduled.</Text>
                ) : (
                    <>
                        {calendarEvents.map(event => (
                            <View key={event.id} style={styles.eventCard}>
                                <View style={[styles.eventTag, { backgroundColor: event.color || Colors.light.primary }]} />
                                <View style={styles.eventInfo}>
                                    <Text style={styles.eventTitle}>{event.title}</Text>
                                    <View style={styles.eventMeta}>
                                        <Ionicons name="calendar-outline" size={14} color="#64748B" />
                                        <Text style={styles.eventDate}>{event.date}</Text>
                                        <View style={styles.dot} />
                                        <Text style={styles.eventType}>{event.type || 'Event'}</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                        
                        {schoolEvents.length > 0 && (
                            <>
                                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>School Events</Text>
                                {schoolEvents.map(event => (
                                    <View key={event.id} style={styles.eventCard}>
                                        <View style={[styles.eventTag, { backgroundColor: event.color || Colors.light.primary }]} />
                                        <View style={styles.eventInfo}>
                                            <Text style={styles.eventTitle}>{event.title}</Text>
                                            <View style={styles.eventMeta}>
                                                <Ionicons name="calendar-outline" size={14} color="#64748B" />
                                                <Text style={styles.eventDate}>{event.date}</Text>
                                                <View style={styles.dot} />
                                                <Text style={styles.eventType}>{event.type || 'Event'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </>
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    scrollContent: {
        paddingBottom: 40,
    },
    banner: {
        backgroundColor: Colors.light.primary,
        paddingVertical: 28,
        paddingHorizontal: 24,
        marginHorizontal: 0,
        marginTop: 0,
        marginBottom: 16,
    },
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
    calendarCard: {
        backgroundColor: "#FFFFFF",
        marginHorizontal: 16,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: "#F1F5F9",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        marginBottom: 24,
    },
    calendarHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
    },
    monthTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1E293B",
    },
    daysRow: {
        flexDirection: "row",
        marginBottom: 16,
    },
    dayLabel: {
        flex: 1,
        textAlign: "center",
        fontSize: 12,
        fontWeight: "bold",
        color: "#94A3B8",
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
    },
    cell: {
        width: "14.28%",
        height: 48,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 4,
    },
    dateCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
    },
    todayCircle: {
        backgroundColor: Colors.light.primary,
    },
    dateText: {
        fontSize: 15,
        color: "#1E293B",
        fontWeight: "500",
    },
    todayText: {
        color: "#FFFFFF",
        fontWeight: "bold",
    },
    eventDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.light.primary,
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1E293B",
        marginHorizontal: 16,
        marginBottom: 16,
    },
    eventCard: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    eventTag: {
        width: 4,
        height: 40,
        borderRadius: 2,
        marginRight: 16,
    },
    eventInfo: {
        flex: 1,
    },
    eventTitle: {
        fontSize: 15,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 4,
    },
    eventMeta: {
        flexDirection: "row",
        alignItems: "center",
    },
    eventDate: {
        fontSize: 12,
        color: "#64748B",
        marginLeft: 6,
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: "#CBD5E1",
        marginHorizontal: 8,
    },
    eventType: {
        fontSize: 12,
        color: "#10B981",
        fontWeight: "600",
    },
    reminderBtn: {
        padding: 8,
    },
    emptyText: {
        textAlign: "center",
        color: "#64748B",
        fontSize: 14,
        marginTop: 20,
    }
});
