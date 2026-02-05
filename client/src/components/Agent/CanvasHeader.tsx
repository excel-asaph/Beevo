import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, Wifi, WifiOff } from 'lucide-react';
import { useBrandStore } from '../../stores/useBrandStore';
import { WatcherSettings } from '../Architect/WatcherSettings';

interface CanvasHeaderProps {
    onBack?: () => void;
    connectionStatus: 'connected' | 'disconnected';
    isControlCenterOpen?: boolean;
    onToggleControlCenter?: () => void;
}

export const CanvasHeader: React.FC<CanvasHeaderProps> = ({ onBack, connectionStatus, isControlCenterOpen, onToggleControlCenter }) => {
    const { projectName, setProjectName } = useBrandStore();
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(projectName);
    const [isHoveringTitle, setIsHoveringTitle] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync local state with store value when not editing
    useEffect(() => {
        if (!isEditing) {
            setEditValue(projectName);
        }
    }, [projectName, isEditing]);

    const handleStartEditing = () => {
        setIsEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleSave = () => {
        if (editValue.trim()) {
            setProjectName(editValue);
        } else {
            setEditValue(projectName);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setEditValue(projectName);
            setIsEditing(false);
        }
    };

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

                    {/* Project Title with Popover Tooltip */}
                    <div className="relative">
                        <AnimatePresence>
                            {isEditing ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="px-2"
                                >
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onBlur={handleSave}
                                        onKeyDown={handleKeyDown}
                                        className="bg-gray-100 border-none outline-none focus:ring-2 focus:ring-blue-500/20 rounded-md px-2 py-1 text-sm font-medium text-gray-700 min-w-[120px]"
                                    />
                                </motion.div>
                            ) : (
                                <motion.div
                                    onMouseEnter={() => setIsHoveringTitle(true)}
                                    onMouseLeave={() => setIsHoveringTitle(false)}
                                    onClick={handleStartEditing}
                                    className="group relative cursor-pointer px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-all duration-200"
                                >
                                    <span className="text-sm font-medium text-gray-700 select-none">
                                        {projectName}
                                    </span>

                                    {/* Tooltip Overlay (matching image 2 style) */}
                                    <AnimatePresence>
                                        {isHoveringTitle && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10, x: '-50%' }}
                                                animate={{ opacity: 1, y: 0, x: '-50%' }}
                                                exit={{ opacity: 0, y: 5, x: '-50%' }}
                                                transition={{ duration: 0.15 }}
                                                className="absolute top-full left-1/2 mt-2 px-3 py-1.5 bg-white text-gray-700 text-[11px] font-medium rounded-lg whitespace-nowrap shadow-xl z-[110] border border-gray-100"
                                            >
                                                Click to rename
                                                {/* Tooltip Arrow */}
                                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-t border-l border-gray-100 rotate-45" />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Right Section: Watcher, Status, Studio */}
            <div className="flex items-center space-x-3">
                <WatcherSettings />

                {/* Connection Status */}
                <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${connectionStatus === 'connected'
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    : 'bg-red-50 text-red-600 border border-red-100'
                    }`}>
                    {connectionStatus === 'connected' ? <Wifi size={14} /> : <WifiOff size={14} />}
                    <span>{connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}</span>
                </div>

                {/* Logo Studio / Agent Canvas Button */}
                <button className="flex items-center space-x-2 px-3.5 py-1.5 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-lg shadow-sm transition-all text-gray-700 group">
                    <Sparkles className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-semibold">Logo Studio</span>
                </button>

                {/* Control Center Toggle Orb */}
                <motion.button
                    onClick={onToggleControlCenter}
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
