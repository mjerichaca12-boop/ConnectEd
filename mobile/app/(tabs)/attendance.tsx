import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Platform,
    StatusBar,
    Modal,
    TouchableWithoutFeedback,
    ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Colors from "../../src/constants/Colors";
import Layout from "../../src/constants/Layout";

// Custom Header Component to match the screenshot
const AttendanceHeader = ({ onBack }: { onBack: () => void }) => (
    <View style={styles.headerContainer}>
        <View style={styles.headerTop}>
            <View>
                <Text style={styles.headerTitle}>Attendance Record</Text>
                <Text style={styles.headerSubtitle}>
                    1st Quarter 2026 • Track your class attendance
                </Text>
            </View>
            <TouchableOpacity style={styles.profileIcon} onPress={onBack}>
                <Ionicons name="person-outline" size={24} color="#047857" />
            </TouchableOpacity>
        </View>
    </View>
);

const SummaryCard = ({
    title,
    value,
    subtitle,
    icon,
    iconBg,
    iconColor,
}: {
    title: string;
    value: string;
    subtitle?: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    iconColor: string;
}) => (
    <View style={styles.summaryCard}>
        <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
            <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardValue}>{value}</Text>
        {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
    </View>
);

import { supabase } from "../../src/lib/supabase";
import { getMyEnrollments } from "../../src/data/enrollments/get-my-enrollments";

export default function AttendanceScreen() {
    const router = useRouter();
    const [selectedStatus, setSelectedStatus] = useState("All Status");
    const [isFilterVisible, setIsFilterVisible] = useState(false);
    const [attendanceData, setAttendanceData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchAttendance();

        const channel = supabase
            .channel("attendance-realtime")
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "teacher_student_assignments" },
                () => { fetchAttendance(); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchAttendance = async () => {
        try {
            const enrollments = await getMyEnrollments();
            
            let allHistory: any[] = [];
            let totalStats = { present: 0, absent: 0, late: 0 };

            enrollments.forEach(en => {
                if (en.status !== "accepted") return;
                
                // Need to fetch actual attendance from enrollments view because getMyEnrollments might not have it or might not be updated
                // Actually, getMyEnrollments doesn't return attendance field right now. 
                // Let's fetch it explicitly.
            });

            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) return;

            const { data, error } = await supabase
                .from('enrollments')
                .select('subject_id, attendance, subjects(name, code)')
                .eq('student_id', userData.user.id)
                .eq('status', 'accepted');

            if (error) throw error;

            (data || []).forEach((row: any) => {
                const att = typeof row.attendance === 'string' ? JSON.parse(row.attendance) : (row.attendance || {});
                totalStats.present += (att.present || 0);
                totalStats.absent += (att.absent || 0);
                totalStats.late += (att.late || 0);

                const history = att.history || [];
                history.forEach((h: any) => {
                    allHistory.push({
                        date: h.date,
                        subject: row.subjects?.name || "Unknown",
                        code: row.subjects?.code || "UNK",
                        status: h.status,
                        time_in: h.time_in || "-",
                        remarks: "-"
                    });
                });
            });

            // Sort history by date descending
            allHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setAttendanceData(allHistory);
        } catch (error: any) {
            console.warn('Fetching attendance failed.', error.message);
            setAttendanceData([]);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredData = selectedStatus === "All Status" 
        ? attendanceData 
        : attendanceData.filter(item => item.status.toLowerCase() === selectedStatus.toLowerCase());

    const statusOptions = ["All Status", "Present", "Late", "Absent"];

    // Summary calculations
    const stats = {
        total: attendanceData.length,
        present: attendanceData.filter(d => d.status.toLowerCase() === 'present').length,
        absent: attendanceData.filter(d => d.status.toLowerCase() === 'absent').length,
        late: attendanceData.filter(d => d.status.toLowerCase() === 'late').length,
    };
    const presentRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

    const getStatusStyle = (status: string) => {
        const lowerStatus = status.toLowerCase();
        switch (lowerStatus) {
            case "present":
                return { bg: "#ECFDF5", color: "#10B981", icon: "checkmark-circle-outline" as const };
            case "late":
                return { bg: "#FFF7ED", color: "#F97316", icon: "time-outline" as const };
            case "absent":
                return { bg: "#FEF2F2", color: "#EF4444", icon: "close-circle-outline" as const };
            default:
                return { bg: "#F1F5F9", color: "#64748B", icon: "help-circle-outline" as const };
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#059669" />
            <AttendanceHeader onBack={() => router.back()} />

            <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.content}>
                {/* Summary Cards Grid */}
                <View style={styles.summaryGrid}>
                    <View style={styles.row}>
                        <SummaryCard
                            title="Total Classes"
                            value={stats.total.toString()}
                            icon="calendar-outline"
                            iconBg="#EFF6FF"
                            iconColor="#3B82F6"
                        />
                        <SummaryCard
                            title="Present"
                            value={stats.present.toString()}
                            subtitle={`${presentRate}% rate`}
                            icon="checkmark-circle-outline"
                            iconBg="#ECFDF5"
                            iconColor="#10B981"
                        />
                    </View>
                    <View style={styles.row}>
                        <SummaryCard
                            title="Absent"
                            value={stats.absent.toString()}
                            icon="close-circle-outline"
                            iconBg="#FEF2F2"
                            iconColor="#EF4444"
                        />
                        <SummaryCard
                            title="Late"
                            value={stats.late.toString()}
                            icon="alert-circle-outline"
                            iconBg="#FFF7ED"
                            iconColor="#F97316"
                        />
                    </View>
                </View>

                {/* Filters Row */}
                <View style={styles.filterRow}>
                    <TouchableOpacity 
                        style={styles.filterButton} 
                        onPress={() => setIsFilterVisible(true)}
                    >
                        <Ionicons name="filter-outline" size={20} color="#64748B" style={styles.filterIcon} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.filterLabel} numberOfLines={1}>{selectedStatus}</Text>
                        </View>
                        <Ionicons name="chevron-down" size={16} color="#64748B" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.filterButton}>
                        <Ionicons name="calendar-outline" size={20} color="#64748B" style={styles.filterIcon} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.filterLabel} numberOfLines={1}>January 2026</Text>
                        </View>
                    </TouchableOpacity>


                </View>

                {/* Attendance Table */}
                <View style={styles.tableCard}>
                    {/* Table Header */}
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>DATE</Text>
                        <Text style={[styles.tableHeaderText, { flex: 2 }]}>SUBJECT</Text>
                        <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>STATUS</Text>
                        <Text style={[styles.tableHeaderText, { flex: 1 }]}>TIME IN</Text>
                        <Text style={[styles.tableHeaderText, { flex: 0.8 }]}>REMARKS</Text>
                    </View>

                    {/* Table Body */}
                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={Colors.light.primary} />
                        </View>
                    ) : filteredData.length > 0 ? (
                        filteredData.map((item, index) => {
                            const statusStyle = getStatusStyle(item.status);
                            return (
                                <View key={index} style={styles.tableRow}>
                                    <View style={{ flex: 1.2 }}>
                                        <Text style={styles.dateText}>{item.date}</Text>
                                    </View>
                                    <View style={{ flex: 2 }}>
                                        <Text style={styles.subjectText}>{item.subject}</Text>
                                        <Text style={styles.codeText}>{item.code}</Text>
                                    </View>
                                    <View style={{ flex: 1.5 }}>
                                        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                            <Ionicons name={statusStyle.icon} size={14} color={statusStyle.color} />
                                            <Text style={[styles.statusText, { color: statusStyle.color }]}>{item.status}</Text>
                                        </View>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.timeText}>{item.time_in}</Text>
                                    </View>
                                    <View style={{ flex: 0.8 }}>
                                        <Text style={styles.remarksText}>{item.remarks}</Text>
                                    </View>
                                </View>
                            );
                        })
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No records found for this status.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Filter Modal */}
            <Modal
                transparent
                visible={isFilterVisible}
                animationType="fade"
                onRequestClose={() => setIsFilterVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setIsFilterVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Select Status</Text>
                                {statusOptions.map((option) => (
                                    <TouchableOpacity
                                        key={option}
                                        style={[
                                            styles.optionItem,
                                            selectedStatus === option && styles.activeOption
                                        ]}
                                        onPress={() => {
                                            setSelectedStatus(option);
                                            setIsFilterVisible(false);
                                        }}
                                    >
                                        <Text style={[
                                            styles.optionText,
                                            selectedStatus === option && styles.activeOptionText
                                        ]}>
                                            {option}
                                        </Text>
                                        {selectedStatus === option && (
                                            <Ionicons name="checkmark" size={20} color={Colors.light.primary} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F0F9F6", // Light green background
        paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
    },
    headerContainer: {
        backgroundColor: "#059669", // Dark emerald green
        paddingHorizontal: Layout.spacing.l,
        paddingBottom: Layout.spacing.xl,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    headerTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: Layout.spacing.m,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#FFFFFF",
    },
    headerSubtitle: {
        fontSize: 14,
        color: "#D1FAE5",
        marginTop: 4,
    },
    profileIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
    },
    scrollContainer: {
        flex: 1,
        marginTop: -10,
    },
    content: {
        paddingHorizontal: Layout.spacing.m,
        paddingBottom: 40,
    },
    summaryGrid: {
        marginTop: Layout.spacing.m,
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: Layout.spacing.m,
    },
    summaryCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        width: "48%",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 14,
        color: "#64748B",
        marginBottom: 8,
    },
    cardValue: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#1E293B",
    },
    cardSubtitle: {
        fontSize: 12,
        color: "#10B981",
        marginTop: 4,
    },
    filterRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: Layout.spacing.l,
    },
    filterButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        flex: 0.35,
        marginRight: 8,
    },
    filterIcon: {
        marginRight: 6,
    },
    filterLabel: {
        fontSize: 13,
        fontWeight: "600",
        color: "#1E293B",
        marginRight: 4,
    },
    exportButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#059669",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flex: 0.25,
        justifyContent: "center",
    },
    exportText: {
        color: "#FFFFFF",
        fontWeight: "bold",
        fontSize: 14,
        marginLeft: 6,
    },
    tableCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        paddingVertical: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    tableHeader: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    tableHeaderText: {
        fontSize: 12,
        fontWeight: "bold",
        color: "#94A3B8",
    },
    tableRow: {
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
        alignItems: "center",
    },
    dateText: {
        fontSize: 13,
        color: "#1E293B",
        fontWeight: "500",
    },
    subjectText: {
        fontSize: 14,
        color: "#1E293B",
        fontWeight: "600",
    },
    codeText: {
        fontSize: 12,
        color: "#059669",
        fontWeight: "bold",
        marginTop: 2,
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ECFDF5",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: "flex-start",
    },
    statusText: {
        fontSize: 12,
        color: "#059669",
        fontWeight: "600",
        marginLeft: 4,
    },
    timeText: {
        fontSize: 13,
        color: "#64748B",
    },
    remarksText: {
        fontSize: 13,
        color: "#64748B",
        textAlign: "center",
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalContent: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 20,
        width: "100%",
        maxWidth: 320,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 20,
        textAlign: "center",
    },
    optionItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    activeOption: {
        backgroundColor: "#F0F9FF",
    },
    optionText: {
        fontSize: 16,
        color: "#64748B",
    },
    activeOptionText: {
        color: Colors.light.primary,
        fontWeight: "bold",
    },
    emptyContainer: {
        padding: 40,
        alignItems: "center",
    },
    emptyText: {
        color: "#94A3B8",
        fontSize: 14,
    },
    loadingContainer: {
        padding: 40,
        alignItems: "center",
    }
});
