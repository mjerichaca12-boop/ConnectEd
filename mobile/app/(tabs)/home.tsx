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
import { useMaterialsQuery } from "../../src/hooks/query/materials/use-materials-query";
import { AssessmentTypeBadge } from "../../src/components/common/AssessmentTypeBadge";

export default function HomeScreen() {
    const router = useRouter();
    const [displayName, setDisplayName] = useState("Student");
    const { data: announcementsData, isLoading: isAnnouncementsLoading, refetch: refetchAnnouncements } = useAnnouncementsQuery({ limit: 3 });
    const { data: eventsData, isLoading: isEventsLoading } = useEventsQuery(3);
    const { data: enrollments, isLoading: isEnrollmentsLoading } = useMyEnrollmentsQuery();
    
    const { data: assignments = [], isLoading: isAssignmentsLoading } = useMyAssignmentsQuery();
    const { data: materialsData = [], isLoading: isMaterialsLoading } = useMaterialsQuery({ allowFallback: true });
    
    const announcements = announcementsData || [];
    const events = eventsData || [];

    // Filter enrolled subjects where status is accepted
    const enrolledSubjects = (enrollments || [])
        .filter(e => e.status === 'accepted' && e.subjects)
        .map(e => ({
            id: e.subject_id,
            code: e.subjects.code,
            name: e.subjects.name,
            teacher: e.subjects.profiles
                ? `${e.subjects.profiles.first_name || ""} ${e.subjects.profiles.last_name || ""}`.trim()
                : "Faculty",
            schedule: e.subjects.schedule || "TBA",
        }));

    const enrolledSubjectIds = enrolledSubjects.map(s => s.id);

    // Filter upcoming deadlines (assessment_type === 'assignment')
    const upcomingDeadlines = assignments
        .filter(a => a.status === 'pending' && a.assessment_type === 'assignment')
        .slice(0, 3);

    // Filter pending activities & quizzes (assessment_type === 'activity' || assessment_type === 'quiz')
    const pendingActivities = assignments
        .filter(a => a.status === 'pending' && (a.assessment_type === 'activity' || a.assessment_type === 'quiz'))
        .slice(0, 3);

    // Filter recently published lessons for the enrolled subjects
    const recentlyPublishedLessons = materialsData
        .filter(m => enrolledSubjectIds.includes(m.subject_id))
        .slice(0, 3);

    const getSubjectDetails = (subjectId: string) => {
        return enrolledSubjects.find(s => s.id === subjectId);
    };

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

                {/* Enrolled Subjects Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Enrolled Subjects</Text>
                        <TouchableOpacity onPress={() => router.push("/(tabs)/subjects" as any)}>
                            <Text style={styles.link}>See All</Text>
                        </TouchableOpacity>
                    </View>
                    {isEnrollmentsLoading ? (
                        <ActivityIndicator size="small" color={Colors.light.primary} />
                    ) : enrolledSubjects.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyText}>You are not enrolled in any subjects yet.</Text>
                        </View>
                    ) : (
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false} 
                            contentContainerStyle={styles.subjectsHorizontalScroll}
                        >
                            {enrolledSubjects.map((subject) => (
                                <TouchableOpacity 
                                    key={subject.id} 
                                    style={styles.subjectCardMini}
                                    onPress={() => router.push(`/subjects/${subject.id}` as any)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.subjectBadge}>
                                        <Text style={styles.subjectBadgeText}>{subject.code}</Text>
                                    </View>
                                    <Text style={styles.subjectNameMini} numberOfLines={2}>{subject.name}</Text>
                                    <View style={styles.subjectTeacherRow}>
                                        <Ionicons name="person-outline" size={12} color="#64748B" style={{ marginRight: 4 }} />
                                        <Text style={styles.subjectTeacherMini} numberOfLines={1}>{subject.teacher}</Text>
                                    </View>
                                    <View style={styles.subjectScheduleRow}>
                                        <Ionicons name="time-outline" size={12} color="#64748B" style={{ marginRight: 4 }} />
                                        <Text style={styles.subjectScheduleMini} numberOfLines={1}>{subject.schedule}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </View>

                {/* Upcoming Deadlines Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Upcoming Deadlines</Text>
                        <TouchableOpacity onPress={() => router.push("/(tabs)/assignment" as any)}>
                            <Text style={styles.link}>View Tasks</Text>
                        </TouchableOpacity>
                    </View>
                    {isAssignmentsLoading ? (
                        <ActivityIndicator size="small" color={Colors.light.primary} />
                    ) : upcomingDeadlines.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Ionicons name="checkmark-circle-outline" size={24} color="#10B981" style={{ marginBottom: 4 }} />
                            <Text style={styles.emptyText}>No upcoming assignment deadlines!</Text>
                        </View>
                    ) : (
                        upcomingDeadlines.map((item) => (
                            <TouchableOpacity 
                                key={item.id} 
                                style={styles.deadlineCard}
                                onPress={() => router.push("/(tabs)/assignment" as any)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.deadlineInfo}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <Text style={styles.deadlineSubject}>{item.subject}</Text>
                                        <AssessmentTypeBadge type={item.assessment_type || 'assignment'} size="small" />
                                    </View>
                                    <Text style={styles.deadlineTitle} numberOfLines={1}>{item.title}</Text>
                                </View>
                                <View style={styles.deadlineDateContainer}>
                                    <Ionicons name="calendar-outline" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                                    <Text style={styles.deadlineDate}>{item.dueDate}</Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                {/* Pending Activities Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Pending Activities & Quizzes</Text>
                        <TouchableOpacity onPress={() => router.push("/(tabs)/assignment" as any)}>
                            <Text style={styles.link}>View Tasks</Text>
                        </TouchableOpacity>
                    </View>
                    {isAssignmentsLoading ? (
                        <ActivityIndicator size="small" color={Colors.light.primary} />
                    ) : pendingActivities.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Ionicons name="sparkles-outline" size={24} color="#F59E0B" style={{ marginBottom: 4 }} />
                            <Text style={styles.emptyText}>No pending activities or quizzes.</Text>
                        </View>
                    ) : (
                        pendingActivities.map((item) => (
                            <TouchableOpacity 
                                key={item.id} 
                                style={styles.activityCard}
                                onPress={() => router.push("/(tabs)/assignment" as any)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.activityInfo}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <Text style={styles.activitySubject}>{item.subject}</Text>
                                        <AssessmentTypeBadge type={item.assessment_type} size="small" />
                                    </View>
                                    <Text style={styles.activityTitle} numberOfLines={1}>{item.title}</Text>
                                </View>
                                <View style={styles.activityDueDateContainer}>
                                    <Text style={styles.activityDueDate}>Due: {item.dueDate}</Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                {/* Recently Published Lessons Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recently Published Lessons</Text>
                    </View>
                    {isMaterialsLoading ? (
                        <ActivityIndicator size="small" color={Colors.light.primary} />
                    ) : recentlyPublishedLessons.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Ionicons name="document-text-outline" size={24} color="#64748B" style={{ marginBottom: 4 }} />
                            <Text style={styles.emptyText}>No lessons published recently.</Text>
                        </View>
                    ) : (
                        recentlyPublishedLessons.map((material) => {
                            const sub = getSubjectDetails(material.subject_id);
                            const fileType = material.type?.toUpperCase() || "FILE";
                            return (
                                <TouchableOpacity 
                                    key={material.id} 
                                    style={styles.lessonCard}
                                    onPress={() => router.push(`/subjects/${material.subject_id}/materials` as any)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.lessonIconContainer}>
                                        <Ionicons 
                                            name={fileType === 'PDF' ? 'document-text' : 'document-text-outline'} 
                                            size={22} 
                                            color={Colors.light.primary} 
                                        />
                                    </View>
                                    <View style={styles.lessonInfo}>
                                        <Text style={styles.lessonSubject}>{sub ? sub.code : "Subject"}</Text>
                                        <Text style={styles.lessonTitle} numberOfLines={1}>{material.title}</Text>
                                        <Text style={styles.lessonDate}>Posted: {material.date}</Text>
                                    </View>
                                    <View style={styles.lessonFileTypeBadge}>
                                        <Text style={styles.lessonFileTypeText}>{fileType}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>

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
    subjectsHorizontalScroll: {
        paddingVertical: 4,
    },
    subjectCardMini: {
        width: 170,
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 12,
        marginRight: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    subjectBadge: {
        alignSelf: 'flex-start',
        backgroundColor: "#E0F2FE",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginBottom: 8,
    },
    subjectBadgeText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#0369A1',
    },
    subjectNameMini: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 8,
        height: 38,
    },
    subjectTeacherRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    subjectTeacherMini: {
        fontSize: 12,
        color: '#64748B',
        flex: 1,
    },
    subjectScheduleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    subjectScheduleMini: {
        fontSize: 11,
        color: '#64748B',
        flex: 1,
    },
    deadlineCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
        elevation: 1,
    },
    deadlineInfo: {
        flex: 1,
        marginRight: 8,
    },
    deadlineSubject: {
        fontSize: 11,
        fontWeight: 'bold',
        color: Colors.light.primary,
        marginBottom: 2,
    },
    deadlineTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
    },
    deadlineDateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    deadlineDate: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#EF4444',
    },
    activityCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
        elevation: 1,
    },
    activityInfo: {
        flex: 1,
        marginRight: 8,
    },
    activitySubject: {
        fontSize: 11,
        fontWeight: 'bold',
        color: Colors.light.primary,
        marginRight: 6,
    },
    typeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    typeBadgeText: {
        fontSize: 9,
        fontWeight: 'bold',
    },
    activityTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
    },
    activityDueDateContainer: {
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    activityDueDate: {
        fontSize: 11,
        fontWeight: '500',
        color: '#64748B',
    },
    lessonCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
        elevation: 1,
    },
    lessonIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#F0FDF4',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    lessonInfo: {
        flex: 1,
        marginRight: 8,
    },
    lessonSubject: {
        fontSize: 11,
        fontWeight: 'bold',
        color: Colors.light.primary,
        marginBottom: 2,
    },
    lessonTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 2,
    },
    lessonDate: {
        fontSize: 11,
        color: '#94A3B8',
    },
    lessonFileTypeBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    lessonFileTypeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#64748B',
    },
});
