import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar } from "react-native";
import Colors from "../../src/constants/Colors";
import AppHeader from "../../src/components/common/AppHeader";
import { supabase } from "../../src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { getMyEnrollments, EnrollmentWithSubject } from "../../src/data/enrollments/get-my-enrollments";

function gradeToPoints(numericGrade: number): number {
    if (numericGrade >= 90) return 4.0;
    if (numericGrade >= 85) return 3.0;
    if (numericGrade >= 80) return 2.0;
    if (numericGrade >= 75) return 1.0;
    return 0.0;
}

function computeGPA(items: { grade: Record<string, any> | null; units: number }[]): string {
    const valid = items.filter(g => g.grade && g.grade.overall !== undefined && g.grade.overall > 0);
    if (valid.length === 0) return "N/A";
    const totalPoints = valid.reduce((sum, g) => sum + gradeToPoints(g.grade!.overall) * g.units, 0);
    const totalUnits = valid.reduce((sum, g) => sum + g.units, 0);
    if (totalUnits === 0) return "N/A";
    return (totalPoints / totalUnits).toFixed(2);
}

interface GradeItem {
    enrollmentId: string;
    subjectId: string;
    code: string;
    title: string;
    units: number;
    grade: Record<string, any> | null;
}

const DetailedGradeView = ({ grade, onBack }: { grade: GradeItem; onBack: () => void }) => {
    const gradePoints = grade.grade?.overall ? gradeToPoints(grade.grade.overall) : null;
    return (
        <View style={styles.detailedContainer}>
            <AppHeader title={grade.title} showBack={true} onBack={onBack} />
            <ScrollView contentContainerStyle={styles.detailedContent}>
                <View style={styles.detailHeader}>
                    <Text style={styles.subjectCode}>{grade.code}</Text>
                    <Text style={styles.subjectTitleLg}>{grade.title}</Text>
                    <Text style={styles.units}>{grade.units} units</Text>
                </View>

                <View style={styles.overallGradeCard}>
                    <Text style={styles.overallGradeLabel}>Overall Grade</Text>
                    <Text style={styles.overallGradeValue}>{grade.grade?.overall ?? "—"}</Text>
                    {gradePoints !== null && gradePoints >= 0 && (
                        <Text style={styles.gradePointsLabel}>{gradePoints.toFixed(1)} GPA Points</Text>
                    )}
                </View>

                {!grade.grade ? (
                    <View style={styles.noGradeCard}>
                        <Ionicons name="time-outline" size={36} color="#94A3B8" />
                        <Text style={styles.noGradeTitle}>Grade Not Yet Released</Text>
                        <Text style={styles.noGradeText}>
                            Your teacher has not submitted a grade for this subject yet.
                        </Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.infoCard}>
                            <Text style={styles.infoTitle}>Term Breakdown</Text>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Term 1 (T1)</Text>
                                <Text style={styles.infoValue}>{grade.grade?.t1 ?? "—"}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Term 2 (T2)</Text>
                                <Text style={styles.infoValue}>{grade.grade?.t2 ?? "—"}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Term 3 (T3)</Text>
                                <Text style={styles.infoValue}>{grade.grade?.t3 ?? "—"}</Text>
                            </View>
                        </View>

                        <View style={[styles.infoCard, { marginTop: 16 }]}>
                            <Text style={styles.infoTitle}>Assessment Breakdown</Text>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Quiz Average</Text>
                                <Text style={styles.infoValue}>{grade.grade?.quiz ?? "—"}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Activity Score</Text>
                                <Text style={styles.infoValue}>{grade.grade?.activity ?? "—"}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Assignment Score</Text>
                                <Text style={styles.infoValue}>{grade.grade?.assignment ?? "—"}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Exam Score</Text>
                                <Text style={styles.infoValue}>{grade.grade?.exam ?? "—"}</Text>
                            </View>
                            <View style={[styles.infoRow, { borderBottomWidth: 0, marginTop: 12 }]}>
                                <Text style={styles.infoLabel}>Remarks</Text>
                                <Text style={[styles.infoValue, { color: Colors.light.primary }]}>
                                    {grade.grade?.remarks ?? "No Remarks"}
                                </Text>
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
};

export default function GradesScreen() {
    const [selectedGrade, setSelectedGrade] = useState<GradeItem | null>(null);
    const [grades, setGrades] = useState<GradeItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchGrades();

        // Real-time: teacher gives/updates a grade → re-fetch
        const channel = supabase
            .channel('grades-realtime')
            .on(
                'postgres_changes',
                { event: "UPDATE", schema: "public", table: "teacher_student_grades" },
                () => {
                    fetchGrades();
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const getGradeRemarks = (grade: number) => {
        if (grade >= 90) return "Outstanding";
        if (grade >= 85) return "Excellent";
        if (grade >= 80) return "Very Good";
        if (grade >= 75) return "Good";
        return "Needs Improvement";
    };

    const fetchGrades = useCallback(async () => {
        try {
            setError(null);
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) return;

            const enrollments = await getMyEnrollments();
            const activeEnrollments = enrollments.filter(e => {
                const s = e.status.toLowerCase();
                return s === "accepted" || s === "approved" || s === "active";
            });

            if (activeEnrollments.length === 0) {
                setGrades([]);
                setIsLoading(false);
                return;
            }

            const { data: gradesData, error: gradesError } = await supabase
                .from('teacher_student_grades')
                .select('*')
                .eq('student_id', userData.user.id);

            const gradesMap = new Map();
            (gradesData || []).forEach(g => gradesMap.set(g.subject_id, g));

            const mapped: GradeItem[] = activeEnrollments.map(enrollment => {
                const sId = enrollment.subjects?.id;
                const dbGrade = sId ? gradesMap.get(sId) : null;
                
                return {
                    enrollmentId: enrollment.id,
                    subjectId: sId ?? "",
                    code: enrollment.subjects?.code ?? "N/A",
                    title: enrollment.subjects?.name ?? "Unknown Subject",
                    units: 3,
                    grade: dbGrade ? {
                        t1: dbGrade.term1_grade,
                        t2: dbGrade.term2_grade,
                        t3: dbGrade.term3_grade,
                        quiz: dbGrade.quiz_average,
                        activity: dbGrade.activity_grade,
                        assignment: dbGrade.assignment_grade,
                        exam: dbGrade.exam_grade,
                        overall: dbGrade.overall_grade,
                        remarks: getGradeRemarks(dbGrade.overall_grade),
                    } : null,
                };
            });

            setGrades(mapped);
        } catch (err: any) {
            console.warn("Failed to fetch grades:", err);
            setError(err?.message || "Failed to load grades.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    if (selectedGrade) {
        return <DetailedGradeView grade={selectedGrade} onBack={() => setSelectedGrade(null)} />;
    }

    const gpa = computeGPA(grades);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.light.forestGreen} />
            <AppHeader title="Grades" hasNotifications={true} />
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.header}>Academic Performance</Text>

                <View style={styles.gpaCard}>
                    <Text style={styles.gpaLabel}>Current GPA</Text>
                    {isLoading ? (
                        <ActivityIndicator color="#FFFFFF" size="large" style={{ marginVertical: 8 }} />
                    ) : (
                        <Text style={styles.gpaValue}>{gpa}</Text>
                    )}
                    <Text style={styles.gpaScale}>4.0 Scale</Text>
                </View>

                {isLoading ? (
                    <ActivityIndicator size="large" color={Colors.light.primary} style={{ marginTop: 24 }} />
                ) : error ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="cloud-offline-outline" size={56} color="#CBD5E1" />
                        <Text style={styles.emptyTitle}>Could Not Load Grades</Text>
                        <Text style={styles.emptyText}>{error}</Text>
                    </View>
                ) : grades.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="school-outline" size={56} color="#CBD5E1" />
                        <Text style={styles.emptyTitle}>No Grades Yet</Text>
                        <Text style={styles.emptyText}>
                            Your grades will appear here once{"\n"}a teacher submits them.
                        </Text>
                    </View>
                ) : (
                    grades.map((item) => (
                        <TouchableOpacity
                            key={item.enrollmentId}
                            style={styles.gradeItem}
                            onPress={() => setSelectedGrade(item)}
                        >
                            <View style={styles.gradeInfo}>
                                <Text style={styles.subjectCode}>{item.code}</Text>
                                <Text style={styles.subjectTitle}>{item.title}</Text>
                                <Text style={styles.units}>{item.units} units</Text>
                            </View>
                            <View style={[
                                styles.gradeBox,
                                item.grade
                                    ? { backgroundColor: Colors.light.primary + "15" }
                                    : { backgroundColor: "#F1F5F9" }
                            ]}>
                                <Text style={[
                                    styles.gradeText,
                                    !item.grade && { color: "#94A3B8", fontSize: 13 }
                                ]}>
                                    {item.grade?.overall ?? "—"}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    content: { padding: 16, paddingBottom: 40 },
    detailedContainer: { flex: 1, backgroundColor: "#F8FAFC" },
    detailedContent: { padding: 16, paddingBottom: 40 },
    detailHeader: { marginBottom: 24, alignItems: "center" },
    subjectTitleLg: {
        fontSize: 24, color: "#1E293B", fontWeight: "bold",
        marginVertical: 8, textAlign: "center",
    },
    header: { fontSize: 22, fontWeight: "bold", color: "#1E293B", marginBottom: 16 },
    gpaCard: {
        backgroundColor: Colors.light.primary, borderRadius: 16,
        padding: 24, alignItems: "center", marginBottom: 24,
    },
    gpaLabel: { fontSize: 14, color: "rgba(255,255,255,0.8)", marginBottom: 4 },
    gpaValue: { fontSize: 52, fontWeight: "bold", color: "#FFFFFF" },
    gpaScale: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 4 },
    gradeItem: {
        backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16,
        marginBottom: 12, flexDirection: "row", justifyContent: "space-between",
        alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
        borderWidth: 1, borderColor: "#F1F5F9",
    },
    gradeInfo: { flex: 1 },
    subjectCode: { fontSize: 12, color: Colors.light.primary, fontWeight: "600", marginBottom: 2 },
    subjectTitle: { fontSize: 16, color: "#1E293B", fontWeight: "600", marginVertical: 4 },
    units: { fontSize: 12, color: "#64748B" },
    gradeBox: {
        width: 52, height: 52, borderRadius: 12,
        justifyContent: "center", alignItems: "center", marginLeft: 12,
    },
    gradeText: { fontSize: 18, fontWeight: "bold", color: Colors.light.primary },
    overallGradeCard: {
        backgroundColor: Colors.light.primary, borderRadius: 16,
        padding: 28, alignItems: "center", marginBottom: 24,
    },
    overallGradeLabel: { fontSize: 16, color: "rgba(255,255,255,0.8)", marginBottom: 8 },
    overallGradeValue: { fontSize: 64, fontWeight: "bold", color: "#FFFFFF" },
    gradePointsLabel: { fontSize: 14, color: "rgba(255,255,255,0.75)", marginTop: 4 },
    infoCard: {
        backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20,
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
    },
    infoTitle: {
        fontSize: 18, fontWeight: "bold", color: "#1E293B", marginBottom: 16,
        borderBottomWidth: 1, borderBottomColor: "#F1F5F9", paddingBottom: 12,
    },
    infoRow: {
        flexDirection: "row", justifyContent: "space-between",
        paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#F1F5F9",
    },
    infoLabel: { fontSize: 15, color: "#64748B" },
    infoValue: { fontSize: 15, fontWeight: "bold", color: "#1E293B" },
    noGradeCard: {
        backgroundColor: "#FFFFFF", borderRadius: 16, padding: 32,
        alignItems: "center", borderWidth: 1, borderColor: "#F1F5F9",
    },
    noGradeTitle: {
        fontSize: 17, fontWeight: "bold", color: "#1E293B",
        marginTop: 12, marginBottom: 8,
    },
    noGradeText: { fontSize: 14, color: "#64748B", textAlign: "center", lineHeight: 22 },
    emptyContainer: {
        alignItems: "center", justifyContent: "center", paddingVertical: 40,
    },
    emptyTitle: {
        fontSize: 18, fontWeight: "bold", color: "#1E293B",
        marginTop: 16, marginBottom: 8,
    },
    emptyText: {
        fontSize: 14, color: "#64748B", textAlign: "center",
        lineHeight: 22, paddingHorizontal: 24,
    },
});
