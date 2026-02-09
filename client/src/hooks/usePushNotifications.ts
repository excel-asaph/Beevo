/**
 * usePushNotifications Hook
 * 
 * Manages Web Push notification subscription/unsubscription
 */

import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';

/**
 * State object for push notifications.
 */
interface PushState {
    /** Whether the browser supports push notifications. */
    isSupported: boolean;
    /** Whether the user is currently subscribed. */
    isSubscribed: boolean;
    /** Loading state for permission/subscription checks. */
    isLoading: boolean;
    /** Current permission status ('granted', 'denied', 'default'). */
    permission: NotificationPermission | 'unknown';
    /** Error message if any operation failed. */
    error: string | null;
}

/**
 * A hook to manage Web Push Notifications.
 * 
 * Features:
 * - Checks browser support for Service Workers and Push API.
 * - Manages subscription state (subscribe/unsubscribe).
 * - Handles VAPID key exchange with the server.
 * - Persists subscription details to the backend.
 * 
 * @returns {Object} Push notification state and methods.
 */
export function usePushNotifications() {
    const { workspaceId } = useWorkspace();
    const [state, setState] = useState<PushState>({
        isSupported: false,
        isSubscribed: false,
        isLoading: true,
        permission: 'unknown',
        error: null
    });

    // Check support and current status on mount
    useEffect(() => {
        const checkSupport = async () => {
            const supported = 'serviceWorker' in navigator && 'PushManager' in window;
            const permission = 'Notification' in window ? Notification.permission : 'unknown';

            if (!supported) {
                setState(s => ({ ...s, isSupported: false, isLoading: false }));
                return;
            }

            try {
                // Register service worker
                const registration = await navigator.serviceWorker.register('/sw.js');
                const subscription = await registration.pushManager.getSubscription();

                setState({
                    isSupported: true,
                    isSubscribed: !!subscription,
                    isLoading: false,
                    permission: permission as NotificationPermission,
                    error: null
                });
            } catch (e) {
                console.error('Push check failed:', e);
                setState(s => ({
                    ...s,
                    isSupported: false,
                    isLoading: false,
                    error: 'Service worker registration failed'
                }));
            }
        };

        checkSupport();
    }, []);

    const subscribe = useCallback(async () => {
        if (!state.isSupported) return false;

        setState(s => ({ ...s, isLoading: true, error: null }));

        try {
            // Request permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setState(s => ({ ...s, isLoading: false, permission, error: 'Permission denied' }));
                return false;
            }

            // Get VAPID key from server
            const vapidResponse = await fetch('/api/push/vapid-key');
            const { publicKey, configured } = await vapidResponse.json();

            if (!configured || !publicKey) {
                setState(s => ({ ...s, isLoading: false, error: 'Push not configured on server' }));
                return false;
            }

            // Subscribe
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey) as any
            });

            // Send subscription to server
            await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-workspace-id': workspaceId || ''
                },
                body: JSON.stringify({ subscription: subscription.toJSON() })
            });

            setState(s => ({
                ...s,
                isSubscribed: true,
                isLoading: false,
                permission: 'granted',
                error: null
            }));

            return true;
        } catch (e: any) {
            console.error('Push subscription failed:', e);
            setState(s => ({
                ...s,
                isLoading: false,
                error: e.message || 'Subscription failed'
            }));
            return false;
        }
    }, [state.isSupported, workspaceId]);

    const unsubscribe = useCallback(async () => {
        setState(s => ({ ...s, isLoading: true }));

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                await subscription.unsubscribe();
                await fetch('/api/push/unsubscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: subscription.endpoint })
                });
            }

            setState(s => ({ ...s, isSubscribed: false, isLoading: false }));
            return true;
        } catch (e: any) {
            console.error('Unsubscribe failed:', e);
            setState(s => ({ ...s, isLoading: false, error: e.message }));
            return false;
        }
    }, []);

    return {
        ...state,
        subscribe,
        unsubscribe
    };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export default usePushNotifications;
