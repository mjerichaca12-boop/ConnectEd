import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, FlatList, Modal, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../../src/components/common/AppHeader";
import Colors from "../../../src/constants/Colors";
import { supabase } from "../../../src/lib/supabase";
import { useTeacherSubjectsQuery } from "../../../src/hooks/query/subjects/use-teacher-subjects-query";
import { useClassStudentsQuery } from "../../../src/hooks/query/enrollments/use-class-students-query";
import { useUpdateAttendanceMutation } from "../../../src/hooks/query/enrollments/use-update-attendance-mutation";

type AttendanceStatus = "present" | "absent" | "late";

interface StatusOverride {
    status: AttendanceStatus;
    previous: AttendanceStatus;
}

export default function AttendanceScreen() {
    const { data: subjects = [], isLoading: isLoadingSubjects } = useTeacherSubjectsQuery();

    // Track selected subject by index to avoid referencing the subjects array itself in deps
    const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Store student status overrides keyed by student id
    // { [studentId]: { status, previous } }
    const [overrides, setOverrides] = useState<Record<string, StatusOverride>>({});

    // Auto-select first subject only once using a ref guard
    const hasAutoSelected = useRef(false);
    useEffect(() => {
        if (!hasAutoSelected.current && subjects.length > 0) {
            hasAutoSelected.current = true;
            setSelectedSubjectId(subjects[0].id);
        }
    }, [subjects]);

    // Reset overrides when subject changes
    const prevSubjectRef = useRef<string | null>(null);
    if (prevSubjectRef.current !== selectedSubjectId) {
        prevSubjectRef.current = selectedSubjectId;
        // This runs during render (safe) before commit — clears overrides synchronously
        if (Object.keys(overrides).length > 0) {
            // Can't call setState during render, skip — handled by separate effect below
        }
    }

    // Clear overrides on subject switch (only when subjectId changes)
    const lastSubjectIdRef = useRef<string | null>(null);
    useEffect(() => {
        if (lastSubjectIdRef.current !== selectedSubjectId) {
            lastSubjectIdRef.current = selectedSubjectId;
            setOverrides({});
            setIsSubmitted(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSubjectId]);

    const { data: rawStudents = [], isLoading: isLoadingStudents } = useClassStudentsQuery({
        subjectId: selectedSubjectId || ''
    });

    const updateAttendanceMutation = useUpdateAttendanceMutation(selectedSubjectId || '');

    const selectedSubject = useMemo(
        () => subjects.find(s => s.id === selectedSubjectId),
        [subjects, selectedSubjectId]
    );

    // Derive attendance list without setState — avoids the infinite loop entirely
    const attendanceList = useMemo(() => {
        return rawStudents
            .filter(s => s.status === 'Active')
            .map(s => {
                const override = overrides[s.id];
                return {
                    id: s.id,
                    enrollmentId: s.enrollmentId,
                    name: s.name,
                    email: s.email,
                    status: (override?.status ?? "present") as AttendanceStatus,
                    hasPrevious: !!override,
                    existingAttendance: s.attendance || {},
                };
            });
    }, [rawStudents, overrides]);

    const updateStatus = useCallback((id: string, newStatus: AttendanceStatus) => {
        setOverrides(prev => {
            const currentStatus = prev[id]?.status ?? "present";
            if (currentStatus === newStatus) return prev; // no change
            return {
                ...prev,
                [id]: { status: newStatus, previous: currentStatus },
            };
        });
    }, []);

    const undoStatus = useCallback((id: string) => {
        setOverrides(prev => {
            const entry = prev[id];
            if (!entry) return prev;
            const newOverrides = { ...prev };
            delete newOverrides[id]; // Remove override to restore default "present"
            return newOverrides;
        });
    }, []);

    const handleSubmit = async () => {
        if (attendanceList.length === 0 || !selectedSubject) return;
        const today = new Date().toISOString().split('T')[0];
        
        try {
            const promises = attendanceList.map(s => {
                const existing = s.existingAttendance;
                const newAttendance = {
                    ...existing,
                    present: (existing.present || 0) + (s.status === 'present' ? 1 : 0),
                    absent: (existing.absent || 0) + (s.status === 'absent' ? 1 : 0),
                    late: (existing.late || 0) + (s.status === 'late' ? 1 : 0),
                    history: [
                        ...(existing.history || []),
                        {
                            date: today,
                            status: s.status,
                            time_in: s.status === 'present'
                                ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : '-'
                        }
                    ]
                };

                return updateAttendanceMutation.mutateAsync({
                    enrollmentId: s.enrollmentId,
                    attendance: newAttendance
                });
            });

            await Promise.all(promises);
            setIsSubmitted(true);
            Alert.alert("Success", "Attendance has been successfully saved.");
        } catch (err: any) {
            Alert.alert('Submit Failed', err.message || 'Could not save attendance.');
        }
    };

    const presentCount = useMemo(() => attendanceList.filter(s => s.status === 'present').length, [attendanceList]);
    const absentCount = useMemo(() => attendanceList.filter(s => s.status === 'absent').length, [attendanceList]);
    const lateCount = useMemo(() => attendanceList.filter(s => s.status === 'late').length, [attendanceList]);

    const renderStudentCard = useCallback(({ item }: { item: typeof attendanceList[0] }) => (
        <View style={styles.studentCard}>
            <View style={styles.studentInfo}>
                <View style={[
                    styles.avatar,
                    item.status === "absent" && styles.avatarAbsent,
                    item.status === "late" && styles.avatarLate
                ]}>
                    <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.studentStatusText}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                </View>
            </View>

            <View style={styles.actionRow}>
                {/* Per-student undo button */}
                <TouchableOpacity
                    style={[styles.undoBtn, !item.hasPrevious && styles.undoBtnDisabled]}
                    onPress={() => undoStatus(item.id)}
                    disabled={!item.hasPrevious}
                >
                    <Ionicons
                        name="arrow-undo"
                        size={14}
                        color={item.hasPrevious ? Colors.light.primary : "#CBD5E1"}
                    />
                </TouchableOpacity>

                <View style={styles.statusButtons}>
                    <TouchableOpacity
                        style={[styles.statusBtn, item.status === "present" && styles.btnPresent]}
                        onPress={() => updateStatus(item.id, "present")}
                    >
                        <Text style={[styles.statusBtnText, item.status === "present" && styles.textWhite]}>P</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.statusBtn, item.status === "absent" && styles.btnAbsent]}
                        onPress={() => updateStatus(item.id, "absent")}
                    >
                        <Text style={[styles.statusBtnText, item.status === "absent" && styles.textWhite]}>A</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.statusBtn, item.status === "late" && styles.btnLate]}
                        onPress={() => updateStatus(item.id, "late")}
                    >
                        <Text style={[styles.statusBtnText, item.status === "late" && styles.textWhite]}>L</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    ), [undoStatus, updateStatus]);

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader title="Attendance Management" hasNotifications={true} />

            <View style={styles.banner}>
                <View style={styles.bannerContent}>
                    <Text style={styles.bannerTitle}>Record Attendance</Text>
                    <Text style={styles.bannerSub}>
                        {selectedSubject ? selectedSubject.name : "Select a class"} • {new Date().toLocaleDateString()}
                    </Text>
                </View>
                <Ionicons name="calendar-outline" size={32} color="rgba(255,255,255,0.5)" />
            </View>

            <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
                <Text style={styles.filterLabel}>Select Class</Text>
                <TouchableOpacity style={styles.dropdown} onPress={() => setIsDropdownOpen(true)}>
                    <Ionicons name="book-outline" size={18} color={Colors.light.primary} />
                    <Text style={styles.dropdownText}>
                        {selectedSubject
                            ? `${selectedSubject.code} - ${selectedSubject.name}`
                            : isLoadingSubjects ? 'Loading subjects...' : 'No subjects available'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
                {[
                    { label: "Present", count: presentCount, color: "#10B981", icon: "checkmark-circle" },
                    { label: "Absent", count: absentCount, color: "#EF4444", icon: "close-circle" },
                    { label: "Late", count: lateCount, color: "#F59E0B", icon: "time" },
                ].map(stat => (
                    <View key={stat.label} style={styles.statBox}>
                        <View style={styles.statIconContainer}>
                            <Ionicons name={stat.icon as any} size={16} color={stat.color} />
                            <Text style={styles.statValue}>{stat.count}</Text>
                        </View>
                        <Text style={styles.statLabel}>{stat.label}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.listSection}>
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>Student List</Text>
                    <View style={styles.listHeaderRight}>
                        {isSubmitted && (
                            <View style={styles.submittedBadge}>
                                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                <Text style={styles.submittedText}>Submitted</Text>
                            </View>
                        )}
                        <Text style={styles.studentCount}>{attendanceList.length} students</Text>
                    </View>
                </View>

                {isLoadingStudents ? (
                    <View style={styles.emptyContainer}>
                        <ActivityIndicator color={Colors.light.primary} size="small" />
                        <Text style={styles.emptyText}>Loading roster...</Text>
                    </View>
                ) : attendanceList.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={48} color="#E2E8F0" />
                        <Text style={styles.emptyText}>No active students found in this class.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={attendanceList}
                        keyExtractor={item => item.id}
                        renderItem={renderStudentCard}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.submitBtn, attendanceList.length === 0 && { opacity: 0.7 }]}
                    disabled={attendanceList.length === 0}
                    onPress={handleSubmit}
                >
                    <Ionicons name={isSubmitted ? "refresh" : "checkmark-done"} size={20} color="#FFFFFF" />
                    <Text style={styles.submitText}>{isSubmitted ? "Re-Submit Report" : "Submit Report"}</Text>
                </TouchableOpacity>
            </View>

            {/* Subject Selector Modal */}
            <Modal
                visible={isDropdownOpen}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsDropdownOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Class</Text>
                            <TouchableOpacity onPress={() => setIsDropdownOpen(false)}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalList}>
                            {subjects.map(s => (
                                <TouchableOpacity
                                    key={s.id}
                                    style={[styles.modalOption, selectedSubjectId === s.id && styles.modalOptionSelected]}
                                    onPress={() => { setSelectedSubjectId(s.id); setIsDropdownOpen(false); }}
                                >
                                    <Text style={[styles.modalOptionText, selectedSubjectId === s.id && styles.modalOptionTextSelected]}>
                                        {s.code} - {s.name}
                                    </Text>
                                    {selectedSubjectId === s.id && <Ionicons name="checkmark" size={20} color={Colors.light.primary} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    banner: { backgroundColor: Colors.light.primary, margin: 16, padding: 24, borderRadius: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    bannerContent: { flex: 1, paddingRight: 10 },
    bannerTitle: { fontSize: 22, fontWeight: "bold", color: "#FFFFFF" },
    bannerSub: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 4 },
    statsRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 24 },
    statBox: { backgroundColor: "#FFFFFF", width: "31%", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#F1F5F9", alignItems: "center" },
    statIconContainer: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
    statValue: { fontSize: 18, fontWeight: "bold", marginLeft: 6, color: "#1E293B" },
    statLabel: { fontSize: 10, color: "#94A3B8", fontWeight: "600", textTransform: "uppercase" },
    listSection: { flex: 1, paddingHorizontal: 16 },
    listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    listHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    listTitle: { fontSize: 18, fontWeight: "bold", color: "#1E293B" },
    studentCount: { fontSize: 12, color: "#64748B" },
    submittedBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#DCFCE7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
    submittedText: { fontSize: 11, color: "#15803D", fontWeight: "bold" },
    listContent: { paddingBottom: 20 },
    studentCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "#F1F5F9" },
    studentInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F0FDF4", justifyContent: "center", alignItems: "center", marginRight: 12, borderWidth: 1, borderColor: "#10B981" },
    avatarAbsent: { backgroundColor: "#FEF2F2", borderColor: "#EF4444" },
    avatarLate: { backgroundColor: "#FFFBEB", borderColor: "#F59E0B" },
    avatarText: { color: "#1E293B", fontWeight: "bold" },
    studentName: { fontSize: 14, fontWeight: "bold", color: "#1E293B" },
    studentStatusText: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
    actionRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    undoBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" },
    undoBtnDisabled: { opacity: 0.4 },
    statusButtons: { flexDirection: "row" },
    statusBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F8FAFC", justifyContent: "center", alignItems: "center", marginLeft: 6, borderWidth: 1, borderColor: "#E2E8F0" },
    statusBtnText: { fontSize: 12, fontWeight: "bold", color: "#64748B" },
    btnPresent: { backgroundColor: "#10B981", borderColor: "#10B981" },
    btnAbsent: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
    btnLate: { backgroundColor: "#F59E0B", borderColor: "#F59E0B" },
    textWhite: { color: "#FFFFFF" },
    footer: { padding: 16, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E2E8F0" },
    submitBtn: { backgroundColor: Colors.light.primary, flexDirection: "row", height: 50, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    submitText: { color: "#FFFFFF", fontWeight: "bold", marginLeft: 10, fontSize: 15 },
    emptyContainer: { paddingVertical: 40, alignItems: 'center' },
    emptyText: { color: '#94A3B8', fontSize: 14, marginTop: 12 },
    filterLabel: { fontSize: 14, fontWeight: "600", color: "#1E293B", marginBottom: 8 },
    dropdown: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", height: 50, borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: "#E2E8F0" },
    dropdownText: { flex: 1, fontSize: 14, color: "#1E293B", marginLeft: 10, fontWeight: '500' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '60%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
    modalList: { flexGrow: 0 },
    modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    modalOptionSelected: { backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 12, borderBottomWidth: 0 },
    modalOptionText: { fontSize: 16, color: '#1E293B' },
    modalOptionTextSelected: { color: Colors.light.primary, fontWeight: 'bold' },
});
