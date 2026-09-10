import React, { useState, useEffect, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Modal,
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../../src/components/common/AppHeader";
import Colors from "../../../src/constants/Colors";
import { useTeacherSubjectsQuery } from "../../../src/hooks/query/subjects/use-teacher-subjects-query";
import { useClassStudentsQuery } from "../../../src/hooks/query/enrollments/use-class-students-query";
import { useUpdateGradesMutation } from "../../../src/hooks/query/enrollments/use-update-grades-mutation";
import {
    getGradeRemarks,
    normalizeSubjectCategory,
    getDepedCategorySettings,
    clampNumericGrade,
} from "../../../src/lib/deped-grading";

type QuarterFilter = "all" | "term1" | "term2" | "term3" | "term4";
type ViewFilter = "all" | "passed" | "failed";

export default function GradesManagementScreen() {
    const { data: subjects = [], isLoading: isLoadingSubjects } = useTeacherSubjectsQuery();
    const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [activeQuarter, setActiveQuarter] = useState<QuarterFilter>("all");
    const [activeView, setActiveView] = useState<ViewFilter>("all");
    const [selectedStudentForModal, setSelectedStudentForModal] = useState<any | null>(null);

    useEffect(() => {
        if (!selectedSubjectId && subjects.length > 0) {
            setSelectedSubjectId(subjects[0].id);
        }
    }, [subjects, selectedSubjectId]);

    const { data: rawStudents = [], isLoading: isLoadingStudents } = useClassStudentsQuery({
        subjectId: selectedSubjectId || "",
    });

    const [studentsData, setStudentsData] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const updateGradesMutation = useUpdateGradesMutation(selectedSubjectId || "");

    const selectedSubject = useMemo(
        () => subjects.find((s) => s.id === selectedSubjectId),
        [subjects, selectedSubjectId]
    );

    const subjectCategory = useMemo(
        () => normalizeSubjectCategory(selectedSubject?.category || (selectedSubject as any)?.subject_category, selectedSubject?.name || selectedSubject?.code),
        [selectedSubject]
    );

    const categorySettings = useMemo(
        () => getDepedCategorySettings(subjectCategory),
        [subjectCategory]
    );

    // Calculate final grade as average of graded quarters (non-zero) matching DepEd standard
    const calculateOverallAndRemarks = (q1: number, q2: number, q3: number, q4: number) => {
        const gradedQuarters = [q1, q2, q3, q4].filter((q) => q > 0);
        const overall = gradedQuarters.length > 0
            ? Math.round(gradedQuarters.reduce((sum, q) => sum + q, 0) / gradedQuarters.length)
            : 0;
        const remarks = overall > 0 ? getGradeRemarks(overall) : "Needs Improvement";
        return { overall, remarks, isPassed: overall >= 75 };
    };

    useEffect(() => {
        const activeStudents = rawStudents.filter((s) => s.status === "Active");
        if (activeStudents.length > 0) {
            setStudentsData(
                activeStudents.map((s) => {
                    const grades = s.grades || {};
                    const q1 = Number(grades.q1 || 0);
                    const q2 = Number(grades.q2 || 0);
                    const q3 = Number(grades.q3 || 0);
                    const q4 = Number(grades.q4 || 0);
                    const { overall, remarks } = calculateOverallAndRemarks(q1, q2, q3, q4);

                    return {
                        id: s.id,
                        enrollmentId: s.enrollmentId,
                        studentId: s.studentId,
                        lrn: s.lrn || "N/A",
                        avatarUrl: s.avatarUrl || "",
                        name: s.name,
                        q1,
                        q2,
                        q3,
                        q4,
                        overall: Number(grades.overall || overall),
                        remarks: grades.remarks || remarks,
                        quizAverage: Number(grades.quizAverage || 0),
                        activityGrade: Number(grades.activityGrade || 0),
                        assignmentGrade: Number(grades.assignmentGrade || 0),
                        examGrade: Number(grades.examGrade || 0),
                        gradeComputation: grades.gradeComputation || null,
                        isPassed: Number(grades.overall || overall) >= 75,
                    };
                })
            );
        } else {
            setStudentsData([]);
        }
    }, [rawStudents]);

    // Dynamic stats computation based on actual enrolled students
    const stats = useMemo(() => {
        if (studentsData.length === 0) {
            return [
                { label: "Class Average", value: "0%", icon: "trending-up", color: "#10B981" },
                { label: "Highest Grade", value: "0%", icon: "ribbon", color: "#3B82F6" },
                { label: "Lowest Grade", value: "0%", icon: "trending-down", color: "#EF4444" },
                { label: "Passing Rate", value: "0%", icon: "checkmark-circle", color: "#10B981" },
            ];
        }

        const overallGrades = studentsData.map((s) => s.overall).filter((g) => g > 0);
        const classAvg = overallGrades.length > 0
            ? Math.round(overallGrades.reduce((a, b) => a + b, 0) / overallGrades.length)
            : 0;
        const highest = overallGrades.length > 0 ? Math.max(...overallGrades) : 0;
        const lowest = overallGrades.length > 0 ? Math.min(...overallGrades) : 0;
        const passingCount = studentsData.filter((s) => s.overall >= 75).length;
        const passingRate = Math.round((passingCount / studentsData.length) * 100);

        return [
            { label: "Class Average", value: `${classAvg}%`, icon: "trending-up", color: "#10B981" },
            { label: "Highest Grade", value: `${highest}%`, icon: "ribbon", color: "#3B82F6" },
            { label: "Lowest Grade", value: `${lowest}%`, icon: "trending-down", color: "#EF4444" },
            { label: "Passing Rate", value: `${passingRate}%`, icon: "checkmark-circle", color: "#10B981" },
        ];
    }, [studentsData]);

    const filteredStudents = useMemo(() => {
        let base = studentsData;
        if (activeView === "passed") base = base.filter((s) => s.overall >= 75);
        if (activeView === "failed") base = base.filter((s) => s.overall < 75);

        const search = searchQuery.toLowerCase().trim();
        if (search) {
            base = base.filter(
                (student) =>
                    student.name.toLowerCase().includes(search) ||
                    String(student.lrn || "").toLowerCase().includes(search) ||
                    student.id.toLowerCase().includes(search)
            );
        }
        return base;
    }, [studentsData, activeView, searchQuery]);

    const handleGradeChange = (studentId: string, field: "q1" | "q2" | "q3" | "q4", value: string) => {
        const numValue = clampNumericGrade(value, 0, 100);
        setStudentsData((prev) =>
            prev.map((student) => {
                if (student.id === studentId) {
                    const updated = { ...student, [field]: numValue };
                    const { overall, remarks, isPassed } = calculateOverallAndRemarks(
                        updated.q1,
                        updated.q2,
                        updated.q3,
                        updated.q4
                    );
                    updated.overall = overall;
                    updated.remarks = remarks;
                    updated.isPassed = isPassed;
                    return updated;
                }
                return student;
            })
        );
    };

    const handleSave = async () => {
        try {
            const promises = studentsData.map((student) =>
                updateGradesMutation.mutateAsync({
                    enrollmentId: student.enrollmentId,
                    studentId: student.id,
                    subjectCategory,
                    grades: {
                        q1: student.q1,
                        q2: student.q2,
                        q3: student.q3,
                        q4: student.q4,
                        overall: student.overall,
                        remarks: student.remarks,
                        quizAverage: student.quizAverage,
                        activityGrade: student.activityGrade,
                        assignmentGrade: student.assignmentGrade,
                        examGrade: student.examGrade,
                        gradeComputation: student.gradeComputation,
                    },
                })
            );
            await Promise.all(promises);
            Alert.alert("Success", "All student grades have been saved successfully.");
        } catch (error) {
            console.error("Failed to save all grades", error);
        }
    };

    const passingCount = studentsData.filter((s) => s.overall >= 75).length;
    const failingCount = studentsData.filter((s) => s.overall < 75).length;

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader title="Grades Management" hasNotifications={true} />

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Banner */}
                <View style={styles.banner}>
                    <Text style={styles.bannerTitle}>Encode Student Grades</Text>
                    <Text style={styles.bannerSub}>
                        Official DepEd Grading • {subjectCategory} (WW {categorySettings.writtenWorksWeight}% / PT {categorySettings.performanceTasksWeight}%)
                    </Text>
                </View>

                {/* Stats Grid */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsContainer}>
                    {stats.map((stat) => (
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
                        <TouchableOpacity style={styles.dropdown} onPress={() => setIsDropdownOpen(true)}>
                            <Ionicons name="book-outline" size={18} color={Colors.light.primary} />
                            <Text style={styles.dropdownText}>
                                {selectedSubject
                                    ? `${selectedSubject.code} - ${selectedSubject.name}`
                                    : isLoadingSubjects
                                    ? "Loading subjects..."
                                    : "No subjects available"}
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
                                placeholder="Search by student name or LRN..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                    </View>

                    {/* Quarter Filter Tabs */}
                    <View style={styles.filterTabsRow}>
                        <View style={styles.quarterTabsGroup}>
                            {[
                                { key: "all" as QuarterFilter, label: "All Quarters" },
                                { key: "term1" as QuarterFilter, label: "Q1" },
                                { key: "term2" as QuarterFilter, label: "Q2" },
                                { key: "term3" as QuarterFilter, label: "Q3" },
                                { key: "term4" as QuarterFilter, label: "Q4" },
                            ].map(({ key, label }) => {
                                const isActive = activeQuarter === key;
                                return (
                                    <TouchableOpacity
                                        key={key}
                                        style={[styles.quarterTabBtn, isActive && styles.quarterTabBtnActive]}
                                        onPress={() => setActiveQuarter(key)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.quarterTabBtnText, isActive && styles.quarterTabBtnTextActive]}>
                                            {label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Pass/Fail Filter Tabs */}
                        <View style={styles.viewTabsGroup}>
                            {[
                                { key: "all" as ViewFilter, label: `All (${studentsData.length})` },
                                { key: "passed" as ViewFilter, label: `Passed (${passingCount})`, color: "#16A34A" },
                                { key: "failed" as ViewFilter, label: `Failed (${failingCount})`, color: "#DC2626" },
                            ].map(({ key, label, color }) => {
                                const isActive = activeView === key;
                                return (
                                    <TouchableOpacity
                                        key={key}
                                        style={[styles.viewTabBtn, isActive && styles.viewTabBtnActive]}
                                        onPress={() => setActiveView(key)}
                                        activeOpacity={0.7}
                                    >
                                        <Text
                                            style={[
                                                styles.viewTabBtnText,
                                                isActive && styles.viewTabBtnTextActive,
                                                !isActive && color ? { color } : null,
                                            ]}
                                        >
                                            {label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </View>

                {/* Table Header */}
                <View style={styles.tableSection}>
                    <View style={styles.tableHeader}>
                        <View>
                            <Text style={styles.tableHeaderTitle}>{selectedSubject?.name || "Loading..."}</Text>
                            <Text style={styles.categoryBadgeText}>{subjectCategory}</Text>
                        </View>
                        <Text style={styles.studentCount}>
                            {filteredStudents.length} of {studentsData.length} active students
                        </Text>
                    </View>

                    {isLoadingStudents ? (
                        <View style={styles.emptyContainer}>
                            <ActivityIndicator color={Colors.light.primary} size="small" />
                            <Text style={styles.emptyText}>Loading students...</Text>
                        </View>
                    ) : filteredStudents.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                {studentsData.length === 0
                                    ? "No students enrolled in this class yet."
                                    : "No matching students found."}
                            </Text>
                        </View>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                            <View style={styles.tableContainer}>
                                <View style={styles.tableHead}>
                                    <Text style={[styles.headText, styles.studentNameCol]}>STUDENT NAME</Text>
                                    {(activeQuarter === "all" || activeQuarter === "term1") && (
                                        <Text style={[styles.headText, styles.gradeCol, styles.headGreen]}>Q1</Text>
                                    )}
                                    {(activeQuarter === "all" || activeQuarter === "term2") && (
                                        <Text style={[styles.headText, styles.gradeCol, styles.headGreen]}>Q2</Text>
                                    )}
                                    {(activeQuarter === "all" || activeQuarter === "term3") && (
                                        <Text style={[styles.headText, styles.gradeCol, styles.headGreen]}>Q3</Text>
                                    )}
                                    {(activeQuarter === "all" || activeQuarter === "term4") && (
                                        <Text style={[styles.headText, styles.gradeCol, styles.headGreen]}>Q4</Text>
                                    )}
                                    <Text style={[styles.headText, styles.overallCol]}>FINAL</Text>
                                    <Text style={[styles.headText, styles.remarksCol]}>REMARKS</Text>
                                    <Text style={[styles.headText, styles.actionCol]}>DETAILS</Text>
                                </View>

                                {filteredStudents.map((student) => {
                                    const avatarLetter = student.name.charAt(0).toUpperCase();
                                    const isRowFail = !student.isPassed;

                                    return (
                                        <TouchableOpacity
                                            key={student.id}
                                            style={[styles.tableRow, isRowFail && styles.rowFailed]}
                                            activeOpacity={0.85}
                                            onPress={() => setSelectedStudentForModal(student)}
                                        >
                                            <View style={[styles.studentNameCol, styles.studentColFlex]}>
                                                {student.avatarUrl ? (
                                                    <Image source={{ uri: student.avatarUrl }} style={styles.avatarImg} />
                                                ) : (
                                                    <View
                                                        style={[
                                                            styles.avatarCircle,
                                                            { backgroundColor: student.isPassed ? "#16A34A" : "#DC2626" },
                                                        ]}
                                                    >
                                                        <Text style={styles.avatarLetter}>{avatarLetter}</Text>
                                                    </View>
                                                )}
                                                <View style={styles.studentTextContainer}>
                                                    <Text style={styles.studentNameText} numberOfLines={1}>
                                                        {student.name}
                                                    </Text>
                                                    <Text style={styles.studentLrnText} numberOfLines={1}>
                                                        LRN: {student.lrn}
                                                    </Text>
                                                </View>
                                            </View>

                                            {(activeQuarter === "all" || activeQuarter === "term1") && (
                                                <View style={styles.gradeCol}>
                                                    <TextInput
                                                        style={styles.gradeInput}
                                                        keyboardType="numeric"
                                                        value={student.q1 > 0 ? student.q1.toString() : ""}
                                                        placeholder="0"
                                                        placeholderTextColor="#CBD5E1"
                                                        onChangeText={(val) => handleGradeChange(student.id, "q1", val)}
                                                    />
                                                </View>
                                            )}

                                            {(activeQuarter === "all" || activeQuarter === "term2") && (
                                                <View style={styles.gradeCol}>
                                                    <TextInput
                                                        style={styles.gradeInput}
                                                        keyboardType="numeric"
                                                        value={student.q2 > 0 ? student.q2.toString() : ""}
                                                        placeholder="0"
                                                        placeholderTextColor="#CBD5E1"
                                                        onChangeText={(val) => handleGradeChange(student.id, "q2", val)}
                                                    />
                                                </View>
                                            )}

                                            {(activeQuarter === "all" || activeQuarter === "term3") && (
                                                <View style={styles.gradeCol}>
                                                    <TextInput
                                                        style={styles.gradeInput}
                                                        keyboardType="numeric"
                                                        value={student.q3 > 0 ? student.q3.toString() : ""}
                                                        placeholder="0"
                                                        placeholderTextColor="#CBD5E1"
                                                        onChangeText={(val) => handleGradeChange(student.id, "q3", val)}
                                                    />
                                                </View>
                                            )}

                                            {(activeQuarter === "all" || activeQuarter === "term4") && (
                                                <View style={styles.gradeCol}>
                                                    <TextInput
                                                        style={styles.gradeInput}
                                                        keyboardType="numeric"
                                                        value={student.q4 > 0 ? student.q4.toString() : ""}
                                                        placeholder="0"
                                                        placeholderTextColor="#CBD5E1"
                                                        onChangeText={(val) => handleGradeChange(student.id, "q4", val)}
                                                    />
                                                </View>
                                            )}

                                            <View style={styles.overallCol}>
                                                <View
                                                    style={[
                                                        styles.overallBadge,
                                                        { backgroundColor: student.isPassed ? "#DCFCE7" : "#FEE2E2" },
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.overallText,
                                                            { color: student.isPassed ? "#15803D" : "#B91C1C" },
                                                        ]}
                                                    >
                                                        {student.overall}%
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={styles.remarksCol}>
                                                <View
                                                    style={[
                                                        styles.remarksBadge,
                                                        student.isPassed ? styles.bgGreen : styles.bgRed,
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.remarksText,
                                                            student.isPassed ? styles.textGreen : styles.textRed,
                                                        ]}
                                                        numberOfLines={1}
                                                        adjustsFontSizeToFit
                                                        minimumFontScale={0.8}
                                                    >
                                                        {student.remarks}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={styles.actionCol}>
                                                <TouchableOpacity
                                                    style={styles.detailsBtn}
                                                    onPress={() => setSelectedStudentForModal(student)}
                                                >
                                                    <Ionicons name="eye-outline" size={16} color={Colors.light.primary} />
                                                </TouchableOpacity>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.saveButton,
                            (updateGradesMutation.isPending || studentsData.length === 0) && { opacity: 0.7 },
                        ]}
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

            {/* Student Gradebook Detail Modal */}
            <Modal
                visible={Boolean(selectedStudentForModal)}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setSelectedStudentForModal(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.gradeModalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>{selectedStudentForModal?.name}</Text>
                                <Text style={styles.modalSub}>
                                    LRN: {selectedStudentForModal?.lrn} • {subjectCategory}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedStudentForModal(null)}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                            {/* Summary Cards */}
                            <View style={styles.modalSummaryRow}>
                                <View style={[styles.modalTile, styles.bgGreenLight]}>
                                    <Text style={styles.modalTileLabel}>Overall Grade</Text>
                                    <Text style={[styles.modalTileValue, { color: "#15803D" }]}>
                                        {selectedStudentForModal?.overall}%
                                    </Text>
                                </View>
                                <View style={[styles.modalTile, styles.bgGreenLight]}>
                                    <Text style={styles.modalTileLabel}>Remarks</Text>
                                    <Text
                                        style={[
                                            styles.modalTileValue,
                                            { color: selectedStudentForModal?.isPassed ? "#15803D" : "#DC2626", fontSize: 13 },
                                        ]}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                    >
                                        {selectedStudentForModal?.remarks}
                                    </Text>
                                </View>
                            </View>

                            {/* Quarterly Breakdown */}
                            <Text style={styles.modalSectionTitle}>Quarterly Grades Breakdown</Text>
                            <View style={styles.modalQuarterRow}>
                                <View style={styles.modalQuarterBox}>
                                    <Text style={styles.modalQuarterLabel}>Q1</Text>
                                    <Text style={styles.modalQuarterVal}>{selectedStudentForModal?.q1 || 0}</Text>
                                </View>
                                <View style={styles.modalQuarterBox}>
                                    <Text style={styles.modalQuarterLabel}>Q2</Text>
                                    <Text style={styles.modalQuarterVal}>{selectedStudentForModal?.q2 || 0}</Text>
                                </View>
                                <View style={styles.modalQuarterBox}>
                                    <Text style={styles.modalQuarterLabel}>Q3</Text>
                                    <Text style={styles.modalQuarterVal}>{selectedStudentForModal?.q3 || 0}</Text>
                                </View>
                                <View style={styles.modalQuarterBox}>
                                    <Text style={styles.modalQuarterLabel}>Q4</Text>
                                    <Text style={styles.modalQuarterVal}>{selectedStudentForModal?.q4 || 0}</Text>
                                </View>
                            </View>

                            {/* DepEd Weights Info */}
                            <View style={styles.depedInfoCard}>
                                <View style={styles.depedInfoRow}>
                                    <Ionicons name="information-circle-outline" size={18} color="#059669" />
                                    <Text style={styles.depedInfoTitle}>DepEd Grading System Formula</Text>
                                </View>
                                <Text style={styles.depedInfoDesc}>
                                    • Written Works Weight: {categorySettings.writtenWorksWeight}%{"\n"}
                                    • Performance Tasks Weight: {categorySettings.performanceTasksWeight}%{"\n"}
                                    • Initial Grade = (WW Weighted Score + PT Weighted Score){"\n"}
                                    • Quarterly Grade = 37.5 + (Initial Grade × 0.625){"\n"}
                                    • Passing Grade = 75%
                                </Text>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

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
                            {subjects.map((s) => (
                                <TouchableOpacity
                                    key={s.id}
                                    style={[styles.modalOption, selectedSubjectId === s.id && styles.modalOptionSelected]}
                                    onPress={() => {
                                        setSelectedSubjectId(s.id);
                                        setIsDropdownOpen(false);
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.modalOptionText,
                                            selectedSubjectId === s.id && styles.modalOptionTextSelected,
                                        ]}
                                    >
                                        {s.code} - {s.name}
                                    </Text>
                                    {selectedSubjectId === s.id && (
                                        <Ionicons name="checkmark" size={20} color={Colors.light.primary} />
                                    )}
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
    banner: { backgroundColor: Colors.light.primary, padding: 20, margin: 16, borderRadius: 16 },
    bannerTitle: { fontSize: 20, fontWeight: "800", color: "#FFFFFF" },
    bannerSub: { fontSize: 12, color: "rgba(255, 255, 255, 0.9)", marginTop: 4, fontWeight: "500" },
    statsContainer: { paddingLeft: 16, paddingBottom: 16 },
    statCard: {
        backgroundColor: "#FFFFFF",
        padding: 14,
        borderRadius: 12,
        marginRight: 10,
        minWidth: 130,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    statHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
    statLabel: { fontSize: 11, color: "#64748B", marginLeft: 6, fontWeight: "600" },
    statValue: { fontSize: 18, fontWeight: "800" },
    filtersSection: { paddingHorizontal: 16, marginBottom: 16 },
    filterGroup: { marginBottom: 12 },
    filterLabel: { fontSize: 13, fontWeight: "700", color: "#1E293B", marginBottom: 6 },
    dropdown: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        height: 48,
        borderRadius: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    dropdownText: { flex: 1, fontSize: 13, color: "#1E293B", marginLeft: 10, fontWeight: "600" },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        height: 48,
        borderRadius: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 13, color: "#1E293B" },
    filterTabsRow: {
        marginTop: 4,
        gap: 8,
    },
    quarterTabsGroup: {
        flexDirection: "row",
        backgroundColor: "#E2E8F0",
        borderRadius: 8,
        padding: 2,
        alignSelf: "flex-start",
    },
    quarterTabBtn: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    quarterTabBtnActive: {
        backgroundColor: "#059669",
    },
    quarterTabBtnText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#475569",
    },
    quarterTabBtnTextActive: {
        color: "#FFFFFF",
    },
    viewTabsGroup: {
        flexDirection: "row",
        backgroundColor: "#E2E8F0",
        borderRadius: 8,
        padding: 2,
        alignSelf: "flex-start",
    },
    viewTabBtn: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    viewTabBtnActive: {
        backgroundColor: "#FFFFFF",
    },
    viewTabBtnText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#64748B",
    },
    viewTabBtnTextActive: {
        color: "#0F172A",
    },
    tableSection: {
        backgroundColor: "#FFFFFF",
        marginHorizontal: 16,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginBottom: 32,
    },
    tableHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        marginBottom: 16,
    },
    tableHeaderTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
    categoryBadgeText: { fontSize: 11, fontWeight: "700", color: "#059669", marginTop: 2 },
    studentCount: { fontSize: 11, color: "#64748B", fontWeight: "600" },
    tableContainer: { minWidth: 620 },
    tableHead: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
        paddingBottom: 10,
        marginBottom: 10,
        alignItems: "center",
    },
    headText: { fontSize: 10, fontWeight: "800", color: "#64748B", letterSpacing: 0.5 },
    headGreen: { color: "#15803D" },
    tableRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
        minHeight: 58,
    },
    rowFailed: {
        backgroundColor: "#FFF5F5",
    },
    studentNameCol: { width: 170 },
    studentColFlex: { flexDirection: "row", alignItems: "center", gap: 8 },
    avatarImg: { width: 32, height: 32, borderRadius: 16 },
    avatarCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    avatarLetter: { color: "#FFF", fontWeight: "bold", fontSize: 13 },
    studentTextContainer: { flex: 1 },
    studentNameText: { fontSize: 13, fontWeight: "700", color: "#1E293B" },
    studentLrnText: { fontSize: 9.5, color: "#64748B", marginTop: 1 },
    gradeCol: { width: 64, alignItems: "center", justifyContent: "center" },
    overallCol: { width: 74, alignItems: "center", justifyContent: "center" },
    remarksCol: { width: 130, alignItems: "center", justifyContent: "center" },
    actionCol: { width: 50, alignItems: "center", justifyContent: "center" },
    gradeInput: {
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 4,
        textAlign: "center",
        fontSize: 13,
        fontWeight: "700",
        color: "#1E293B",
        width: 52,
    },
    overallBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    overallText: { fontSize: 13, fontWeight: "800" },
    remarksBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
    remarksText: { fontSize: 10, fontWeight: "700" },
    bgGreen: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
    textGreen: { color: "#15803D" },
    bgRed: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
    textRed: { color: "#DC2626" },
    detailsBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: "#ECFDF5",
        alignItems: "center",
        justifyContent: "center",
    },
    saveButton: {
        backgroundColor: "#059669",
        flexDirection: "row",
        height: 48,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 18,
    },
    saveButtonText: { color: "#FFFFFF", fontWeight: "800", marginLeft: 8, fontSize: 14 },
    emptyContainer: { paddingVertical: 32, alignItems: "center" },
    emptyText: { color: "#94A3B8", fontSize: 13, marginTop: 8 },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContent: {
        backgroundColor: "#FFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: "60%",
    },
    gradeModalContent: {
        backgroundColor: "#FFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: "75%",
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    modalTitle: { fontSize: 17, fontWeight: "800", color: "#1E293B" },
    modalSub: { fontSize: 11, color: "#64748B", marginTop: 2, fontWeight: "500" },
    modalList: { flexGrow: 0 },
    modalOption: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    modalOptionSelected: { backgroundColor: "#F8FAFC", borderRadius: 8, paddingHorizontal: 10, borderBottomWidth: 0 },
    modalOptionText: { fontSize: 14, color: "#1E293B", fontWeight: "600" },
    modalOptionTextSelected: { color: Colors.light.primary, fontWeight: "800" },

    modalSummaryRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
    modalTile: {
        flex: 1,
        borderRadius: 12,
        padding: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    bgGreenLight: { backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#DCFCE7" },
    modalTileLabel: { fontSize: 10, fontWeight: "700", color: "#166534", textTransform: "uppercase" },
    modalTileValue: { fontSize: 20, fontWeight: "800", marginTop: 2 },

    modalSectionTitle: {
        fontSize: 12,
        fontWeight: "800",
        color: "#475569",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    modalQuarterRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
    modalQuarterBox: {
        flex: 1,
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 10,
        padding: 10,
        alignItems: "center",
    },
    modalQuarterLabel: { fontSize: 10, fontWeight: "800", color: "#059669" },
    modalQuarterVal: { fontSize: 16, fontWeight: "800", color: "#1E293B", marginTop: 2 },
    depedInfoCard: {
        backgroundColor: "#F0FDF4",
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: "#BBF7D0",
    },
    depedInfoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
    depedInfoTitle: { fontSize: 12, fontWeight: "800", color: "#065F46" },
    depedInfoDesc: { fontSize: 11, color: "#047857", lineHeight: 18, fontWeight: "500" },
});

