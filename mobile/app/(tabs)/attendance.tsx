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
import { supabase } from "../../src/lib/supabase";

// Sub-component: Summary Card
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

// Sub-component: Header
const AttendanceHeader = ({ onBack, subtitle }: { onBack: () => void, subtitle?: string }) => (
    <View style={styles.headerContainer}>
        <View style={styles.headerTop}>
            <View>
                <Text style={styles.headerTitle}>Attendance Record</Text>
                <Text style={styles.headerSubtitle}>
                    {subtitle || "Track your class attendance"}
                </Text>
            </View>
            <TouchableOpacity style={styles.profileIcon} onPress={onBack}>
                <Ionicons name="person-outline" size={24} color="#047857" />
            </TouchableOpacity>
        </View>
    </View>
);

export default function AttendanceScreen() {
    const router = useRouter();
    
    // States
    const [selectedStatus, setSelectedStatus] = useState("All Status");
    const [selectedMonth, setSelectedMonth] = useState(""); // Format: YYYY-MM
    const [isFilterVisible, setIsFilterVisible] = useState(false);
    const [isMonthModalVisible, setIsMonthModalVisible] = useState(false);
    const [attendanceData, setAttendanceData] = useState<any[]>([]);
    const [availableMonths, setAvailableMonths] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Helpers
    const formatMonthDisplay = (monthKey: string) => {
        if (!monthKey) return "Select Month";
        try {
            const [year, month] = monthKey.split("-");
            const date = new Date(parseInt(year), parseInt(month) - 1);
            return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } catch (e) {
            return monthKey;
        }
    };

    const getStatusStyle = (status: string) => {
        const lowerStatus = (status || "").toLowerCase();
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

    // Initial Load
    useEffect(() => {
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        setSelectedMonth(currentMonthKey);
        
        fetchAttendance();

        const channel = supabase
            .channel("attendance-realtime")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "teacher_student_attendance" },
                () => { fetchAttendance(); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchAttendance = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Fetch records
            const { data: attData, error: attError } = await supabase
                .from('teacher_student_attendance')
                .select(`
                    id,
                    attendance_date,
                    attendance_status,
                    remarks,
                    subject_id,
                    subjects ( name, code )
                `)
                .eq('student_id', user.id)
                .order('attendance_date', { ascending: false });

            if (attError) throw attError;

            // 2. Fetch metadata
            const subjectIds = [...new Set((attData || []).map(r => r.subject_id))];
            const dates = [...new Set((attData || []).map(r => r.attendance_date))];

            let metadataMap: any = {};
            if (subjectIds.length > 0 && dates.length > 0) {
                const { data: metaData } = await supabase
                    .from("attendance_metadata")
                    .select("subject_id, attendance_date, task, summary")
                    .in("subject_id", subjectIds)
                    .in("attendance_date", dates);

                (metaData || []).forEach(m => {
                    metadataMap[`${m.subject_id}_${m.attendance_date}`] = {
                        task: m.task,
                        summary: m.summary
                    };
                });
            }

            if (attData) {
                const monthsFound = new Set<string>();
                const formatted = attData.map((row: any) => {
                    const meta = metadataMap[`${row.subject_id}_${row.attendance_date}`] || {};
                    const d = new Date(row.attendance_date);
                    const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    monthsFound.add(mKey);

                    let displayDate = row.attendance_date;
                    try {
                        displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    } catch (e) {}

                    return {
                        id: row.id,
                        date: displayDate,
                        rawDate: row.attendance_date,
                        subject: row.subjects?.name || "Unknown",
                        code: row.subjects?.code || "SUBJ",
                        status: row.attendance_status,
                        remarks: row.remarks || "-",
                        task: meta.task || "",
                        summary: meta.summary || ""
                    };
                });

                setAttendanceData(formatted);
                
                // Add current month to available months if not present
                const now = new Date();
                const curM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                monthsFound.add(curM);
                
                setAvailableMonths(Array.from(monthsFound).sort().reverse());
            }
        } catch (error: any) {
            console.warn('Fetch failed:', error.message);
            setAttendanceData([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Derived Data
    const filteredData = attendanceData.filter(item => {
        const statusMatch = selectedStatus === "All Status" || item.status.toLowerCase() === selectedStatus.toLowerCase();
        const monthMatch = !selectedMonth || item.rawDate.startsWith(selectedMonth);
        return statusMatch && monthMatch;
    });

    const stats = {
        total: filteredData.length,
        present: filteredData.filter(d => d.status.toLowerCase() === 'present').length,
        absent: filteredData.filter(d => d.status.toLowerCase() === 'absent').length,
        late: filteredData.filter(d => d.status.toLowerCase() === 'late').length,
    };
    const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#059669" />
            <AttendanceHeader 
                onBack={() => router.back()} 
                subtitle={formatMonthDisplay(selectedMonth)}
            />

            <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.content}>
                {/* Summary Cards */}
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
                            subtitle={`${rate}% rate`}
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

                {/* Filters */}
                <View style={styles.filterRow}>
                    <TouchableOpacity 
                        style={styles.filterButton} 
                        onPress={() => setIsFilterVisible(true)}
                    >
                        <Ionicons name="filter-outline" size={18} color="#64748B" style={{ marginRight: 6 }} />
                        <Text style={styles.filterLabel} numberOfLines={1}>{selectedStatus}</Text>
                        <Ionicons name="chevron-down" size={14} color="#64748B" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.filterButton}
                        onPress={() => setIsMonthModalVisible(true)}
                    >
                        <Ionicons name="calendar-outline" size={18} color="#64748B" style={{ marginRight: 6 }} />
                        <Text style={styles.filterLabel} numberOfLines={1}>{formatMonthDisplay(selectedMonth)}</Text>
                        <Ionicons name="chevron-down" size={14} color="#64748B" />
                    </TouchableOpacity>
                </View>

                {/* Table */}
                <View style={styles.tableCard}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>DATE</Text>
                        <Text style={[styles.tableHeaderText, { flex: 2 }]}>SUBJECT</Text>
                        <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>STATUS</Text>
                        <Text style={[styles.tableHeaderText, { flex: 1 }]}>REMARKS</Text>
                    </View>

                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#059669" />
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
                                        {(item.task || item.summary) && (
                                            <View style={styles.metaBadge}>
                                                <Text style={styles.metaText} numberOfLines={1}>
                                                    {item.task || item.summary}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={{ flex: 1.5 }}>
                                        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                            <Ionicons name={statusStyle.icon} size={12} color={statusStyle.color} />
                                            <Text style={[styles.statusText, { color: statusStyle.color }]}>{item.status}</Text>
                                        </View>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.remarksText}>{item.remarks}</Text>
                                    </View>
                                </View>
                            );
                        })
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="document-text-outline" size={40} color="#CBD5E1" style={{ marginBottom: 8 }} />
                            <Text style={styles.emptyText}>No records for {formatMonthDisplay(selectedMonth)}</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Status Modal */}
            <Modal transparent visible={isFilterVisible} animationType="fade">
                <TouchableWithoutFeedback onPress={() => setIsFilterVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Select Status</Text>
                            {["All Status", "Present", "Late", "Absent"].map((opt) => (
                                <TouchableOpacity
                                    key={opt}
                                    style={[styles.optionItem, selectedStatus === opt && styles.activeOption]}
                                    onPress={() => { setSelectedStatus(opt); setIsFilterVisible(false); }}
                                >
                                    <Text style={[styles.optionText, selectedStatus === opt && styles.activeOptionText]}>{opt}</Text>
                                    {selectedStatus === opt && <Ionicons name="checkmark" size={20} color="#059669" />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Month Modal */}
            <Modal transparent visible={isMonthModalVisible} animationType="fade">
                <TouchableWithoutFeedback onPress={() => setIsMonthModalVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Select Month</Text>
                            <ScrollView style={{ maxHeight: 300 }}>
                                {availableMonths.map((m) => (
                                    <TouchableOpacity
                                        key={m}
                                        style={[styles.optionItem, selectedMonth === m && styles.activeOption]}
                                        onPress={() => { setSelectedMonth(m); setIsMonthModalVisible(false); }}
                                    >
                                        <Text style={[styles.optionText, selectedMonth === m && styles.activeOptionText]}>{formatMonthDisplay(m)}</Text>
                                        {selectedMonth === m && <Ionicons name="checkmark" size={20} color="#059669" />}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F0F9F6" },
    headerContainer: { backgroundColor: "#059669", paddingHorizontal: 20, paddingBottom: 30 },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20 },
    headerTitle: { fontSize: 24, fontWeight: "bold", color: "#FFFFFF" },
    headerSubtitle: { fontSize: 13, color: "#D1FAE5", marginTop: 4 },
    profileIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" },
    scrollContainer: { flex: 1, marginTop: -15 },
    content: { paddingHorizontal: 16, paddingBottom: 40 },
    summaryGrid: { marginTop: 15 },
    row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 15 },
    summaryCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, width: "48%", elevation: 2 },
    iconContainer: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 10 },
    cardTitle: { fontSize: 12, color: "#64748B", marginBottom: 4 },
    cardValue: { fontSize: 24, fontWeight: "bold", color: "#1E293B" },
    cardSubtitle: { fontSize: 11, color: "#10B981", marginTop: 2 },
    filterRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20, gap: 10 },
    filterButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#E2E8F0", flex: 1 },
    filterLabel: { fontSize: 13, fontWeight: "600", color: "#1E293B", flex: 1 },
    tableCard: { backgroundColor: "#FFFFFF", borderRadius: 16, paddingVertical: 10, elevation: 2 },
    tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#F1F5F9", paddingHorizontal: 16, paddingBottom: 10 },
    tableHeaderText: { fontSize: 11, fontWeight: "bold", color: "#94A3B8" },
    tableRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    dateText: { fontSize: 12, color: "#1E293B", fontWeight: "500" },
    subjectText: { fontSize: 13, color: "#1E293B", fontWeight: "600" },
    codeText: { fontSize: 11, color: "#059669", fontWeight: "bold" },
    statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
    statusText: { fontSize: 11, fontWeight: "600", marginLeft: 3 },
    remarksText: { fontSize: 12, color: "#64748B" },
    metaBadge: { marginTop: 4, backgroundColor: "#F0FDF4", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start" },
    metaText: { fontSize: 9, color: "#059669", fontStyle: "italic" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
    modalContent: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, width: "100%", maxWidth: 300 },
    modalTitle: { fontSize: 18, fontWeight: "bold", color: "#1E293B", marginBottom: 15, textAlign: "center" },
    optionItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 15, borderRadius: 10, marginBottom: 5 },
    activeOption: { backgroundColor: "#F0FDF4" },
    optionText: { fontSize: 15, color: "#64748B" },
    activeOptionText: { color: "#059669", fontWeight: "bold" },
    emptyContainer: { padding: 40, alignItems: "center" },
    emptyText: { color: "#94A3B8", fontSize: 13, textAlign: "center" },
    loadingContainer: { padding: 40, alignItems: "center" }
});
