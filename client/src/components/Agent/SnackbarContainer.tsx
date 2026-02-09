import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { Snackbar, SnackbarItem } from './Snackbar';
import { useBrandStore } from '../../stores/useBrandStore';

const MAX_VISIBLE_SNACKBARS = 3;

/**
 * Container for managing and rendering the stack of Snackbar notifications.
 * 
 * Features:
 * - Subscribes to the global `BrandStore` for the snackbar queue.
 * - Limits the number of visible snackbars to `MAX_VISIBLE_SNACKBARS` (3).
 * - Handless navigation to interventions when an intervention snackbar is clicked.
 * - Displays a count of hidden/queued snackbars if the limit is exceeded.
 */
export const SnackbarContainer: React.FC = () => {
    const snackbarQueue = useBrandStore(state => state.snackbarQueue);
    const removeSnackbar = useBrandStore(state => state.removeSnackbar);
    const setIsCommandCenterOpen = useBrandStore(state => state.setIsCommandCenterOpen);
    const setCommandCenterTab = useBrandStore(state => state.setCommandCenterTab);
    const setFocusedInterventionId = useBrandStore(state => state.setFocusedInterventionId);

    // Only show the first N snackbars
    const visibleSnackbars = snackbarQueue.slice(0, MAX_VISIBLE_SNACKBARS);

    const handleSnackbarClick = (item: SnackbarItem) => {
        // Open Command Center and navigate to interventions
        if (item.type === 'intervention' && item.interventionId) {
            setFocusedInterventionId(item.interventionId);
            setCommandCenterTab('interventions');
            setIsCommandCenterOpen(true);
        } else {
            // For other types, just open Command Center
            setIsCommandCenterOpen(true);
        }

        // Dismiss this snackbar
        removeSnackbar(item.id);
    };

    const handleDismiss = (id: string) => {
        removeSnackbar(id);
    };

    return (
        <div className="fixed top-4 right-4 z-[900] flex flex-col gap-3 pointer-events-none">
            <AnimatePresence mode="popLayout">
                {visibleSnackbars.map((item) => (
                    <div key={item.id} className="pointer-events-auto">
                        <Snackbar
                            item={item}
                            onDismiss={handleDismiss}
                            onClick={handleSnackbarClick}
                        />
                    </div>
                ))}
            </AnimatePresence>

            {/* Queue indicator if there are more snackbars */}
            {snackbarQueue.length > MAX_VISIBLE_SNACKBARS && (
                <div className="text-xs text-gray-400 text-right pr-2 pointer-events-auto">
                    +{snackbarQueue.length - MAX_VISIBLE_SNACKBARS} more
                </div>
            )}
        </div>
    );
};

export default SnackbarContainer;
