import { Tabs, useRouter, Href, useSegments } from "expo-router";
import React, { useState, useEffect, useRef } from "react";
import { View, ActivityIndicator, Text, StatusBar, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheetMenu from "../../src/components/common/bottom-sheet-menu";
import TabBar from "../../src/components/common/TabBar";
import { supabase } from "../../src/lib/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChatbotWidget, { ChatbotWidgetRef } from "../../src/components/chatbot/chatbot-widget";

export default function TabLayout() {
    const [menuVisible, setMenuVisible] = useState(false);
    const [role, setRole] = useState<"student" | "teacher" | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const chatbotRef = useRef<ChatbotWidgetRef>(null);

    const router = useRouter();
    const segments = useSegments();
    const insets = useSafeAreaInsets();
    const isMessagesTab = segments.includes("messages");

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

                // Role logic using secure Session Metadata
                let userRole = session.user?.user_metadata?.role || "student";

                // Testing overrides for user
                const userEmail = session.user?.email;
                if (userEmail === "euriqt214@gmail.com") {
                    userRole = "student";
                } else if (userEmail === "erijiao18@gmail.com") {
                    userRole = "teacher";
                }

                setRole(userRole as "student" | "teacher");
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
                <Tabs.Screen name="enrollment" options={{ href: null }} />
                <Tabs.Screen name="profile/index" options={{ href: null }} />
                <Tabs.Screen name="calendar/index" options={{ href: null }} />
                <Tabs.Screen name="announcement/[id]" options={{ href: null }} />
                <Tabs.Screen name="announcement/all" options={{ href: null }} />
                <Tabs.Screen name="profile/change-password" options={{ href: null }} />
                <Tabs.Screen name="grades" options={{ href: null }} />
            </Tabs>

            {/* Global Chatbot Widget - Hidden in messages tab to avoid button overlap */}
            {!isMessagesTab && <ChatbotWidget ref={chatbotRef} role={role} />}

            {/* Bottom Sheet Menu */}
            <BottomSheetMenu 
                visible={menuVisible} 
                role={role} 
                onClose={() => setMenuVisible(false)} 
                onChatbotPress={() => chatbotRef.current?.open()}
            />
        </View>
    );
}
