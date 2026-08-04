import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { withLayoutContext, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../../../../src/constants/Colors";

const { Navigator } = createMaterialTopTabNavigator();

export const MaterialTopTabs = withLayoutContext(Navigator);

export default function SubjectLayout() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    return (
        <View style={{ flex: 1 }}>
            {/* Back header */}
            <View style={[styles.backHeader, { paddingTop: insets.top }]}>
                <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={() => {
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.push("/(tabs)/subjects" as any);
                        }
                    }}
                >
                    <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                    <Text style={styles.backText}>Classes</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Class Details</Text>
                <View style={{ width: 80 }} />
            </View>

            <MaterialTopTabs
                screenOptions={{
                    tabBarActiveTintColor: Colors.light.primary,
                    tabBarInactiveTintColor: Colors.light.textSecondary,
                    tabBarLabelStyle: {
                        fontSize: 12,
                        fontWeight: "bold",
                        textTransform: "capitalize",
                    },
                    tabBarIndicatorStyle: {
                        backgroundColor: Colors.light.primary,
                        height: 3,
                    },
                    tabBarStyle: {
                        backgroundColor: "#FFFFFF",
                        elevation: 0,
                        shadowOpacity: 0,
                        borderBottomWidth: 1,
                        borderBottomColor: Colors.light.border,
                    },
                    tabBarScrollEnabled: true,
                    tabBarItemStyle: { width: 120 },
                }}
            >
                <MaterialTopTabs.Screen name="index" options={{ title: "Overview" }} />
                <MaterialTopTabs.Screen name="announcement" options={{ title: "Announcement" }} />
                <MaterialTopTabs.Screen name="assignment" options={{ title: "Assignment" }} />
                <MaterialTopTabs.Screen name="materials" options={{ title: "Materials" }} />
            </MaterialTopTabs>
        </View>
    );
}

const styles = StyleSheet.create({
    backHeader: {
        backgroundColor: Colors.light.primary,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    backButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    backText: {
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: "600",
    },
    headerTitle: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "bold",
    },
});
