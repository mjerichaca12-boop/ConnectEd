import { Tabs, useRouter, Href, useSegments } from "expo-router";
import React, { useState, useEffect, useRef } from "react";
import { View, ActivityIndicator, Text, StatusBar, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheetMenu from "../../src/components/common/bottom-sheet-menu";
import TabBar from "../../src/components/common/TabBar";
import { supabase } from "../../src/lib/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";
export default function TabLayout() {
    const [menuVisible, setMenuVisible] = useState(false);
    const [role, setRole] = useState<"student" | "teacher" | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const router = useRouter();
    const segments = useSegments();
    const insets = useSafeAreaInsets();
    const isMessagesTab = (segments as string[]).includes("messages");

    useEffect(() => {
        // Session and role check
        const checkSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                
                if (error || !session) {
                    // If no session or error, redirect to OTP login
                    router.replace("/login" as Href);
                    return;
                }

                // Force role to student as this app is strictly for students
                const userRole = "student";
                setRole(userRole);
            } catch (err) {
                console.error("Session check failed:", err);
                router.replace("/login" as Href);
            } finally {
                setIsLoading(false);
            }
        };

        checkSession();
    }, []);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F0FAF5" }}>
                <ActivityIndicator size="large" color="#009664" />
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <Tabs
                tabBar={(props) => (
                    <TabBar {...props} role={role} onMenuPress={() => setMenuVisible(true)} />
                )}
                screenOptions={{
                    headerShown: false,
                }}
            >
                {/* Student Tabs only */}
                <Tabs.Screen
                    name="subjects"
                    options={{
                        title: "Subject",
                        tabBarLabel: "Subject",
                        tabBarIcon: ({ color, focused }) => (
                            <Ionicons
                                name={focused ? "book" : "book-outline"}
                                size={22}
                                color={color}
                            />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="assignment"
                    options={{
                        title: "Task",
                        tabBarLabel: "Task",
                        tabBarIcon: ({ color, focused }) => (
                            <Ionicons
                                name={focused ? "checkbox" : "checkbox-outline"}
                                size={22}
                                color={color}
                            />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="home"
                    options={{
                        title: "Home",
                        tabBarLabel: "Home",
                    }}
                />
                <Tabs.Screen name="meeting" options={{ href: null }} />
                <Tabs.Screen
                    name="messages"
                    options={{
                        title: "Messages",
                        tabBarLabel: "Messages",
                        tabBarIcon: ({ color, focused }) => (
                            <Ionicons
                                name={focused ? "chatbubbles" : "chatbubbles-outline"}
                                size={22}
                                color={color}
                            />
                        ),
                    }}
                />

                {/* Hidden screens / Auxiliary */}
                <Tabs.Screen name="menu" options={{ href: null }} />
                <Tabs.Screen name="teacher/attendance" options={{ href: null }} />
                <Tabs.Screen name="enrollment" options={{ href: null }} />
                <Tabs.Screen name="profile/index" options={{ href: null }} />
                <Tabs.Screen name="calendar/index" options={{ href: null }} />
                <Tabs.Screen name="announcement/[id]" options={{ href: null }} />
                <Tabs.Screen name="announcement/all" options={{ href: null }} />
                <Tabs.Screen name="profile/change-password" options={{ href: null }} />
                <Tabs.Screen name="grades" options={{ href: null }} />
            </Tabs>

            {/* Bottom Sheet Menu */}
            <BottomSheetMenu 
                visible={menuVisible} 
                role={role} 
                onClose={() => setMenuVisible(false)} 
            />
        </View>
    );
}
