import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

let Notifications: any = null;
let hasCheckedModule = false;
let isInitialized = false;

/**
 * Safely loads expo-notifications only in environments where native notifications are supported.
 * In Expo Go on Android (SDK 53+), remote/push notifications were removed and loading
 * expo-notifications throws a fatal error. We safely guard against this.
 */
function getNotificationsModule(): any | null {
    if (hasCheckedModule) return Notifications;
    hasCheckedModule = true;

    try {
        const isExpoGo =
            Constants.appOwnership === 'expo' ||
            Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

        // In Expo Go on Android, native expo-notifications is not supported in SDK 53+
        if (Platform.OS === 'android' && isExpoGo) {
            return null;
        }

        // Dynamically require so module is not evaluated during static bundle loading in unsupported environments
        const notifModule = require('expo-notifications');
        if (notifModule && typeof notifModule.setNotificationHandler === 'function') {
            notifModule.setNotificationHandler({
                handleNotification: async () => ({
                    shouldShowAlert: true,
                    shouldPlaySound: true,
                    shouldSetBadge: true,
                    shouldShowBanner: true,
                    shouldShowList: true,
                }),
            });
            Notifications = notifModule;
        }
    } catch (e) {
        // Module not supported or failed to load in this environment
        Notifications = null;
    }

    return Notifications;
}

/**
 * Returns true if native device notifications are supported in the current runtime
 */
export function isDeviceNotificationsSupported(): boolean {
    return getNotificationsModule() !== null;
}

/**
 * Configure notification channels and request permissions
 */
export async function initializeDeviceNotifications(): Promise<boolean> {
    const notif = getNotificationsModule();
    if (!notif) return false;
    if (isInitialized) return true;

    try {
        if (Platform.OS === 'android' && typeof notif.setNotificationChannelAsync === 'function') {
            await notif.setNotificationChannelAsync('default', {
                name: 'ConnectEd Notifications',
                importance: notif.AndroidImportance?.MAX ?? 5,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#16A34A',
                sound: 'default',
                enableVibrate: true,
            });
        }

        if (typeof notif.getPermissionsAsync === 'function') {
            const { status: existingStatus } = await notif.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted' && typeof notif.requestPermissionsAsync === 'function') {
                const { status } = await notif.requestPermissionsAsync();
                finalStatus = status;
            }

            isInitialized = finalStatus === 'granted';
            return isInitialized;
        }

        return false;
    } catch (error) {
        console.warn('[DeviceNotifications] Failed to initialize notifications:', error);
        return false;
    }
}

/**
 * Schedule a local notification to alert the user on their cellphone outside the app (if supported)
 */
export async function triggerDeviceNotification({
    title,
    body,
    data = {},
}: {
    title: string;
    body: string;
    data?: Record<string, any>;
}): Promise<string | null> {
    const notif = getNotificationsModule();
    if (!notif) return null;

    try {
        await initializeDeviceNotifications();

        if (typeof notif.scheduleNotificationAsync === 'function') {
            const id = await notif.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data,
                    sound: true,
                    priority: notif.AndroidNotificationPriority?.HIGH ?? 'high',
                    badge: 1,
                },
                trigger: null, // Present immediately
            });

            return id;
        }

        return null;
    } catch (error) {
        console.warn('[DeviceNotifications] Error triggering local notification:', error);
        return null;
    }
}

/**
 * Safely subscribe to notification responses (e.g. user tapping a notification)
 */
export function subscribeToNotificationResponse(
    onResponse: (data: Record<string, any> | undefined) => void
): () => void {
    const notif = getNotificationsModule();
    if (!notif || typeof notif.addNotificationResponseReceivedListener !== 'function') {
        return () => {};
    }

    try {
        const subscription = notif.addNotificationResponseReceivedListener((response: any) => {
            try {
                const data = response?.notification?.request?.content?.data;
                onResponse(data);
            } catch (err) {
                console.warn('[DeviceNotifications] Error handling response:', err);
            }
        });

        return () => {
            try {
                subscription?.remove?.();
            } catch {}
        };
    } catch {
        return () => {};
    }
}
