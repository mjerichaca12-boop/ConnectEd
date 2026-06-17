import React from "react";
import { View, TouchableOpacity, StyleSheet, Text, Platform } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "../../constants/Colors";

export default function TabBar({ state, descriptors, navigation, onMenuPress, role }: BottomTabBarProps & { onMenuPress: () => void, role: "student" | "teacher" | null }) {
    const insets = useSafeAreaInsets();

    const primaryColor = Colors.light.primary;
    const inactiveColor = Colors.light.tabIconDefault;

    // Define items based on role
    const items = role === "teacher" 
        ? [
            { name: "teacher-home", type: "route", icon: "grid" },
            { name: "teacher/classes", type: "route", icon: "school" },
            { name: "teacher/grades", type: "route", icon: "trending-up" },
            { name: "teacher/announcements", type: "route", icon: "megaphone" },
            { name: "teacher/messages", type: "route", icon: "chatbubbles" },
            { name: "menu", type: "action" }
        ]
        : [
            { name: "home", type: "route", icon: "home" },
            { name: "assignment", type: "route", icon: "checkbox" },
            { name: "subjects", type: "route", icon: "book" },
            { name: "messages", type: "route", icon: "chatbubbles" },
            { name: "menu", type: "action" }
        ];

    return (
        <View style={[
            styles.container, 
            { 
                paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 12) 
            }
        ]}>
            {items.map((item) => {
                if (item.type === "route") {
                    const routeIndex = state.routes.findIndex((r) => r.name === item.name);
                    if (routeIndex === -1) return null;

                    const route = state.routes[routeIndex];
                    const descriptor = descriptors[route.key];
                    if (!descriptor) return null;

                    const { options } = descriptor;
                    const rawLabel =
                        options.tabBarLabel !== undefined
                            ? options.tabBarLabel
                            : options.title !== undefined
                                ? options.title
                                : route.name;
                    
                    const label = typeof rawLabel === 'string' 
                        ? rawLabel.replace('teacher/', '').replace('teacher-', '') 
                        : rawLabel;

                    // Handle sub-route highlighting (e.g., Attendance highlights Dashboard)
                    const currentRouteName = state.routes[state.index].name;
                    const isFocused = state.index === routeIndex || 
                        (item.name === "teacher-home" && (currentRouteName === "teacher/attendance" || currentRouteName === "teacher/meeting")) ||
                        (item.name === "teacher/classes" && currentRouteName.includes("teacher/class-details"));

                    const onPress = () => {
                        const event = navigation.emit({
                            type: "tabPress",
                            target: route.key,
                            canPreventDefault: true,
                        });
                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name, route.params);
                        }
                    };
                    const onLongPress = () => {
                        navigation.emit({ type: "tabLongPress", target: route.key });
                    };
                    const Icon = options.tabBarIcon;

                    // Special styling for Home screens
                    const isHomeScreen = item.name === "home" || item.name === "teacher-home";

                    if (isHomeScreen) {
                        return (
                            <TouchableOpacity
                                key={route.key}
                                onPress={onPress}
                                onLongPress={onLongPress}
                                style={styles.homeContainer}
                                testID={(options as any).tabBarTestID}
                            >
                                <View style={[styles.homeCircle, isFocused && styles.homeCircleFocused]}>
                                    <Ionicons
                                        name={isFocused ? (item.icon as any) : `${item.icon}-outline`}
                                        size={24}
                                        color={isFocused ? "#FFFFFF" : inactiveColor}
                                    />
                                </View>
                                <Text style={[styles.tabLabel, { color: isFocused ? primaryColor : inactiveColor, marginTop: 4 }]}>
                                    {label as string}
                                </Text>
                            </TouchableOpacity>
                        );
                    }

                    return (
                        <TouchableOpacity
                            key={route.key}
                            accessibilityRole="button"
                            accessibilityState={isFocused ? { selected: true } : {}}
                            accessibilityLabel={options.tabBarAccessibilityLabel}
                            testID={(options as any).tabBarTestID}
                            onPress={onPress}
                            onLongPress={onLongPress}
                            style={styles.tabItem}
                        >
                            <Ionicons
                                name={isFocused ? (item.icon as any) : `${item.icon}-outline`}
                                size={24}
                                color={isFocused ? primaryColor : inactiveColor}
                            />
                            <Text style={[styles.tabLabel, { color: isFocused ? primaryColor : inactiveColor }]}>
                                {label as string}
                            </Text>
                        </TouchableOpacity>
                    );
                } else if (item.name === "menu") {
                    return (
                        <TouchableOpacity
                            key="menu-action"
                            onPress={onMenuPress}
                            style={styles.tabItem}
                        >
                            <Ionicons name="ellipsis-vertical" size={24} color={inactiveColor} />
                            <Text style={[styles.tabLabel, { color: inactiveColor }]}>More</Text>
                        </TouchableOpacity>
                    );
                }
                return null;
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        borderTopWidth: 1,
        borderTopColor: "#E2E8F0",
        paddingTop: 10,
        justifyContent: 'space-between',
        paddingHorizontal: 4,
        // Removed fixed height to allow safe area padding to work correctly
    },
    tabItem: {
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        height: 44, // Consistent height for the interactive area
    },
    tabLabel: {
        fontSize: 9,
        marginTop: 2,
        fontWeight: "500",
    },
    homeContainer: {
        alignItems: 'center',
        justifyContent: 'flex-start',
        marginTop: -12,
        width: 60,
    },
    homeCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "#F1F5F9",
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: "#FFFFFF",
    },
    homeCircleFocused: {
        backgroundColor: Colors.light.primary,
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
});
