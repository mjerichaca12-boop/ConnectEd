import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator, TouchableOpacity, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../../src/components/common/AppHeader";
import Colors from "../../../src/constants/Colors";
import SubjectCard from "../../../src/components/cards/SubjectCard";
import { useTeacherSubjectsQuery } from "../../../src/hooks/query/subjects/use-teacher-subjects-query";

export default function TeacherClassesScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    
    // Fetch live data directly from the newly created backend query
    const { data: classes = [], isLoading } = useTeacherSubjectsQuery();

    const filteredClasses = classes.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderClassCard = ({ item }: { item: any }) => (
        <View style={styles.subjectCardWrapper}>
            <SubjectCard
                code={item.code}
                title={item.name}
                teacher={"Me"}
                schedule={`${item.studentsCount} Students Enrolled${item.pendingCount > 0 ? ` • ${item.pendingCount} Pending` : ''}`}
                onPress={() => router.push(`/(tabs)/teacher/class/${item.id}` as any)}
                style={{
                    marginBottom: 0,
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                    borderBottomWidth: 0,
                }}
            />
            <TouchableOpacity 
                style={styles.detailsBtn}
                onPress={() => router.push(`/(tabs)/teacher/class/${item.id}` as any)}
                activeOpacity={0.8}
            >
                <Text style={styles.detailsBtnText}>View Class Details</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader title="Classes" hasNotifications={true} />
            
            <View style={styles.banner}>
                <Text style={styles.bannerTitle}>My Classes</Text>
                <Text style={styles.bannerSub}>{classes.length} Active Subjects</Text>
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={20} color="#94A3B8" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search classes by name or code..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {isLoading ? (
                <ActivityIndicator size="large" color={Colors.light.primary} style={{ marginTop: 40 }} />
            ) : filteredClasses.length === 0 ? (
                <View style={{ padding: 40, alignItems: 'center', marginTop: 20 }}>
                     <Ionicons name="file-tray-outline" size={64} color="#CBD5E1" style={{ marginBottom: 16 }} />
                    <Text style={{ color: Colors.light.textSecondary, fontSize: 16 }}>No subjects found.</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredClasses}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    renderItem={renderClassCard}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    banner: {
        backgroundColor: Colors.light.primary,
        padding: 24,
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 16,
    },
    bannerTitle: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#FFFFFF",
    },
    bannerSub: {
        fontSize: 14,
        color: "rgba(255, 255, 255, 0.8)",
        marginTop: 4,
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        marginHorizontal: 16,
        marginTop: 16,
        paddingHorizontal: 16,
        height: 50,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: "#1E293B",
    },
    list: {
        padding: 16,
        paddingBottom: 40,
    },
    subjectCardWrapper: {
        marginBottom: 20,
    },
    detailsBtn: {
        backgroundColor: Colors.light.primary,
        paddingVertical: 14,
        alignItems: 'center',
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderTopWidth: 0,
    },
    detailsBtnText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 15,
    },
});
