import { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, Href } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS
} from "react-native-reanimated";
import { supabase } from "../src/lib/supabase";

export default function SplashScreen() {
  const router = useRouter();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(500, withTiming(1, { duration: 1000 }));

    const checkSession = async () => {
      try {
        // Wait at least 2 seconds for splash feel
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          router.replace("/(tabs)/home" as Href);
        } else {
          router.replace("/login" as Href);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        router.replace("/login" as Href);
      }
    };

    checkSession();
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, animatedStyle]}>
        <Text style={styles.logo}>ConnectEd</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#009664" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0FAF5",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
  },
  logo: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#009664",
    marginBottom: 40,
    fontFamily: "System", // Use system font for now, can be customized later
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#009664",
    fontSize: 14,
  }
});
