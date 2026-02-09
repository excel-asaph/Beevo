import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, Wifi, WifiOff, Bell } from 'lucide-react';
import { useBrandStore } from '../../stores/useBrandStore';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { useWorkspace } from '../../context/WorkspaceContext';

/**
 * Props for the CanvasHeader component.
 */
interface CanvasHeaderProps {
    /** Callback function to handle the "Back" action. */
    onBack?: () => void;
    /** Current connection status of the application (e.g., WebSocket status). */
    connectionStatus: 'connected' | 'disconnected';
    /** Whether the Control Center panel is currently open. Controls the active state of the toggle button. */
    isControlCenterOpen?: boolean;
    /** Callback to open the Activity Feed (Control Center). */
    onOpenActivityFeed?: () => void;
}

/**
 * The top navigation header for the Agent Canvas.
 * 
 * Displays:
 * - Back navigation.
 * - Breadcrumbs showing the current Workspace and Project.
 * - System connection status.
 * - Notification bell for pending interventions.
 * - Toggle for the Control Center / Activity Feed.
 * 
 * @param {CanvasHeaderProps} props - The component props.
 */
export const CanvasHeader: React.FC<CanvasHeaderProps> = ({ onBack, connectionStatus, isControlCenterOpen, onOpenActivityFeed }) => {
    const { projectName, setProjectName, pendingInterventions, setCommandCenterTab, setIsCommandCenterOpen } = useBrandStore();
    const { workspaceId } = useWorkspace();

    // Auto-Populate Project Name from Workspace ID if "Untitled" (On Reload)
    useEffect(() => {
        if ((projectName === 'Untitled' || !projectName) && workspaceId && workspaceId !== 'default') {
            let readableName = workspaceId;
            // Handle "userId_brandName" format
            if (workspaceId.includes('_')) {
                readableName = workspaceId.split('_').slice(1).join(' ');
            }
            // Capitalize and replace hyphens with spaces
            readableName = readableName
                .split('-')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');

            setProjectName(readableName);
        }
    }, [workspaceId, projectName, setProjectName]);


    return (
        <div className="w-full h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 flex items-center justify-between z-[100] shrink-0">
            {/* Left Section: Back, Brand, Project */}
            <div className="flex items-center space-x-4">
                {/* Back Button */}
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-900"
                >
                    <ArrowLeft size={20} />
                </button>

                {/* Brand Logo */}
                <div className="flex items-center">
                    <span className="text-[#2563eb] font-black italic text-xl tracking-tighter select-none cursor-default">
                        BEEVO
                    </span>
                    <span className="mx-4 text-gray-300 font-light select-none">/</span>

                    <WorkspaceSwitcher />

                    <span className="mx-4 text-gray-300 font-light select-none">/</span>

                    {/* Project Title (Read-Only) */}
                    <div className="px-3 py-1.5 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700 select-none cursor-default">
                            {projectName || 'Untitled Project'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Right Section: Watcher, Status, Studio (Now Simplified) */}
            <div className="flex items-center space-x-3">
                {/* Connection Status - Static */}
                <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${connectionStatus === 'connected'
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    : 'bg-red-50 text-red-600 border border-red-100'
                    }`}>
                    {connectionStatus === 'connected' ? <Wifi size={14} /> : <WifiOff size={14} />}
                    <span>{connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}</span>
                </div>

                {/* Notification Bell (Interventions) */}
                <motion.button
                    onClick={() => {
                        setCommandCenterTab('interventions');
                        setIsCommandCenterOpen(true);
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative w-9 h-9 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                >
                    <Bell size={18} />
                    {/* Badge */}
                    {pendingInterventions.length > 0 && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white"
                        >
                            {pendingInterventions.length}
                        </motion.div>
                    )}
                </motion.button>

                {/* Control Center Toggle Orb (Sparkles) - Activity Feed */}
                <motion.button
                    onClick={onOpenActivityFeed}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all ${isControlCenterOpen
                        ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white'
                        : 'bg-gradient-to-br from-orange-500 to-amber-500 text-white hover:from-orange-400 hover:to-amber-400'
                        }`}
                >
                    <motion.div
                        animate={{ rotate: isControlCenterOpen ? 45 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Sparkles size={16} strokeWidth={2.5} />
                    </motion.div>
                </motion.button>
            </div>
        </div>
    );
};
