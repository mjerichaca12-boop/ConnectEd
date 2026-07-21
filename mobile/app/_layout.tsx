import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LogBox, View } from "react-native";
import GlobalMessageNotification from "../src/components/common/GlobalMessageNotification";

LogBox.ignoreLogs([
  'AuthApiError: Invalid Refresh Token: Already Used',
  'Invalid Refresh Token',
  'Your JavaScript code tried to access a native module that doesn\'t exist.',
  'PushNotificationIOS',
  'Unable to activate keep awake',
]);
// Ignore the PushNotificationIOS native module error entirely - it's a known Expo Go
// incompatibility with React Native 0.81.x and has no effect on app functionality.
if (typeof (global as any).__disablePushNotificationIOS === 'undefined') {
  try {
    // Polyfill to silence the missing native module
    const ReactNativeIndex = require('react-native');
    if (!ReactNativeIndex.PushNotificationIOS) {
      ReactNativeIndex.PushNotificationIOS = {
        addEventListener: () => ({ remove: () => {} }),
        removeEventListener: () => {},
        requestPermissions: () => Promise.resolve({}),
        abandonPermissions: () => {},
        checkPermissions: () => {},
        getInitialNotification: () => Promise.resolve(null),
        getScheduledLocalNotifications: () => Promise.resolve([]),
        setApplicationIconBadgeNumber: () => {},
        getApplicationIconBadgeNumber: () => {},
        cancelLocalNotifications: () => {},
        cancelAllLocalNotifications: () => {},
        presentLocalNotification: () => {},
        scheduleLocalNotification: () => {},
        addListener: () => ({ remove: () => {} }),
      };
    }
    (global as any).__disablePushNotificationIOS = true;
  } catch (_) {}
}

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        <GlobalMessageNotification />
      </View>
    </QueryClientProvider>
  );
}
