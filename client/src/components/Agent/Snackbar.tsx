import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Bell, AlertCircle, CheckCircle2, Info } from 'lucide-react';

/**
 * Represents a single notification item in the snackbar queue.
 */
export interface SnackbarItem {
    /** Unique identifier for the snackbar. */
    id: string;
    /** Short, bold title of the notification. */
    title: string;
    /** Detailed message body. */
    message: string;
    /** Optional section tag (e.g., "RESEARCH", "ERROR") displayed above the title. */
    section?: string;
    /** Visual style type of the snackbar. */
    type: 'info' | 'warning' | 'success' | 'intervention';
    /** ID of the associated intervention, if applicable (enables navigation). */
    interventionId?: string;
    /** Duration in milliseconds before auto-dismissal. Default is 7000ms. */
    duration?: number; // ms, default 7000
}

/**
 * Props for the Snackbar component.
 */
interface SnackbarProps {
    /** The snackbar data object to render. */
    item: SnackbarItem;
    /** Callback triggered when the snackbar is dismissed (timeout or close button). */
    onDismiss: (id: string) => void;
    /** Callback triggered when the snackbar body is clicked. */
    onClick?: (item: SnackbarItem) => void;
}

const typeConfig = {
    info: {
        icon: Info,
        iconColor: 'text-blue-500',
        borderColor: 'border-blue-200',
        bgAccent: 'bg-blue-50'
    },
    warning: {
        icon: AlertCircle,
        iconColor: 'text-amber-500',
        borderColor: 'border-amber-200',
        bgAccent: 'bg-amber-50'
    },
    success: {
        icon: CheckCircle2,
        iconColor: 'text-emerald-500',
        borderColor: 'border-emerald-200',
        bgAccent: 'bg-emerald-50'
    },
    intervention: {
        icon: Bell,
        iconColor: 'text-indigo-500',
        borderColor: 'border-indigo-200',
        bgAccent: 'bg-indigo-50'
    }
};

/**
 * A toast notification component with a progress bar and interruptible timer.
 * 
 * Features:
 * - varying styles based on `type` (info, warning, success, intervention).
 * - auto-dismissal with a visual progress bar.
 * - pause-on-hover (implicit via interaction logic, though strictly this implementation resets on unmount).
 * - click-to-action support.
 * 
 * @param {SnackbarProps} props - The component props.
 */
export const Snackbar: React.FC<SnackbarProps> = ({ item, onDismiss, onClick }) => {
    const [progress, setProgress] = useState(100);
    const duration = item.duration || 7000;
    const config = typeConfig[item.type] || typeConfig.info;
    const Icon = config.icon;

    useEffect(() => {
        const startTime = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(remaining);

            if (remaining <= 0) {
                clearInterval(interval);
                onDismiss(item.id);
            }
        }, 50);

        return () => clearInterval(interval);
    }, [item.id, duration, onDismiss]);

    const handleClick = () => {
        if (onClick) {
            onClick(item);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={handleClick}
            className={`
                relative w-[360px] bg-white rounded-xl shadow-lg border ${config.borderColor}
                overflow-hidden cursor-pointer group
                hover:shadow-xl hover:scale-[1.02] transition-all duration-200
            `}
        >
            {/* Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
                <motion.div
                    className="h-full bg-gradient-to-r from-indigo-400 to-blue-500"
                    initial={{ width: '100%' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.05, ease: 'linear' }}
                />
            </div>

            <div className="p-4 pr-10">
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`p-2 rounded-lg ${config.bgAccent} flex-shrink-0`}>
                        <Icon size={18} className={config.iconColor} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            {item.section && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">
                                    {item.section}
                                </span>
                            )}
                            <h4 className="text-sm font-semibold text-gray-900 truncate">
                                {item.title}
                            </h4>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                            {item.message}
                        </p>
                    </div>
                </div>
            </div>

            {/* Dismiss Button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(item.id);
                }}
                className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors opacity-0 group-hover:opacity-100"
            >
                <X size={14} />
            </button>

            {/* Click hint */}
            <div className="absolute bottom-3 right-3 text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                Click to view
            </div>
        </motion.div>
    );
};

export default Snackbar;
