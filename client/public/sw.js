/**
 * Beevo Service Worker for Push Notifications
 * 
 * Handles:
 * - Push notification display
 * - Notification click actions
 * - Action button handling (Approve/Reject)
 */

self.addEventListener('push', function (event) {
    console.log('[SW] Push received');

    if (!event.data) {
        console.log('[SW] No push data');
        return;
    }

    try {
        const payload = event.data.json();
        const { title, body, icon, badge, tag, data, actions } = payload;

        const options = {
            body: body || 'New notification from Beevo',
            icon: icon || '/beevo-icon-192.png',
            badge: badge || '/beevo-badge-72.png',
            tag: tag || 'beevo-notification',
            data: data || {},
            actions: actions || [],
            vibrate: [200, 100, 200],
            requireInteraction: true // Keep notification visible until user interacts
        };

        event.waitUntil(
            self.registration.showNotification(title || 'Beevo Agent', options)
        );
    } catch (e) {
        console.error('[SW] Error parsing push data:', e);
    }
});

self.addEventListener('notificationclick', function (event) {
    console.log('[SW] Notification clicked:', event.action);

    event.notification.close();

    const data = event.notification.data || {};
    const interventionId = data.interventionId;
    const action = event.action; // 'approve' or 'reject' from action buttons

    // Handle action button clicks
    if (action && interventionId) {
        event.waitUntil(
            handleInterventionAction(interventionId, action)
        );
        return;
    }

    // Default: open the workspace
    const urlToOpen = data.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function (clientList) {
                // Check if a window is already open
                for (const client of clientList) {
                    if (client.url.includes('/workspace') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window
                return clients.openWindow(urlToOpen);
            })
    );
});

async function handleInterventionAction(interventionId, action) {
    const status = action === 'approve' ? 'APPROVED' : 'REJECTED';

    try {
        // Get the workspace ID from stored data or URL
        const response = await fetch('/api/hitl/resolve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: interventionId,
                action: status,
                feedback: `Via Push Notification`
            })
        });

        if (response.ok) {
            // Show confirmation notification
            self.registration.showNotification('Beevo', {
                body: `Request ${action === 'approve' ? 'approved' : 'rejected'} ✓`,
                icon: '/beevo-icon-192.png',
                tag: 'beevo-confirmation'
            });
        }
    } catch (e) {
        console.error('[SW] Failed to resolve intervention:', e);
    }
}

// Listen for messages from the main app
self.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('activate', function (event) {
    console.log('[SW] Activated');
    event.waitUntil(clients.claim());
});
