import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LogBox, View } from "react-native";
import GlobalMessageNotification from "../src/components/common/GlobalMessageNotification";
import { initializeDeviceNotifications, subscribeToNotificationResponse } from "../src/utils/device-notifications";
import { getNotificationRoute } from "../src/utils/notification-navigation";
import { supabase } from "../src/lib/supabase";

const ignoredWarnings = [
  'AuthApiError: Invalid Refresh Token: Already Used',
  'Invalid Refresh Token',
  'Your JavaScript code tried to access a native module that doesn\'t exist.',
  'PushNotificationIOS',
  'PushNotificationIOS has been extracted from react-native core',
  'Due to changes in Androids permission requirements, Expo Go can no longer provide full access to the media library',
  'Unable to activate keep awake',
  'The network connection was lost',
  'UnexpectedException: The network connection was lost',
  'fetch failed: UnexpectedException: The network connection was lost',
  'fetch failed',
  'AuthRetryableFetchError',
  'Network request failed',
  '[assignments] Invalid subjectId provided',
  '[materials] Invalid subjectId provided',
  '[announcements] Invalid or unresolved subjectId provided',
  'Invalid subjectId provided',
];

LogBox.ignoreLogs(ignoredWarnings);

if (__DEV__) {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const message = args.map(a => (typeof a === 'string' ? a : (a?.message || ''))).join(' ');
    if (ignoredWarnings.some(w => message.includes(w))) {
      return;
    }
    originalWarn(...args);
  };

  const originalError = console.error;
  console.error = (...args: any[]) => {
    const message = args.map(a => (typeof a === 'string' ? a : (a?.message || ''))).join(' ');
    if (
      message.includes('The network connection was lost') ||
      message.includes('UnexpectedException: The network connection was lost') ||
      message.includes('AuthRetryableFetchError')
    ) {
      return;
    }
    originalError(...args);
  };
}

const queryClient = new QueryClient();

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Initialize OS notification channels and request permissions (if supported)
    initializeDeviceNotifications();

    // Handle user tapping on system notification (in supported builds)
    const unsubscribe = subscribeToNotificationResponse(async data => {
      try {
        if (!data) return;
        const { data: authData } = await supabase.auth.getUser();
        const role = authData?.user?.user_metadata?.role || 'student';
        const routeResult = getNotificationRoute(data, role);
        if (routeResult.params) {
          router.push({
            pathname: routeResult.pathname as any,
            params: routeResult.params,
          });
        } else {
          router.push(routeResult.pathname as any);
        }
      } catch (e) {
        console.warn('[RootLayout] Error handling notification response:', e);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [router]);

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
