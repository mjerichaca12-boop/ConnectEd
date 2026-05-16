import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    StatusBar,
    ActivityIndicator,
    SafeAreaView,
    Platform,
    Modal,
    TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import Colors from '../../src/constants/Colors';
import Layout from '../../src/constants/Layout';
import AppHeader from '../../src/components/common/AppHeader';

interface AttendanceRecord {
    id: string;
    date: string;
    status: string;
    subject_id: string;
    subject_name: string;
    subject_code: string;
    remarks: string;
}

export default function AttendanceScreen() {
    const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAttendance = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // 1. Fetch attendance records
            const { data: attendance, error: attendanceError } = await supabase
                .from('teacher_student_attendance')
                .select('*')
                .eq('student_id', user.id)
                .order('attendance_date', { ascending: false });

            if (attendanceError) throw attendanceError;

            if (!attendance || attendance.length === 0) {
                setAttendanceData([]);
                return;
            }

            // 2. Fetch subject details for each record
            const subjectIds = [...new Set(attendance.map(a => a.subject_id))];
            const { data: subjects, error: subjectsError } = await supabase
                .from('subjects')
                .select('id, name, code')
                .in('id', subjectIds);

            if (subjectsError) throw subjectsError;

            const subjectMap = new Map(subjects?.map(s => [s.id, s]));

            // 3. Map records
            const mappedRecords: AttendanceRecord[] = attendance.map(a => {
                const subject = subjectMap.get(a.subject_id);
                return {
                    id: a.id,
                    date: new Date(a.attendance_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    }),
                    status: a.attendance_status || 'Unmarked',
                    subject_id: a.subject_id,
                    subject_name: subject?.name || 'Unknown Subject',
                    subject_code: subject?.code || 'N/A',
                    remarks: a.remarks || ''
                };
            });

            setAttendanceData(mappedRecords);
        } catch (err: any) {
            console.error('[attendance] Fetch error:', err);
            setError(err.message || 'Failed to load attendance');
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchAttendance();
    }, [fetchAttendance]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchAttendance();
    };

    // Calculate statistics
    const stats = {
        present: attendanceData.filter(a => a.status === 'Present').length,
        absent: attendanceData.filter(a => a.status === 'Absent').length,
        late: attendanceData.filter(a => a.status === 'Late').length,
        total: attendanceData.length
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'present': return '#10B981'; // green-600
            case 'absent': return '#EF4444';  // red-500
            case 'late': return '#F59E0B';    // amber-500
            default: return '#64748B';       // slate-500
        }
    };

    const getStatusBg = (status: string) => {
        switch (status.toLowerCase()) {
            case 'present': return '#ECFDF5'; // green-50
            case 'absent': return '#FEF2F2';  // red-50
            case 'late': return '#FFFBEB';    // amber-50
            default: return '#F8FAFC';       // slate-50
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.light.forestGreen} />
            <AppHeader title="My Attendance" showBack={false} />
            
            <ScrollView 
                style={styles.scrollContainer} 
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.light.primary]} />
                }
            >
                {/* Summary Section - Inspired by Teacher Portal */}
                <View style={styles.summaryGrid}>
                    <View style={[styles.summaryCard, { borderLeftColor: '#10B981', borderLeftWidth: 4 }]}>
                        <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                        <Text style={styles.summaryCount}>{stats.present}</Text>
                        <Text style={styles.summaryLabel}>Present</Text>
                    </View>
                    <View style={[styles.summaryCard, { borderLeftColor: '#EF4444', borderLeftWidth: 4 }]}>
                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                        <Text style={styles.summaryCount}>{stats.absent}</Text>
                        <Text style={styles.summaryLabel}>Absent</Text>
                    </View>
                    <View style={[styles.summaryCard, { borderLeftColor: '#F59E0B', borderLeftWidth: 4 }]}>
                        <Ionicons name="alert-circle" size={24} color="#F59E0B" />
                        <Text style={styles.summaryCount}>{stats.late}</Text>
                        <Text style={styles.summaryLabel}>Late</Text>
                    </View>
                </View>

                <View style={styles.headerRow}>
                    <Text style={styles.sectionTitle}>Attendance Records</Text>
                    <Text style={styles.totalText}>Total: {stats.total}</Text>
                </View>

                {error && (
                    <View style={styles.errorCard}>
                        <Ionicons name="alert-circle" size={24} color="#EF4444" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {isLoading && attendanceData.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={Colors.light.primary} />
                        <Text style={styles.loadingText}>Loading records...</Text>
                    </View>
                ) : attendanceData.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="calendar-outline" size={48} color="#CBD5E1" />
                        <Text style={styles.emptyTitle}>No Attendance Records</Text>
                        <Text style={styles.emptySub}>Your attendance will appear here once recorded by your teachers.</Text>
                    </View>
                ) : (
                    attendanceData.map((item) => (
                        <View key={item.id} style={styles.attendanceCard}>
                            <View style={styles.cardMain}>
                                <View style={styles.subjectInfo}>
                                    <Text style={styles.subjectName}>{item.subject_name}</Text>
                                    <Text style={styles.subjectCode}>{item.subject_code}</Text>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: getStatusBg(item.status) }]}>
                                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
                                </View>
                            </View>
                            
                            <View style={styles.cardFooter}>
                                <View style={styles.footerItem}>
                                    <Ionicons name="calendar-outline" size={16} color="#64748B" />
                                    <Text style={styles.footerText}>{item.date}</Text>
                                </View>
                                {item.remarks ? (
                                    <View style={styles.footerItem}>
                                        <Ionicons name="chatbox-ellipses-outline" size={16} color="#64748B" />
                                        <Text style={styles.footerText}>{item.remarks}</Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    ))
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
        paddingBottom: 32,
    },
    summaryGrid: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 24,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    summaryCount: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E293B',
        marginTop: 4,
    },
    summaryLabel: {
        fontSize: 11,
        color: '#64748B',
        textTransform: 'uppercase',
        fontWeight: '600',
        marginTop: 2,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1E293B",
    },
    totalText: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
    attendanceCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#F1F5F9",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    cardMain: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    subjectInfo: {
        flex: 1,
        marginRight: 12,
    },
    subjectName: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 2,
    },
    subjectCode: {
        fontSize: 13,
        color: Colors.light.primary,
        fontWeight: '600',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 12,
        fontWeight: "bold",
    },
    cardFooter: {
        flexDirection: 'row',
        gap: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    footerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    footerText: {
        fontSize: 12,
        color: "#64748B",
    },
    emptyCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 40,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#F1F5F9",
        marginTop: 20,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1E293B",
        marginTop: 16,
    },
    emptySub: {
        fontSize: 14,
        color: "#64748B",
        textAlign: "center",
        marginTop: 8,
        lineHeight: 20,
    },
    errorCard: {
        backgroundColor: "#FEF2F2",
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#FECACA",
    },
    errorText: {
        fontSize: 14,
        color: "#EF4444",
        flex: 1,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#64748B',
    }
});
