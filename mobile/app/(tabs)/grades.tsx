import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
    Image,
    RefreshControl,
    Modal
} from "react-native";
import Colors from "../../src/constants/Colors";
import AppHeader from "../../src/components/common/AppHeader";
import { supabase } from "../../src/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { getMyEnrollments } from "../../src/data/enrollments/get-my-enrollments";
import { useFocusEffect } from "expo-router/react-navigation";
import {
    computeDepEdStudentComputation,
    normalizeSubjectCategory,
    getDepedCategorySettings,
    transmuteDepEdQuarterGrade,
    getGradeRemarks,
    roundTwo,
    DepedStudentComputation,
} from "../../src/lib/deped-grading";

interface StudentProfile {
    id: string;
    fullName: string;
    lrn: string;
    avatarUrl: string;
}

interface SubjectGradeRecord {
    enrollmentId: string;
    subjectId: string;
    code: string;
    title: string;
    section?: string;
    category: string;
    units: number;
    q1: number;
    q2: number;
    q3: number;
    q4: number;
    quiz: number;
    activity: number | string;
    assignment: number;
    exam: number;
    overall: number;
    completionPercent: number;
    submissionCount: number;
    totalAssessments: number;
    lastActivity: string;
    remarks: string;
    isPassed: boolean;
    computation: DepedStudentComputation | null;
}

type QuarterFilter = "all" | "term1" | "term2" | "term3" | "term4";

export default function GradesScreen() {
    const [grades, setGrades] = useState<SubjectGradeRecord[]>([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all");
    const [activeQuarter, setActiveQuarter] = useState<QuarterFilter>("term1");
    const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isBreakdownModalVisible, setIsBreakdownModalVisible] = useState(false);

    const fetchGrades = useCallback(async () => {
        try {
            setError(null);
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) {
                setIsLoading(false);
                return;
            }
            const userId = userData.user.id;

            // 1. Fetch student's profile (name, LRN, avatar)
            const { data: profileData } = await supabase
                .from("profiles")
                .select("id, first_name, middle_name, last_name, lrn, avatar_url")
                .eq("id", userId)
                .maybeSingle();

            if (profileData) {
                const fullName = [profileData.first_name, profileData.middle_name, profileData.last_name]
                    .map((p) => String(p || "").trim())
                    .filter(Boolean)
                    .join(" ") || "Student";

                setStudentProfile({
                    id: String(profileData.id),
                    fullName,
                    lrn: String(profileData.lrn || "N/A"),
                    avatarUrl: String(profileData.avatar_url || ""),
                });
            }

            // 2. Fetch student's active enrollments
            const enrollments = await getMyEnrollments();
            const activeEnrollments = enrollments.filter((e) => {
                const s = (e.status || "").toLowerCase();
                return s === "accepted" || s === "approved" || s === "active";
            });

            if (activeEnrollments.length === 0) {
                setGrades([]);
                setIsLoading(false);
                return;
            }

            const subjectIds = activeEnrollments
                .map((e) => e.subjects?.id)
                .filter((id): id is string => Boolean(id));

            // 3. Fetch grades from teacher_student_grades
            const { data: dbGradesData } = await supabase
                .from("teacher_student_grades")
                .select("*")
                .eq("student_id", userId);

            const dbGradesMap = new Map<string, any>();
            (dbGradesData || []).forEach((g) => dbGradesMap.set(g.subject_id, g));

            // 4. Fetch detailed grades from teacher_assessment_grades
            const { data: assessmentGradesData } = await supabase
                .from("teacher_assessment_grades")
                .select("*")
                .eq("student_id", userId);

            const assessmentGradesBySubject = new Map<string, any[]>();
            (assessmentGradesData || []).forEach((ag) => {
                const sId = String(ag.subject_id);
                const list = assessmentGradesBySubject.get(sId) || [];
                list.push(ag);
                assessmentGradesBySubject.set(sId, list);
            });

            // 5. Fetch submissions to calculate completion and last activity
            const { data: submissionsData } = await supabase
                .from("teacher_assessment_submissions")
                .select("id, subject_id, assessment_id, submitted_at")
                .eq("student_id", userId);

            const submissionsBySubject = new Map<string, any[]>();
            (submissionsData || []).forEach((sub) => {
                const sId = String(sub.subject_id);
                const existing = submissionsBySubject.get(sId) || [];
                existing.push(sub);
                submissionsBySubject.set(sId, existing);
            });

            // 6. Fetch assessments count per subject
            let assessmentsCountBySubject = new Map<string, number>();
            try {
                const { data: lessonsData } = await supabase
                    .from("lessons")
                    .select("id, subject_id")
                    .in("subject_id", subjectIds);

                if (lessonsData && lessonsData.length > 0) {
                    const lessonIds = lessonsData.map((l) => l.id);
                    const { data: assignmentsData } = await supabase
                        .from("assignments")
                        .select("id, lesson_id")
                        .in("lesson_id", lessonIds);

                    (assignmentsData || []).forEach((a) => {
                        const lesson = lessonsData.find((l) => l.id === a.lesson_id);
                        if (lesson?.subject_id) {
                            const current = assessmentsCountBySubject.get(lesson.subject_id) || 0;
                            assessmentsCountBySubject.set(lesson.subject_id, current + 1);
                        }
                    });
                }
            } catch (err) {
                console.warn("[Grades] Failed to fetch assessment counts:", err);
            }

            // 7. Map each subject enrollment to full grade record matching teacher table
            const mapped: SubjectGradeRecord[] = activeEnrollments.map((enrollment) => {
                const sId = enrollment.subjects?.id ?? "";
                const subjectName = enrollment.subjects?.name ?? "Unknown Subject";
                const subjectCode = enrollment.subjects?.code ?? "N/A";
                const dbGrade = sId ? dbGradesMap.get(sId) : null;
                const agList = sId ? assessmentGradesBySubject.get(sId) || [] : [];
                const subs = sId ? submissionsBySubject.get(sId) || [] : [];
                const totalAssessments = Math.max(
                    assessmentsCountBySubject.get(sId) || 0,
                    subs.length,
                    agList.length
                );

                let lastDate: Date | null = null;
                subs.forEach((s) => {
                    if (s.submitted_at) {
                        const d = new Date(s.submitted_at);
                        if (!lastDate || d > lastDate) lastDate = d;
                    }
                });

                const lastActivity = lastDate ? (lastDate as Date).toLocaleDateString() : "Never";
                const completionPercent = totalAssessments > 0
                    ? Math.round((subs.length / totalAssessments) * 100)
                    : (subs.length > 0 ? 100 : 0);

                const resolvedCategory = normalizeSubjectCategory(
                    (enrollment.subjects as any)?.subject_category || dbGrade?.subject_category,
                    subjectName || subjectCode
                );

                // Compute per-category assessment totals directly from teacher_assessment_grades
                const totals = {
                    quiz: { score: 0, max: 0, count: 0 },
                    activity: { score: 0, max: 0, count: 0 },
                    assignment: { score: 0, max: 0, count: 0 },
                    exam: { score: 0, max: 0, count: 0 },
                    all: { score: 0, max: 0, count: 0 },
                };

                // Prepare assessmentItems list for DepEd computation engine
                const assessmentItemsList: any[] = [];
                const assessmentGradesMap: Record<string, any> = {};

                agList.forEach((item) => {
                    const gradeVal = Number(item.grade_value || 0);
                    const maxPts = Math.max(1, Number(item.max_points || 100));
                    const rawType = String(item.assessment_type || item.assessment_title || "").toLowerCase();
                    const itemId = String(item.assessment_id || item.id || `ag-${Math.random()}`);

                    let category: "quiz" | "activity" | "assignment" | "exam" = "activity";
                    if (rawType.includes("quiz")) category = "quiz";
                    else if (rawType.includes("exam") || rawType.includes("test")) category = "exam";
                    else if (rawType.includes("assignment") || rawType.includes("homework")) category = "assignment";
                    else category = "activity";

                    totals[category].score += gradeVal;
                    totals[category].max += maxPts;
                    totals[category].count += 1;

                    totals.all.score += gradeVal;
                    totals.all.max += maxPts;
                    totals.all.count += 1;

                    assessmentItemsList.push({
                        id: itemId,
                        title: item.assessment_title || `${category.toUpperCase()} Assessment`,
                        type: category,
                        term: item.grading_term || "1st Quarter",
                        maxPoints: maxPts,
                        gradingComponent: item.grading_component || (category === "activity" ? "performanceTasks" : "writtenWorks"),
                    });

                    assessmentGradesMap[itemId] = {
                        [userId]: gradeVal,
                    };
                });

                const calcPercent = (score: number, max: number) => {
                    if (!max || max <= 0) return 0;
                    return Math.round((score / max) * 100);
                };

                const computedQuiz = calcPercent(totals.quiz.score, totals.quiz.max);
                const computedActivity = calcPercent(totals.activity.score, totals.activity.max);
                const computedAssignment = calcPercent(totals.assignment.score, totals.assignment.max);
                const computedExam = calcPercent(totals.exam.score, totals.exam.max);

                // Run DepEd Computation Engine
                let computation: DepedStudentComputation | null = null;
                try {
                    computation = computeDepEdStudentComputation({
                        assessmentItems: assessmentItemsList,
                        assessmentGradesMap,
                        studentId: userId,
                        subjectCategory: resolvedCategory,
                    });
                } catch (e) {
                    console.warn("[Grades] Failed running computeDepEdStudentComputation:", e);
                }

                // If teacher stored serialized computation in DB, use it as fallback
                if (!computation && dbGrade?.grade_computation) {
                    try {
                        computation = typeof dbGrade.grade_computation === "string"
                            ? JSON.parse(dbGrade.grade_computation)
                            : dbGrade.grade_computation;
                    } catch {
                        computation = null;
                    }
                }

                const quarterOne = computation?.quarters?.quarter1 || null;
                const fallbackWrittenWorks = quarterOne?.writtenWorks?.percentageScore ?? computedQuiz;
                const fallbackPerformanceTasks = quarterOne?.performanceTasks?.percentageScore ?? computedActivity;
                const fallbackInitialGrade = quarterOne?.initialGrade ?? 0;
                const fallbackQuarterlyGrade = quarterOne?.quarterlyGrade ?? (fallbackInitialGrade > 0 ? transmuteDepEdQuarterGrade(fallbackInitialGrade) : 0);

                const q1 = Number(dbGrade?.quarter1_grade || fallbackQuarterlyGrade || 0);
                const q2 = Number(dbGrade?.quarter2_grade || computation?.quarters?.quarter2?.quarterlyGrade || 0);
                const q3 = Number(dbGrade?.quarter3_grade || computation?.quarters?.quarter3?.quarterlyGrade || 0);
                const q4 = Number(dbGrade?.quarter4_grade || computation?.quarters?.quarter4?.quarterlyGrade || 0);

                const quiz = Number(dbGrade?.quiz_average || (computedQuiz > 0 ? computedQuiz : fallbackWrittenWorks));

                const rawActivity = dbGrade?.activity_grade;
                const activityVal = (rawActivity != null && Number(rawActivity) > 0)
                    ? Number(rawActivity)
                    : (computedActivity > 0
                        ? computedActivity
                        : (fallbackPerformanceTasks > 0 ? fallbackPerformanceTasks : (computedAssignment > 0 ? computedAssignment : 0)));

                const activity: number | string = activityVal > 0 ? activityVal : "Not yet graded";

                const assignment = Number(
                    dbGrade?.assignment_grade || (computedAssignment > 0 ? computedAssignment : (fallbackInitialGrade > 0 ? fallbackInitialGrade : 0))
                );

                const exam = Number(dbGrade?.exam_grade || computedExam || 0);

                // DepEd final grade calculation: average of non-zero quarters
                const gradedQuarters = [q1, q2, q3, q4].filter((q) => q > 0);
                const computedOverall = gradedQuarters.length > 0
                    ? Math.round(gradedQuarters.reduce((sum, val) => sum + val, 0) / gradedQuarters.length)
                    : (computation?.finalGrade || 0);

                const overall = Number(dbGrade?.overall_grade || computedOverall || 0);
                const isPassed = overall >= 75;
                const remarks = overall > 0 ? getGradeRemarks(overall) : "Needs Improvement";

                return {
                    enrollmentId: String(enrollment.id),
                    subjectId: sId,
                    code: subjectCode,
                    title: subjectName,
                    section: (enrollment.subjects as any)?.section ?? "Amethyst",
                    category: resolvedCategory,
                    units: 3,
                    q1,
                    q2,
                    q3,
                    q4,
                    quiz,
                    activity,
                    assignment,
                    exam,
                    overall,
                    completionPercent,
                    submissionCount: subs.length,
                    totalAssessments,
                    lastActivity,
                    remarks,
                    isPassed,
                    computation,
                };
            });

            setGrades(mapped);
        } catch (err: any) {
            console.warn("Failed to fetch student grades:", err);
            setError(err?.message || "Failed to load grades.");
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchGrades();
        }, [fetchGrades])
    );

    useEffect(() => {
        // Real-time listener: instantly reflect when teacher changes student grades or assessment grades
        const channel = supabase
            .channel("student-grades-realtime-sync")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "teacher_student_grades" },
                () => {
                    fetchGrades();
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "teacher_assessment_grades" },
                () => {
                    fetchGrades();
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "teacher_assessment_submissions" },
                () => {
                    fetchGrades();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchGrades]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchGrades();
    };

    const displayedGrades = useMemo(() => {
        if (selectedSubjectId === "all") return grades;
        return grades.filter((g) => g.subjectId === selectedSubjectId);
    }, [grades, selectedSubjectId]);

    const summaryRecord = useMemo(() => {
        if (selectedSubjectId !== "all") {
            const found = grades.find((g) => g.subjectId === selectedSubjectId);
            if (found) return found;
        }
        const withGrades = grades.find((g) => g.overall > 0 || g.q1 > 0);
        return withGrades || grades[0] || null;
    }, [grades, selectedSubjectId]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.light.forestGreen} />
            <AppHeader title="Grades" hasNotifications={true} />

            {isLoading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                    <Text style={styles.loadingText}>Loading your grades...</Text>
                </View>
            ) : error ? (
                <ScrollView
                    contentContainerStyle={styles.centerContainer}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                >
                    <Ionicons name="cloud-offline-outline" size={56} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>Could Not Load Grades</Text>
                    <Text style={styles.emptySubtitle}>{error}</Text>
                </ScrollView>
            ) : grades.length === 0 ? (
                <ScrollView
                    contentContainerStyle={styles.centerContainer}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                >
                    <Ionicons name="school-outline" size={56} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>No Grades Available</Text>
                    <Text style={styles.emptySubtitle}>
                        Your grades will appear here once your teacher enters and saves them.
                    </Text>
                </ScrollView>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.contentContainer}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.light.primary]} />}
                >
                    {/* Enrolled Subjects Horizontal Pills */}
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeading}>Enrolled Subjects</Text>
                        <Text style={styles.sectionSubCount}>{grades.length} {grades.length === 1 ? "Subject" : "Subjects"}</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContainer}>
                        {/* All Subjects Pill */}
                        <TouchableOpacity
                            style={[styles.subjectPill, selectedSubjectId === "all" && styles.subjectPillActive]}
                            onPress={() => setSelectedSubjectId("all")}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.subjectCode, selectedSubjectId === "all" && styles.subjectCodeActive]} numberOfLines={1}>
                                ALL
                            </Text>
                            <Text style={[styles.subjectTitle, selectedSubjectId === "all" && styles.subjectTitleActive]} numberOfLines={1}>
                                All Subjects
                            </Text>
                        </TouchableOpacity>

                        {/* Individual Subject Pills */}
                        {grades.map((item) => {
                            const isSelected = item.subjectId === selectedSubjectId;
                            return (
                                <TouchableOpacity
                                    key={item.enrollmentId}
                                    style={[styles.subjectPill, isSelected && styles.subjectPillActive]}
                                    onPress={() => setSelectedSubjectId(item.subjectId)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.subjectCode, isSelected && styles.subjectCodeActive]} numberOfLines={1}>
                                        {item.code}
                                    </Text>
                                    <Text style={[styles.subjectTitle, isSelected && styles.subjectTitleActive]} numberOfLines={1}>
                                        {item.title}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Quarter Filter Pills matching web teacher interface */}
                    <View style={styles.quarterFilterContainer}>
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
                    </View>

                    {/* Active Subject Banner */}
                    <View style={styles.subjectBanner}>
                        <View style={styles.subjectBannerIcon}>
                            <Ionicons name="book-outline" size={20} color={Colors.light.primary} />
                        </View>
                        <View style={styles.subjectBannerTextContainer}>
                            <Text style={styles.subjectBannerCode} numberOfLines={1}>
                                {selectedSubjectId === "all" ? "ALL ENROLLED CLASSES" : summaryRecord?.code}
                            </Text>
                            <Text style={styles.subjectBannerName} numberOfLines={1}>
                                {selectedSubjectId === "all" ? "Full Gradebook Overview" : `${summaryRecord?.title} (${summaryRecord?.section || "Amethyst"})`}
                            </Text>
                        </View>
                        {summaryRecord?.overall !== undefined && summaryRecord.overall > 0 && (
                            <View style={[styles.miniBadge, summaryRecord.isPassed ? styles.miniBadgePass : styles.miniBadgeFail]}>
                                <Text style={[styles.miniBadgeText, summaryRecord.isPassed ? styles.miniBadgeTextPass : styles.miniBadgeTextFail]}>
                                    {summaryRecord.overall}%
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Table View matching web teacher table */}
                    <View style={styles.tableCard}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={true}
                            contentContainerStyle={styles.tableScrollInner}
                        >
                            <View>
                                {/* Table Header */}
                                <View style={styles.tableHeaderRow}>
                                    <View style={[styles.thCell, styles.studentCol]}>
                                        <Text style={styles.thTitle} numberOfLines={1}>STUDENT</Text>
                                    </View>

                                    {/* Conditional Quarters */}
                                    {(activeQuarter === "all" || activeQuarter === "term1") && (
                                        <View style={[styles.thCell, styles.quarterCol, styles.bgGreen]}>
                                            <Text style={[styles.thTitle, styles.colorGreen]} numberOfLines={1}>Q1</Text>
                                            <Text style={styles.thSub} numberOfLines={1}>1st Quarter</Text>
                                        </View>
                                    )}
                                    {(activeQuarter === "all" || activeQuarter === "term2") && (
                                        <View style={[styles.thCell, styles.quarterCol, styles.bgGreen]}>
                                            <Text style={[styles.thTitle, styles.colorGreen]} numberOfLines={1}>Q2</Text>
                                            <Text style={styles.thSub} numberOfLines={1}>2nd Quarter</Text>
                                        </View>
                                    )}
                                    {(activeQuarter === "all" || activeQuarter === "term3") && (
                                        <View style={[styles.thCell, styles.quarterCol, styles.bgGreen]}>
                                            <Text style={[styles.thTitle, styles.colorGreen]} numberOfLines={1}>Q3</Text>
                                            <Text style={styles.thSub} numberOfLines={1}>3rd Quarter</Text>
                                        </View>
                                    )}
                                    {(activeQuarter === "all" || activeQuarter === "term4") && (
                                        <View style={[styles.thCell, styles.quarterCol, styles.bgGreen]}>
                                            <Text style={[styles.thTitle, styles.colorGreen]} numberOfLines={1}>Q4</Text>
                                            <Text style={styles.thSub} numberOfLines={1}>4th Quarter</Text>
                                        </View>
                                    )}

                                    {/* QUIZ (Avg 0-100) */}
                                    <View style={[styles.thCell, styles.quizCol, styles.bgViolet]}>
                                        <Text style={[styles.thTitle, styles.colorViolet]} numberOfLines={1}>QUIZ</Text>
                                        <Text style={styles.thSub} numberOfLines={1}>Avg (0-100)</Text>
                                    </View>

                                    {/* ACTIVITY (Score 0-100) */}
                                    <View style={[styles.thCell, styles.activityCol, styles.bgOrange]}>
                                        <Text style={[styles.thTitle, styles.colorOrange]} numberOfLines={1}>ACTIVITY</Text>
                                        <Text style={styles.thSub} numberOfLines={1}>Score (0-100)</Text>
                                    </View>

                                    {/* ASSIGNMENT (Score 0-100) */}
                                    <View style={[styles.thCell, styles.assignmentCol, styles.bgSky]}>
                                        <Text style={[styles.thTitle, styles.colorSky]} numberOfLines={1}>ASSIGNMENT</Text>
                                        <Text style={styles.thSub} numberOfLines={1}>Score (0-100)</Text>
                                    </View>

                                    {/* EXAM (Score 0-100) */}
                                    <View style={[styles.thCell, styles.examCol, styles.bgRed]}>
                                        <Text style={[styles.thTitle, styles.colorRed]} numberOfLines={1}>EXAM</Text>
                                        <Text style={styles.thSub} numberOfLines={1}>Score (0-100)</Text>
                                    </View>

                                    {/* OVERALL */}
                                    <View style={[styles.thCell, styles.overallCol]}>
                                        <Text style={styles.thTitle} numberOfLines={1}>OVERALL</Text>
                                    </View>

                                    {/* COMPLETION */}
                                    <View style={[styles.thCell, styles.completionCol]}>
                                        <Text style={styles.thTitle} numberOfLines={1}>COMPLETION</Text>
                                    </View>

                                    {/* LAST ACTIVITY */}
                                    <View style={[styles.thCell, styles.lastActivityCol]}>
                                        <Text style={styles.thTitle} numberOfLines={1}>LAST ACTIVITY</Text>
                                    </View>

                                    {/* REMARKS */}
                                    <View style={[styles.thCell, styles.remarksCol]}>
                                        <Text style={styles.thTitle} numberOfLines={1}>REMARKS</Text>
                                    </View>
                                </View>

                                {/* Table Body Rows */}
                                {displayedGrades.map((item) => {
                                    const avatarLetter = (studentProfile?.fullName || item.title).charAt(0).toUpperCase();
                                    const isRowFail = !item.isPassed;

                                    return (
                                        <View
                                            key={item.enrollmentId}
                                            style={[
                                                styles.tableBodyRow,
                                                isRowFail ? styles.rowFailed : styles.rowPassed
                                            ]}
                                        >
                                            {/* STUDENT COLUMN */}
                                            <View style={[styles.tdCell, styles.studentCol]}>
                                                <View style={styles.studentInfoRow}>
                                                    {studentProfile?.avatarUrl ? (
                                                        <Image
                                                            source={{ uri: studentProfile.avatarUrl }}
                                                            style={styles.avatarImg}
                                                        />
                                                    ) : (
                                                        <View style={[styles.avatarCircle, { backgroundColor: item.isPassed ? "#16A34A" : "#DC2626" }]}>
                                                            <Text style={styles.avatarLetter}>{avatarLetter}</Text>
                                                        </View>
                                                    )}
                                                    <View style={styles.studentNameContainer}>
                                                        <Text style={styles.studentNameText} numberOfLines={1}>
                                                            {studentProfile?.fullName || "Student"}
                                                        </Text>
                                                        <Text style={styles.studentLrnText} numberOfLines={1}>
                                                            {studentProfile?.lrn || "123456789111"}
                                                        </Text>
                                                        {selectedSubjectId === "all" && (
                                                            <Text style={styles.studentSubjectTag} numberOfLines={1}>
                                                                {item.code} - {item.title}
                                                            </Text>
                                                        )}
                                                    </View>
                                                </View>
                                            </View>

                                            {/* Q1 */}
                                            {(activeQuarter === "all" || activeQuarter === "term1") && (
                                                <View style={[styles.tdCell, styles.quarterCol, styles.bgCellGreen]}>
                                                    <View style={styles.quarterBox}>
                                                        <Text style={styles.quarterScoreText}>{item.q1}</Text>
                                                    </View>
                                                </View>
                                            )}

                                            {/* Q2 */}
                                            {(activeQuarter === "all" || activeQuarter === "term2") && (
                                                <View style={[styles.tdCell, styles.quarterCol, styles.bgCellGreen]}>
                                                    <View style={styles.quarterBox}>
                                                        <Text style={styles.quarterScoreText}>{item.q2}</Text>
                                                    </View>
                                                </View>
                                            )}

                                            {/* Q3 */}
                                            {(activeQuarter === "all" || activeQuarter === "term3") && (
                                                <View style={[styles.tdCell, styles.quarterCol, styles.bgCellGreen]}>
                                                    <View style={styles.quarterBox}>
                                                        <Text style={styles.quarterScoreText}>{item.q3}</Text>
                                                    </View>
                                                </View>
                                            )}

                                            {/* Q4 */}
                                            {(activeQuarter === "all" || activeQuarter === "term4") && (
                                                <View style={[styles.tdCell, styles.quarterCol, styles.bgCellGreen]}>
                                                    <View style={styles.quarterBox}>
                                                        <Text style={styles.quarterScoreText}>{item.q4}</Text>
                                                    </View>
                                                </View>
                                            )}

                                            {/* QUIZ */}
                                            <View style={[styles.tdCell, styles.quizCol, styles.bgCellViolet]}>
                                                <Text style={styles.quizText}>{item.quiz}</Text>
                                            </View>

                                            {/* ACTIVITY */}
                                            <View style={[styles.tdCell, styles.activityCol, styles.bgCellOrange]}>
                                                <Text
                                                    style={[
                                                        styles.activityText,
                                                        typeof item.activity === "string" && styles.textNotGraded
                                                    ]}
                                                    numberOfLines={1}
                                                >
                                                    {item.activity}
                                                </Text>
                                            </View>

                                            {/* ASSIGNMENT */}
                                            <View style={[styles.tdCell, styles.assignmentCol, styles.bgCellSky]}>
                                                <Text style={styles.assignmentText}>{item.assignment}</Text>
                                            </View>

                                            {/* EXAM */}
                                            <View style={[styles.tdCell, styles.examCol, styles.bgCellRed]}>
                                                <Text style={styles.examText}>{item.exam}</Text>
                                            </View>

                                            {/* OVERALL */}
                                            <View style={[styles.tdCell, styles.overallCol]}>
                                                <View
                                                    style={[
                                                        styles.overallBadge,
                                                        { backgroundColor: item.isPassed ? "#DCFCE7" : "#FEE2E2" }
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.overallText,
                                                            { color: item.isPassed ? "#15803D" : "#B91C1C" }
                                                        ]}
                                                    >
                                                        {item.overall}%
                                                    </Text>
                                                </View>
                                            </View>

                                            {/* COMPLETION */}
                                            <View style={[styles.tdCell, styles.completionCol]}>
                                                <Text style={styles.completionText}>
                                                    {item.completionPercent}%{" "}
                                                    <Text style={styles.completionRatio}>
                                                        ({item.submissionCount}/{item.totalAssessments})
                                                    </Text>
                                                </Text>
                                            </View>

                                            {/* LAST ACTIVITY */}
                                            <View style={[styles.tdCell, styles.lastActivityCol]}>
                                                <Text style={styles.lastActivityText} numberOfLines={1}>{item.lastActivity}</Text>
                                            </View>

                                            {/* REMARKS */}
                                            <View style={[styles.tdCell, styles.remarksCol]}>
                                                <View
                                                    style={[
                                                        styles.remarksBadge,
                                                        {
                                                            backgroundColor: item.isPassed ? "#F0FDF4" : "#FEF2F2",
                                                            borderColor: item.isPassed ? "#BBF7D0" : "#FECACA",
                                                        }
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.remarksText,
                                                            { color: item.isPassed ? "#15803D" : "#DC2626" }
                                                        ]}
                                                        numberOfLines={1}
                                                    >
                                                        {item.remarks}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </View>

                    {/* Detailed Summary Cards Below Table */}
                    {summaryRecord && (
                        <View style={styles.summaryContainer}>
                            <View style={styles.summaryHeaderRow}>
                                <Text style={styles.summaryTitle}>
                                    Grade Breakdown Summary {selectedSubjectId !== "all" ? `(${summaryRecord.code})` : ""}
                                </Text>
                            </View>

                            {/* Row 1: Quarterly Grades */}
                            <Text style={styles.subCategoryHeading}>Quarterly Grades</Text>
                            <View style={styles.quarterGridRow}>
                                <View style={[styles.summaryTile, styles.bgGreenLight]}>
                                    <Text style={[styles.summaryTileLabel, { color: "#166534" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>1st Quarter</Text>
                                    <Text style={[styles.summaryTileValue, { color: "#15803D" }]} numberOfLines={1} adjustsFontSizeToFit>{summaryRecord.q1}</Text>
                                </View>
                                <View style={[styles.summaryTile, styles.bgGreenLight]}>
                                    <Text style={[styles.summaryTileLabel, { color: "#166534" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>2nd Quarter</Text>
                                    <Text style={[styles.summaryTileValue, { color: "#15803D" }]} numberOfLines={1} adjustsFontSizeToFit>{summaryRecord.q2}</Text>
                                </View>
                                <View style={[styles.summaryTile, styles.bgGreenLight]}>
                                    <Text style={[styles.summaryTileLabel, { color: "#166534" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>3rd Quarter</Text>
                                    <Text style={[styles.summaryTileValue, { color: "#15803D" }]} numberOfLines={1} adjustsFontSizeToFit>{summaryRecord.q3}</Text>
                                </View>
                                <View style={[styles.summaryTile, styles.bgGreenLight]}>
                                    <Text style={[styles.summaryTileLabel, { color: "#166534" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>4th Quarter</Text>
                                    <Text style={[styles.summaryTileValue, { color: "#15803D" }]} numberOfLines={1} adjustsFontSizeToFit>{summaryRecord.q4}</Text>
                                </View>
                            </View>

                            {/* Row 2: Assessment Types */}
                            <Text style={styles.subCategoryHeading}>Assessment Breakdown</Text>
                            <View style={styles.assessmentGridRow}>
                                <View style={[styles.summaryTile, styles.bgVioletLight]}>
                                    <Text style={[styles.summaryTileLabel, { color: "#6D28D9" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Quiz Avg</Text>
                                    <Text style={[styles.summaryTileValue, { color: "#7C3AED" }]} numberOfLines={1} adjustsFontSizeToFit>{summaryRecord.quiz}</Text>
                                </View>
                                <View style={[styles.summaryTile, styles.bgOrangeLight]}>
                                    <Text style={[styles.summaryTileLabel, { color: "#C2410C" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Activity</Text>
                                    <Text
                                        style={[
                                            styles.summaryTileValue,
                                            { color: "#EA580C" },
                                            typeof summaryRecord.activity === "string" && { fontSize: 11, color: "#94A3B8" }
                                        ]}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                    >
                                        {summaryRecord.activity}
                                    </Text>
                                </View>
                                <View style={[styles.summaryTile, styles.bgSkyLight]}>
                                    <Text style={[styles.summaryTileLabel, { color: "#0369A1" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Assignment</Text>
                                    <Text style={[styles.summaryTileValue, { color: "#0284C7" }]} numberOfLines={1} adjustsFontSizeToFit>{summaryRecord.assignment}</Text>
                                </View>
                                <View style={[styles.summaryTile, styles.bgRedLight]}>
                                    <Text style={[styles.summaryTileLabel, { color: "#B91C1C" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Exam</Text>
                                    <Text style={[styles.summaryTileValue, { color: "#DC2626" }]} numberOfLines={1} adjustsFontSizeToFit>{summaryRecord.exam}</Text>
                                </View>
                            </View>

                            {/* Row 3: Overall & Performance */}
                            <Text style={styles.subCategoryHeading}>Overall Performance</Text>
                            <View style={styles.performanceGridRow}>
                                <View style={[styles.summaryTile, summaryRecord.isPassed ? styles.bgGreenLight : styles.bgRedLight]}>
                                    <Text style={[styles.summaryTileLabel, { color: summaryRecord.isPassed ? "#166534" : "#B91C1C" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                                        Overall Grade
                                    </Text>
                                    <Text style={[styles.summaryTileValue, { color: summaryRecord.isPassed ? "#15803D" : "#DC2626" }]} numberOfLines={1} adjustsFontSizeToFit>
                                        {summaryRecord.overall}%
                                    </Text>
                                </View>
                                <View style={[styles.summaryTile, styles.bgNeutralLight]}>
                                    <Text style={[styles.summaryTileLabel, { color: "#334155" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Completion</Text>
                                    <Text style={[styles.summaryTileValue, { color: "#0F172A", fontSize: 16 }]} numberOfLines={1} adjustsFontSizeToFit>
                                        {summaryRecord.completionPercent}%
                                    </Text>
                                    <Text style={{ fontSize: 9.5, color: "#64748B", marginTop: 2, textAlign: "center" }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                                        ({summaryRecord.submissionCount}/{summaryRecord.totalAssessments} Submitted)
                                    </Text>
                                </View>
                                <View style={[styles.summaryTile, styles.bgNeutralLight]}>
                                    <Text style={[styles.summaryTileLabel, { color: "#334155" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Remarks</Text>
                                    <View
                                        style={[
                                            styles.summaryRemarksBadge,
                                            {
                                                backgroundColor: summaryRecord.isPassed ? "#DCFCE7" : "#FEE2E2",
                                                borderColor: summaryRecord.isPassed ? "#86EFAC" : "#FCA5A5",
                                            }
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.summaryRemarksText,
                                                { color: summaryRecord.isPassed ? "#15803D" : "#DC2626" }
                                            ]}
                                            numberOfLines={2}
                                            adjustsFontSizeToFit
                                            minimumFontScale={0.75}
                                        >
                                            {summaryRecord.remarks}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* View DepEd Breakdown Button */}
                            <TouchableOpacity
                                style={styles.depedBreakdownBtn}
                                activeOpacity={0.8}
                                onPress={() => setIsBreakdownModalVisible(true)}
                            >
                                <Ionicons name="calculator-outline" size={18} color="#059669" />
                                <Text style={styles.depedBreakdownBtnText}>View DepEd Grading Breakdown</Text>
                                <Ionicons name="chevron-forward" size={16} color="#059669" />
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={{ height: 32 }} />
                </ScrollView>
            )}

            {/* DepEd Grade Computation Modal */}
            <Modal
                visible={isBreakdownModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setIsBreakdownModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.breakdownModalContent}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>DepEd Grade Breakdown</Text>
                                <Text style={styles.modalSubtitle} numberOfLines={1}>
                                    {summaryRecord?.code} - {summaryRecord?.title} ({summaryRecord?.category})
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsBreakdownModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                            {/* Summary Badge Cards */}
                            <View style={styles.modalSummaryRow}>
                                <View style={[styles.modalSummaryTile, styles.bgGreenLight]}>
                                    <Text style={styles.modalTileLabel}>Final Grade</Text>
                                    <Text style={[styles.modalTileValue, { color: "#15803D" }]}>
                                        {summaryRecord?.overall}%
                                    </Text>
                                </View>
                                <View style={[styles.modalSummaryTile, styles.bgGreenLight]}>
                                    <Text style={styles.modalTileLabel}>Remarks</Text>
                                    <Text
                                        style={[
                                            styles.modalTileValue,
                                            { color: summaryRecord?.isPassed ? "#15803D" : "#DC2626", fontSize: 14 }
                                        ]}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                    >
                                        {summaryRecord?.remarks}
                                    </Text>
                                </View>
                            </View>

                            {/* Category Weights Notice */}
                            {summaryRecord && (
                                <View style={styles.categoryWeightsCard}>
                                    <Text style={styles.categoryWeightsTitle}>
                                        Subject Category: {summaryRecord.category}
                                    </Text>
                                    <View style={styles.weightsPillsRow}>
                                        <View style={styles.weightPill}>
                                            <Text style={styles.weightPillLabel}>Written Works</Text>
                                            <Text style={styles.weightPillVal}>
                                                {getDepedCategorySettings(summaryRecord.category).writtenWorksWeight}%
                                            </Text>
                                        </View>
                                        <View style={styles.weightPill}>
                                            <Text style={styles.weightPillLabel}>Performance Tasks</Text>
                                            <Text style={styles.weightPillVal}>
                                                {getDepedCategorySettings(summaryRecord.category).performanceTasksWeight}%
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* Step-by-Step Quarters Breakdown */}
                            <Text style={styles.modalSectionTitle}>Quarterly Step-by-Step Breakdown</Text>
                            {[1, 2, 3, 4].map((qNum) => {
                                const qKey = `quarter${qNum}` as "quarter1" | "quarter2" | "quarter3" | "quarter4";
                                const qSummary = summaryRecord?.computation?.quarters?.[qKey];
                                const quarterlyGrade = qNum === 1
                                    ? summaryRecord?.q1
                                    : qNum === 2
                                    ? summaryRecord?.q2
                                    : qNum === 3
                                    ? summaryRecord?.q3
                                    : summaryRecord?.q4;

                                const ww = qSummary?.writtenWorks;
                                const pt = qSummary?.performanceTasks;
                                const initGrade = qSummary?.initialGrade || 0;

                                return (
                                    <View key={qNum} style={styles.quarterBreakdownCard}>
                                        <View style={styles.quarterBreakdownHeader}>
                                            <Text style={styles.quarterBreakdownTitle}>Quarter {qNum}</Text>
                                            <View style={[styles.quarterBadge, (quarterlyGrade || 0) >= 75 ? styles.bgGreenLight : styles.bgRedLight]}>
                                                <Text style={[styles.quarterBadgeText, { color: (quarterlyGrade || 0) >= 75 ? "#15803D" : "#DC2626" }]}>
                                                    Quarterly Grade: {quarterlyGrade || 0}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Component Rows */}
                                        <View style={styles.compRow}>
                                            <Text style={styles.compLabel}>Written Works (WW):</Text>
                                            <Text style={styles.compValue}>
                                                Raw: {ww?.rawScore || 0} / {ww?.highestScore || 0} ({ww?.percentageScore || 0}%) • WS: {ww?.weightedScore || 0}
                                            </Text>
                                        </View>
                                        <View style={styles.compRow}>
                                            <Text style={styles.compLabel}>Performance Tasks (PT):</Text>
                                            <Text style={styles.compValue}>
                                                Raw: {pt?.rawScore || 0} / {pt?.highestScore || 0} ({pt?.percentageScore || 0}%) • WS: {pt?.weightedScore || 0}
                                            </Text>
                                        </View>
                                        <View style={styles.compRowHighlight}>
                                            <Text style={styles.compLabelHighlight}>Initial Grade (WW WS + PT WS):</Text>
                                            <Text style={styles.compValueHighlight}>{initGrade}</Text>
                                        </View>
                                        <View style={styles.compRowHighlight}>
                                            <Text style={styles.compLabelHighlight}>Transmuted Grade (37.5 + Initial × 0.625):</Text>
                                            <Text style={[styles.compValueHighlight, { color: "#15803D" }]}>{quarterlyGrade || 0}</Text>
                                        </View>
                                    </View>
                                );
                            })}

                            {/* Official DepEd Process Note */}
                            <View style={styles.depedInfoCard}>
                                <View style={styles.depedInfoRow}>
                                    <Ionicons name="information-circle-outline" size={18} color="#059669" />
                                    <Text style={styles.depedInfoTitle}>DepEd K-12 Grading Process</Text>
                                </View>
                                <Text style={styles.depedInfoDesc}>
                                    1. Step 1: Sum raw scores for Written Works and Performance Tasks.{"\n"}
                                    2. Step 2: Percentage Score (PS) = (Raw Score / Highest Score) × 100%.{"\n"}
                                    3. Step 3: Weighted Score (WS) = PS × Component Weight.{"\n"}
                                    4. Step 4: Initial Grade = Written Works WS + Performance Tasks WS.{"\n"}
                                    5. Step 5: Quarterly Grade = Transmuted Initial Grade (Min Passing = 75).{"\n"}
                                    6. Step 6: Final Grade = Average of quarterly grades across graded quarters.
                                </Text>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: "#64748B",
        fontWeight: "500",
    },
    centerContainer: {
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#1E293B",
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: "#64748B",
        textAlign: "center",
        marginTop: 8,
        lineHeight: 20,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 40,
    },
    sectionHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    sectionHeading: {
        fontSize: 13,
        fontWeight: "800",
        color: "#334155",
        textTransform: "uppercase",
        letterSpacing: 0.6,
    },
    sectionSubCount: {
        fontSize: 12,
        fontWeight: "600",
        color: "#94A3B8",
    },
    pillsContainer: {
        flexDirection: "row",
        gap: 8,
        paddingBottom: 14,
    },
    subjectPill: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderWidth: 1.5,
        borderColor: "#E2E8F0",
        minWidth: 100,
        alignItems: "center",
        justifyContent: "center",
    },
    subjectPillActive: {
        borderColor: "#059669",
        backgroundColor: "#ECFDF5",
    },
    subjectCode: {
        fontSize: 12,
        fontWeight: "800",
        color: "#475569",
    },
    subjectCodeActive: {
        color: "#059669",
    },
    subjectTitle: {
        fontSize: 12,
        fontWeight: "700",
        color: "#1E293B",
        marginTop: 2,
    },
    subjectTitleActive: {
        color: "#047857",
    },
    quarterFilterContainer: {
        marginBottom: 12,
    },
    quarterTabsGroup: {
        flexDirection: "row",
        backgroundColor: "#E2E8F0",
        borderRadius: 10,
        padding: 3,
        alignSelf: "flex-start",
    },
    quarterTabBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    quarterTabBtnActive: {
        backgroundColor: "#059669",
    },
    quarterTabBtnText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#475569",
    },
    quarterTabBtnTextActive: {
        color: "#FFFFFF",
    },
    subjectBanner: {
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        gap: 12,
    },
    subjectBannerIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: "#ECFDF5",
        alignItems: "center",
        justifyContent: "center",
    },
    subjectBannerTextContainer: {
        flex: 1,
    },
    subjectBannerCode: {
        fontSize: 11,
        fontWeight: "800",
        color: "#059669",
        letterSpacing: 0.5,
    },
    subjectBannerName: {
        fontSize: 15,
        fontWeight: "800",
        color: "#0F172A",
        marginTop: 1,
    },
    miniBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    miniBadgePass: {
        backgroundColor: "#DCFCE7",
    },
    miniBadgeFail: {
        backgroundColor: "#FEE2E2",
    },
    miniBadgeText: {
        fontSize: 12,
        fontWeight: "800",
    },
    miniBadgeTextPass: {
        color: "#166534",
    },
    miniBadgeTextFail: {
        color: "#991B1B",
    },
    tableCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        overflow: "hidden",
        marginBottom: 20,
    },
    tableScrollInner: {
        flexDirection: "column",
    },
    tableHeaderRow: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
        height: 54,
    },
    thCell: {
        paddingVertical: 8,
        paddingHorizontal: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    thTitle: {
        fontSize: 11,
        fontWeight: "800",
        color: "#64748B",
        letterSpacing: 0.5,
        textAlign: "center",
    },
    thSub: {
        fontSize: 9,
        fontWeight: "500",
        color: "#94A3B8",
        marginTop: 2,
        textAlign: "center",
    },
    studentCol: {
        width: 190,
        alignItems: "flex-start",
        paddingLeft: 14,
    },
    quarterCol: {
        width: 85,
    },
    quizCol: {
        width: 110,
    },
    activityCol: {
        width: 130,
    },
    assignmentCol: {
        width: 135,
    },
    examCol: {
        width: 110,
    },
    overallCol: {
        width: 100,
    },
    completionCol: {
        width: 120,
    },
    lastActivityCol: {
        width: 115,
    },
    remarksCol: {
        width: 155,
    },
    colorGreen: {
        color: "#15803D",
    },
    colorViolet: {
        color: "#7C3AED",
    },
    colorOrange: {
        color: "#EA580C",
    },
    colorSky: {
        color: "#0284C7",
    },
    colorRed: {
        color: "#DC2626",
    },
    bgGreen: {
        backgroundColor: "#F0FDF4",
    },
    bgViolet: {
        backgroundColor: "#F5F3FF",
    },
    bgOrange: {
        backgroundColor: "#FFF7ED",
    },
    bgSky: {
        backgroundColor: "#F0F9FF",
    },
    bgRed: {
        backgroundColor: "#FEF2F2",
    },
    bgCellGreen: {
        backgroundColor: "#F0FDF430",
    },
    bgCellViolet: {
        backgroundColor: "#F5F3FF30",
    },
    bgCellOrange: {
        backgroundColor: "#FFF7ED30",
    },
    bgCellSky: {
        backgroundColor: "#F0F9FF30",
    },
    bgCellRed: {
        backgroundColor: "#FEF2F230",
    },
    tableBodyRow: {
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
        minHeight: 68,
    },
    rowPassed: {
        backgroundColor: "#FFFFFF",
    },
    rowFailed: {
        backgroundColor: "#FFF5F5",
    },
    tdCell: {
        paddingVertical: 12,
        paddingHorizontal: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    studentInfoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    avatarImg: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    avatarCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarLetter: {
        color: "#FFFFFF",
        fontWeight: "bold",
        fontSize: 16,
    },
    studentNameContainer: {
        flex: 1,
    },
    studentNameText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#1E293B",
    },
    studentLrnText: {
        fontSize: 10,
        color: "#64748B",
        marginTop: 1,
    },
    studentSubjectTag: {
        fontSize: 10,
        fontWeight: "700",
        color: "#059669",
        marginTop: 2,
    },
    quarterBox: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#86EFAC",
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        minWidth: 44,
    },
    quarterScoreText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#14532D",
    },
    quizText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#7C3AED",
    },
    activityText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#EA580C",
    },
    textNotGraded: {
        color: "#94A3B8",
        fontWeight: "500",
        fontSize: 11,
    },
    assignmentText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#0284C7",
    },
    examText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#DC2626",
    },
    overallBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
    },
    overallText: {
        fontSize: 14,
        fontWeight: "800",
    },
    completionText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#1E293B",
    },
    completionRatio: {
        fontSize: 10,
        color: "#64748B",
        fontWeight: "500",
    },
    lastActivityText: {
        fontSize: 12,
        color: "#64748B",
        fontWeight: "500",
    },
    remarksBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    remarksText: {
        fontSize: 11,
        fontWeight: "700",
    },
    summaryContainer: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    summaryHeaderRow: {
        marginBottom: 12,
    },
    summaryTitle: {
        fontSize: 13,
        fontWeight: "800",
        color: "#1E293B",
        textTransform: "uppercase",
        letterSpacing: 0.6,
    },
    subCategoryHeading: {
        fontSize: 11,
        fontWeight: "700",
        color: "#64748B",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginTop: 10,
        marginBottom: 8,
    },
    quarterGridRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 6,
    },
    assessmentGridRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 6,
    },
    performanceGridRow: {
        flexDirection: "row",
        gap: 8,
    },
    summaryTile: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 4,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 74,
    },
    summaryTileLabel: {
        fontSize: 9.5,
        fontWeight: "700",
        marginBottom: 4,
        textAlign: "center",
        letterSpacing: -0.2,
    },
    summaryTileValue: {
        fontSize: 17,
        fontWeight: "800",
        textAlign: "center",
    },
    summaryRemarksBadge: {
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 2,
        width: "92%",
        minHeight: 28,
    },
    summaryRemarksText: {
        fontSize: 10,
        fontWeight: "700",
        textAlign: "center",
        lineHeight: 13,
    },
    bgGreenLight: {
        backgroundColor: "#F0FDF4",
        borderWidth: 1,
        borderColor: "#DCFCE7",
    },
    bgVioletLight: {
        backgroundColor: "#F5F3FF",
        borderWidth: 1,
        borderColor: "#EDE9FE",
    },
    bgOrangeLight: {
        backgroundColor: "#FFF7ED",
        borderWidth: 1,
        borderColor: "#FFEDD5",
    },
    bgSkyLight: {
        backgroundColor: "#F0F9FF",
        borderWidth: 1,
        borderColor: "#E0F2FE",
    },
    bgRedLight: {
        backgroundColor: "#FEF2F2",
        borderWidth: 1,
        borderColor: "#FEE2E2",
    },
    bgNeutralLight: {
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    depedBreakdownBtn: {
        marginTop: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#ECFDF5",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#A7F3D0",
    },
    depedBreakdownBtnText: {
        fontSize: 13,
        fontWeight: "800",
        color: "#047857",
        flex: 1,
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "flex-end",
    },
    breakdownModalContent: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: "85%",
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#0F172A",
    },
    modalSubtitle: {
        fontSize: 12,
        fontWeight: "600",
        color: "#059669",
        marginTop: 2,
    },
    modalSummaryRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 14,
    },
    modalSummaryTile: {
        flex: 1,
        borderRadius: 12,
        padding: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    categoryWeightsCard: {
        backgroundColor: "#F8FAFC",
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginBottom: 14,
    },
    categoryWeightsTitle: {
        fontSize: 12,
        fontWeight: "800",
        color: "#334155",
        marginBottom: 8,
    },
    weightsPillsRow: {
        flexDirection: "row",
        gap: 8,
    },
    weightPill: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 8,
        padding: 8,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        alignItems: "center",
    },
    weightPillLabel: {
        fontSize: 10,
        fontWeight: "700",
        color: "#64748B",
    },
    weightPillVal: {
        fontSize: 14,
        fontWeight: "800",
        color: "#0F172A",
        marginTop: 2,
    },
    modalSectionTitle: {
        fontSize: 13,
        fontWeight: "800",
        color: "#1E293B",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    quarterBreakdownCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginBottom: 12,
    },
    quarterBreakdownHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
        paddingBottom: 8,
    },
    quarterBreakdownTitle: {
        fontSize: 14,
        fontWeight: "800",
        color: "#0F172A",
    },
    quarterBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    quarterBadgeText: {
        fontSize: 11,
        fontWeight: "800",
    },
    compRow: {
        marginBottom: 6,
    },
    compLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: "#475569",
    },
    compValue: {
        fontSize: 11,
        color: "#64748B",
        marginTop: 1,
    },
    compRowHighlight: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#F8FAFC",
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        marginTop: 4,
    },
    compLabelHighlight: {
        fontSize: 11,
        fontWeight: "700",
        color: "#334155",
    },
    compValueHighlight: {
        fontSize: 12,
        fontWeight: "800",
        color: "#0F172A",
    },
    depedInfoCard: {
        backgroundColor: "#F0FDF4",
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: "#BBF7D0",
        marginTop: 4,
    },
    depedInfoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 6,
    },
    depedInfoTitle: {
        fontSize: 12,
        fontWeight: "800",
        color: "#065F46",
    },
    depedInfoDesc: {
        fontSize: 11,
        color: "#047857",
        lineHeight: 18,
        fontWeight: "500",
    },
});
