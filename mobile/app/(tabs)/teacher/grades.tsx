import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../../src/components/common/AppHeader";
import Colors from "../../../src/constants/Colors";
import { useTeacherSubjectsQuery } from "../../../src/hooks/query/subjects/use-teacher-subjects-query";
import { useClassStudentsQuery } from "../../../src/hooks/query/enrollments/use-class-students-query";
import { useUpdateGradesMutation } from "../../../src/hooks/query/enrollments/use-update-grades-mutation";

const STATS = [
    { label: "Class Average", value: "90%", icon: "trending-up", color: "#10B981" },
    { label: "Highest Grade", value: "95%", icon: "ribbon", color: "#3B82F6" },
    { label: "Lowest Grade", value: "85%", icon: "trending-down", color: "#EF4444" },
    { label: "Passing Rate", value: "100%", icon: "checkmark-circle", color: "#10B981" },
];

export default function GradesManagementScreen() {
    const { data: subjects = [], isLoading: isLoadingSubjects } = useTeacherSubjectsQuery();
    const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    useEffect(() => {
        if (!selectedSubjectId && subjects.length > 0) {
            setSelectedSubjectId(subjects[0].id);
        }
    }, [subjects, selectedSubjectId]);

    const { data: rawStudents = [], isLoading: isLoadingStudents } = useClassStudentsQuery({ 
        subjectId: selectedSubjectId || '' 
    });

    const [studentsData, setStudentsData] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const updateGradesMutation = useUpdateGradesMutation(selectedSubjectId || '');

    useEffect(() => {
        const activeStudents = rawStudents.filter(s => s.status === 'Active');
        if (activeStudents.length > 0) {
            setStudentsData(activeStudents.map(s => {
                const grades = s.grades || {};
                return {
                    id: s.id,
                    enrollmentId: s.enrollmentId,
                    name: s.name,
                    q1: grades.q1 || 0,
                    q2: grades.q2 || 0,
                    q3: grades.q3 || 0,
                    q4: grades.q4 || 0,
                    overall: grades.overall || 0,
                    remarks: grades.remarks || "Pending"
                };
            }));
        } else {
            setStudentsData([]);
        }
    }, [rawStudents]);

    const selectedSubject = subjects.find(s => s.id === selectedSubjectId);

    const filteredStudents = studentsData.filter(student => 
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.id.includes(searchQuery)
    );

    const handleGradeChange = (studentId: string, field: 'q1' | 'q2' | 'q3' | 'q4', value: string) => {
        const numValue = parseInt(value) || 0;
        setStudentsData(prev => prev.map(student => {
            if (student.id === studentId) {
                const updatedStudent = { ...student, [field]: numValue };
                updatedStudent.overall = Math.round((updatedStudent.q1 + updatedStudent.q2 + updatedStudent.q3 + updatedStudent.q4) / 4);
                updatedStudent.remarks = updatedStudent.overall >= 90 ? "Outstanding" : 
                                         updatedStudent.overall >= 85 ? "Very Satisfactory" : 
                                         updatedStudent.overall >= 80 ? "Satisfactory" : 
                                         updatedStudent.overall >= 75 ? "Fair" : "Failed";
                return updatedStudent;
            }
            return student;
        }));
    };

    const handleSave = async () => {
        try {
            const promises = studentsData.map(student => 
                updateGradesMutation.mutateAsync({
                    enrollmentId: student.enrollmentId,
                    grades: {
                        q1: student.q1,
                        q2: student.q2,
                        q3: student.q3,
                        q4: student.q4,
                        overall: student.overall,
                        remarks: student.remarks
                    }
                })
            );
            await Promise.all(promises);
            Alert.alert("Success", "All grades have been saved successfully.");
        } catch (error) {
            console.error("Failed to save all grades", error);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader title="Grades Management" hasNotifications={true} />
            
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Banner */}
                <View style={styles.banner}>
                    <Text style={styles.bannerTitle}>Encode Student Grades</Text>
                    <Text style={styles.bannerSub}>Manage and update student performance records</Text>
                </View>

                {/* Stats Grid */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsContainer}>
                    {STATS.map(stat => (
                        <View style={styles.statCard} key={stat.label}>
                            <View style={styles.statHeader}>
                                <Ionicons name={stat.icon as any} size={16} color={stat.color} />
                                <Text style={styles.statLabel}>{stat.label}</Text>
                            </View>
                            <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                        </View>
                    ))}
                </ScrollView>

                {/* Filters */}
                <View style={styles.filtersSection}>
                    <View style={styles.filterGroup}>
                        <Text style={styles.filterLabel}>Select Class</Text>
                        <TouchableOpacity 
                            style={styles.dropdown}
                            onPress={() => setIsDropdownOpen(true)}
                        >
                            <Ionicons name="book-outline" size={18} color={Colors.light.primary} />
                            <Text style={styles.dropdownText}>
                                {selectedSubject ? `${selectedSubject.code} - ${selectedSubject.name}` : isLoadingSubjects ? 'Loading subjects...' : 'No subjects available'}
                            </Text>
                            <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.filterGroup}>
                        <Text style={styles.filterLabel}>Search Student</Text>
                        <View style={styles.searchBar}>
                            <Ionicons name="search" size={18} color="#94A3B8" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by name or ID..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                    </View>
                </View>

                {/* Table Header */}
                <View style={styles.tableSection}>
                    <View style={styles.tableHeader}>
                        <Text style={styles.tableHeaderTitle}>{selectedSubject?.name || 'Loading...'}</Text>
                        <Text style={styles.studentCount}>{studentsData.length} active students</Text>
                    </View>

                    {isLoadingStudents ? (
                        <View style={styles.emptyContainer}>
                            <ActivityIndicator color={Colors.light.primary} size="small" />
                            <Text style={styles.emptyText}>Loading students...</Text>
                        </View>
                    ) : studentsData.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No students enrolled in this class yet.</Text>
                        </View>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.tableContainer}>
                                <View style={styles.tableHead}>
                                    <Text style={[styles.headText, styles.studentNameCol]}>STUDENT NAME</Text>
                                    <Text style={[styles.headText, styles.gradeCol]}>Q1</Text>
                                    <Text style={[styles.headText, styles.gradeCol]}>Q2</Text>
                                    <Text style={[styles.headText, styles.gradeCol]}>Q3</Text>
                                    <Text style={[styles.headText, styles.gradeCol]}>Q4</Text>
                                    <Text style={[styles.headText, styles.gradeCol]}>FINAL</Text>
                                    <Text style={[styles.headText, styles.remarksCol]}>REMARKS</Text>
                                </View>
                                
                                {filteredStudents.map((student) => (
                                    <View key={student.id} style={styles.tableRow}>
                                        <View style={styles.studentNameCol}>
                                            <Text style={styles.studentNameText} numberOfLines={1}>{student.name}</Text>
                                        </View>
                                        <View style={styles.gradeCol}>
                                            <TextInput
                                                style={styles.gradeInput}
                                                keyboardType="numeric"
                                                value={student.q1.toString()}
                                                onChangeText={(val) => handleGradeChange(student.id, 'q1', val)}
                                            />
                                        </View>
                                        <View style={styles.gradeCol}>
                                            <TextInput
                                                style={styles.gradeInput}
                                                keyboardType="numeric"
                                                value={student.q2.toString()}
                                                onChangeText={(val) => handleGradeChange(student.id, 'q2', val)}
                                            />
                                        </View>
                                        <View style={styles.gradeCol}>
                                            <TextInput
                                                style={styles.gradeInput}
                                                keyboardType="numeric"
                                                value={student.q3.toString()}
                                                onChangeText={(val) => handleGradeChange(student.id, 'q3', val)}
                                            />
                                        </View>
                                        <View style={styles.gradeCol}>
                                            <TextInput
                                                style={styles.gradeInput}
                                                keyboardType="numeric"
                                                value={student.q4.toString()}
                                                onChangeText={(val) => handleGradeChange(student.id, 'q4', val)}
                                            />
                                        </View>
                                        <Text style={[styles.gradeText, styles.gradeCol]}>{student.overall}</Text>
                                        <View style={styles.remarksCol}>
                                            <View style={[styles.remarksBadge, student.remarks === "Outstanding" || student.remarks === "Very Satisfactory" ? styles.bgGreen : student.remarks === "Failed" ? styles.bgRed : styles.bgBlue]}>
                                                <Text style={[styles.remarksText, student.remarks === "Outstanding" || student.remarks === "Very Satisfactory" ? styles.textGreen : student.remarks === "Failed" ? styles.textRed : styles.textBlue]}>{student.remarks}</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    )}

                    <TouchableOpacity 
                        style={[styles.saveButton, (updateGradesMutation.isPending || studentsData.length === 0) && { opacity: 0.7 }]}
                        onPress={handleSave}
                        disabled={updateGradesMutation.isPending || studentsData.length === 0}
                        activeOpacity={0.8}
                    >
                        {updateGradesMutation.isPending ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <>
                                <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                                <Text style={styles.saveButtonText}>Save All Changes</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>

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
                                    onPress={() => {
                                        setSelectedSubjectId(s.id);
                                        setIsDropdownOpen(false);
                                    }}
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
    banner: { backgroundColor: Colors.light.primary, padding: 24, margin: 16, borderRadius: 16 },
    bannerTitle: { fontSize: 22, fontWeight: "bold", color: "#FFFFFF" },
    bannerSub: { fontSize: 13, color: "rgba(255, 255, 255, 0.8)", marginTop: 4 },
    statsContainer: { paddingLeft: 16, paddingBottom: 24 },
    statCard: {
        backgroundColor: "#FFFFFF", padding: 16, borderRadius: 12, marginRight: 12, minWidth: 140,
        borderWidth: 1, borderColor: "#F1F5F9", shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
    },
    statHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    statLabel: { fontSize: 12, color: "#64748B", marginLeft: 6 },
    statValue: { fontSize: 20, fontWeight: "bold" },
    filtersSection: { paddingHorizontal: 16, marginBottom: 24 },
    filterGroup: { marginBottom: 16 },
    filterLabel: { fontSize: 14, fontWeight: "600", color: "#1E293B", marginBottom: 8 },
    dropdown: {
        flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", height: 50,
        borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: "#E2E8F0"
    },
    dropdownText: { flex: 1, fontSize: 14, color: "#1E293B", marginLeft: 10, fontWeight: '500' },
    searchBar: {
        flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", height: 50,
        borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: "#E2E8F0"
    },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 14 },
    tableSection: {
        backgroundColor: "#FFFFFF", marginHorizontal: 16, borderRadius: 12, padding: 16,
        borderWidth: 1, borderColor: "#F1F5F9", marginBottom: 32
    },
    tableHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginBottom: 20 },
    tableHeaderTitle: { fontSize: 18, fontWeight: "bold", color: "#1E293B", maxWidth: "70%" },
    studentCount: { fontSize: 12, color: "#64748B" },
    tableContainer: { minWidth: 500 },
    tableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#F1F5F9", paddingBottom: 12, marginBottom: 12 },
    headText: { fontSize: 11, fontWeight: "bold", color: "#94A3B8" },
    tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F8FAFC" },
    studentNameCol: { width: 140 },
    gradeCol: { width: 70, textAlign: "center" },
    remarksCol: { width: 140, alignItems: "center" },
    studentNameText: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
    gradeText: { fontSize: 14, color: "#1E293B", textAlign: "center", fontWeight: 'bold' },
    remarksBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    gradeInput: {
        backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 6,
        paddingHorizontal: 8, paddingVertical: 4, textAlign: "center", fontSize: 14, color: "#1E293B", width: 60
    },
    remarksText: { fontSize: 11, fontWeight: "bold" },
    bgGreen: { backgroundColor: "#F0FDF4" },
    textGreen: { color: "#10B981" },
    bgBlue: { backgroundColor: "#EFF6FF" },
    textBlue: { color: "#3B82F6" },
    bgRed: { backgroundColor: "#FEF2F2" },
    textRed: { color: "#EF4444" },
    saveButton: {
        backgroundColor: "#10B981", flexDirection: "row", height: 50, borderRadius: 10,
        justifyContent: "center", alignItems: "center", marginTop: 20
    },
    saveButtonText: { color: "#FFFFFF", fontWeight: "bold", marginLeft: 8, fontSize: 15 },
    emptyContainer: { paddingVertical: 40, alignItems: 'center' },
    emptyText: { color: '#94A3B8', fontSize: 14, marginTop: 8 },
    
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '60%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
    modalList: { flexGrow: 0 },
    modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    modalOptionSelected: { backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 12, borderBottomWidth: 0 },
    modalOptionText: { fontSize: 16, color: '#1E293B' },
    modalOptionTextSelected: { color: Colors.light.primary, fontWeight: 'bold' }
});
