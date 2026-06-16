import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TextInput, TouchableOpacity, StatusBar, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../../../src/components/common/AppHeader";
import Colors from "../../../../src/constants/Colors";
import { useClassStudentsQuery } from "../../../../src/hooks/query/enrollments/use-class-students-query";
import { useUpdateStudentStatusMutation } from "../../../../src/hooks/query/enrollments/use-update-student-status-mutation";
import { useRemoveStudentMutation } from "../../../../src/hooks/query/enrollments/use-remove-student-mutation";

const CLASS_STATS = [
    { label: "Students", value: "32", icon: "people", color: "#10B981" },
    { label: "Avg Grade", value: "88%", icon: "trending-up", color: "#3B82F6" },
    { label: "Room", value: "301", icon: "location", color: "#8B5CF6" },
];

const TABLE_WIDTH = 920;

export default function ClassDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");

    const { data: students = [], isLoading } = useClassStudentsQuery({ subjectId: id });
    const { mutate: updateStatus, isPending: isUpdating } = useUpdateStudentStatusMutation(id);
    const { mutate: removeStudent, isPending: isRemoving } = useRemoveStudentMutation(id);

    const pendingStudents = students.filter(s => s.status === 'Pending');

    const handleAcceptAll = () => {
        if (pendingStudents.length === 0) return;
        Alert.alert(
            "Accept All",
            `Are you sure you want to accept all ${pendingStudents.length} pending students?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Accept All",
                    onPress: () => {
                        pendingStudents.forEach(student => {
                            updateStatus({ enrollmentId: student.enrollmentId, status: 'accepted' });
                        });
                    }
                }
            ]
        );
    };

    const handleDeleteStudent = (enrollmentId: string, studentName: string) => {
        Alert.alert(
            "Remove Student",
            `Are you sure you want to remove "${studentName}" from this class?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => removeStudent({ enrollmentId }),
                },
            ]
        );
    };

    const filteredStudents = students.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <AppHeader title="Class Details" showBack={true} />
            
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Banner Section */}
                <View style={styles.banner}>
                    <View style={styles.bannerTop}>
                        <Text style={styles.bannerTitle}>Advanced Mathematics</Text>
                        <Text style={styles.sessionCount}>12 / 45 sessions</Text>
                    </View>
                    <Text style={styles.bannerSub}>Course Progress</Text>
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: '26.6%' }]} />
                    </View>
                </View>

                {/* Stats Section */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
                    {CLASS_STATS.map((stat, index) => (
                        <View key={index} style={styles.statCard}>
                            <View style={styles.statIconBox}>
                                <Ionicons name={stat.icon as any} size={18} color={stat.color} />
                            </View>
                            <View>
                                <Text style={styles.statValue}>{stat.value}</Text>
                                <Text style={styles.statLabel}>{stat.label}</Text>
                            </View>
                        </View>
                    ))}
                </ScrollView>

                {/* Search & List Section */}
                <View style={styles.listSection}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={20} color="#94A3B8" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by name, ID, or email..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        <TouchableOpacity style={styles.filterBtn}>
                            <Ionicons name="options-outline" size={20} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Student List</Text>
                        {pendingStudents.length > 0 && (
                            <TouchableOpacity 
                                style={styles.acceptAllBtn}
                                onPress={handleAcceptAll}
                                disabled={isUpdating}
                            >
                                <Ionicons name="checkmark-done" size={16} color="#FFF" />
                                <Text style={styles.acceptAllBtnText}>Accept All ({pendingStudents.length})</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View style={{ width: TABLE_WIDTH }}>
                            {/* Table Header */}
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerText, { width: 90 }]}>STUDENT ID</Text>
                                <Text style={[styles.headerText, { width: 180 }]}>NAME</Text>
                                <Text style={[styles.headerText, { width: 220 }]}>CONTACT</Text>
                                <Text style={[styles.headerText, { width: 150, textAlign: 'center' }]}>GRADE</Text>
                                <Text style={[styles.headerText, { width: 100, textAlign: 'center' }]}>STATUS</Text>
                                <Text style={[styles.headerText, { width: 100, textAlign: 'center' }]}>ACTIONS</Text>
                            </View>

                            {/* Table Content */}
                            {filteredStudents.length > 0 ? (
                                filteredStudents.map((item) => (
                                    <View key={item.id} style={styles.studentRow}>
                                        <View style={[styles.idCol, { width: 90 }]}>
                                            <Text style={styles.idText}>{item.id}</Text>
                                        </View>
                                        <View style={{ width: 180 }}>
                                            <Text style={styles.nameText}>{item.name}</Text>
                                        </View>
                                        <View style={{ width: 220 }}>
                                            <View style={styles.contactItem}>
                                                <Ionicons name="mail-outline" size={12} color="#64748B" />
                                                <Text style={styles.contactText} numberOfLines={1}>{item.email}</Text>
                                            </View>
                                            <View style={styles.contactItem}>
                                                <Ionicons name="call-outline" size={12} color="#64748B" />
                                                <Text style={styles.contactText}>{item.phone}</Text>
                                            </View>
                                        </View>
                                        <View style={{ width: 150, alignItems: 'center' }}>
                                            <View style={styles.gradeBadge}>
                                                <Ionicons name="ribbon-outline" size={14} color={Colors.light.primary} />
                                                <Text style={styles.gradeText}>{item.grades?.overall || "-"}</Text>
                                            </View>
                                        </View>
                                        <View style={{ width: 100, alignItems: 'center' }}>
                                            <View style={[
                                                styles.statusBadge, 
                                                item.status === 'Active' ? styles.statusActive : 
                                                item.status === 'Pending' ? styles.statusPending : 
                                                styles.statusInactive
                                            ]}>
                                                <Text style={[
                                                    styles.statusText, 
                                                    item.status === 'Active' ? styles.statusTextActive : 
                                                    item.status === 'Pending' ? styles.statusTextPending : 
                                                    styles.statusTextInactive
                                                ]}>
                                                    {item.status}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={{ width: 100, alignItems: 'center' }}>
                                            {item.status === 'Pending' ? (
                                                <TouchableOpacity 
                                                    style={[styles.actionBtn, { backgroundColor: '#10B981', borderColor: '#10B981' }]}
                                                    onPress={() => updateStatus({ enrollmentId: item.enrollmentId, status: 'accepted' })}
                                                    disabled={isUpdating || isRemoving}
                                                >
                                                    <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Accept</Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity 
                                                    style={styles.deleteBtn}
                                                    onPress={() => handleDeleteStudent(item.enrollmentId, item.name)}
                                                    disabled={isRemoving}
                                                >
                                                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                ))
                            ) : isLoading ? (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>Loading students...</Text>
                                </View>
                            ) : (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No students found matching your search.</Text>
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    scrollView: {
        flex: 1,
    },
    banner: {
        backgroundColor: Colors.light.primary,
        margin: 16,
        padding: 24,
        borderRadius: 24,
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    bannerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    bannerTitle: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#FFFFFF",
    },
    sessionCount: {
        fontSize: 12,
        fontWeight: "700",
        color: "#FFFFFF",
        backgroundColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    bannerSub: {
        fontSize: 14,
        color: "rgba(255, 255, 255, 0.85)",
        marginBottom: 12,
        fontWeight: '600',
    },
    progressBarBg: {
        height: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 4,
    },
    statsScroll: {
        paddingLeft: 16,
        paddingBottom: 20,
    },
    statCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 20,
        marginRight: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        minWidth: 155,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    statIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    statLabel: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
    },
    listSection: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        borderRadius: 24,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 12,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        height: 52,
        borderRadius: 14,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 20,
    },
    searchInput: {
        flex: 1,
        marginLeft: 12,
        fontSize: 14,
        color: '#1E293B',
    },
    filterBtn: {
        padding: 6,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
    },
    acceptAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10B981',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 6,
    },
    acceptAllBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 13,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        marginBottom: 12,
    },
    headerText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        letterSpacing: 0.5,
    },
    studentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    idCol: {
        backgroundColor: '#F1F5F9',
        padding: 6,
        borderRadius: 8,
        marginRight: 10,
        alignItems: 'center',
    },
    idText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748B',
    },
    nameText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 2,
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    contactText: {
        fontSize: 11,
        color: '#94A3B8',
        marginLeft: 6,
    },
    gradeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    gradeText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: Colors.light.primary,
        marginLeft: 4,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    statusActive: {
        backgroundColor: '#DCFCE7',
    },
    statusInactive: {
        backgroundColor: '#FEE2E2',
    },
    statusPending: {
        backgroundColor: '#FEF3C7',
    },
    statusText: {
        fontSize: 10,
        fontWeight: '800',
    },
    statusTextActive: {
        color: '#15803D',
    },
    statusTextInactive: {
        color: '#B91C1C',
    },
    statusTextPending: {
        color: '#D97706',
    },
    actionBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    actionBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.light.primary,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: '#94A3B8',
        fontWeight: '500',
    },
    deleteBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#FEF2F2',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FCA5A5',
    },
});
