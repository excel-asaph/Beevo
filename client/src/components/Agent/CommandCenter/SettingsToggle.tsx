import React from 'react';
import { motion } from 'framer-motion';

/**
 * Props for the SettingsToggle component.
 */
interface SettingsToggleProps {
    /** The label text displayed next to the toggle. */
    label: string;
    /** Optional description text displayed below the label. */
    description?: string;
    /** The current state of the toggle (true = on, false = off). */
    checked: boolean;
    /** Callback function triggered when the toggle state changes. */
    onChange: (checked: boolean) => void;
    /** Whether the toggle is disabled. */
    disabled?: boolean;
}

/**
 * A reusable toggle switch component with descriptions and disabled state support.
 * Used for boolean settings throughout the application.
 * 
 * @param {SettingsToggleProps} props - The component props.
 */
export const SettingsToggle: React.FC<SettingsToggleProps> = ({
    label,
    description,
    checked,
    onChange,
    disabled = false
}) => {
    return (
        <div className={`flex items-center justify-between py-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex flex-col gap-0.5 max-w-[80%]">
                <span className="text-sm font-medium text-gray-200">{label}</span>
                {description && <span className="text-xs text-gray-400">{description}</span>}
            </div>

            <button
                onClick={() => !disabled && onChange(!checked)}
                className={`
                    relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50
                    ${checked ? 'bg-indigo-600' : 'bg-gray-700'}
                `}
            >
                <motion.div
                    className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm"
                    animate={{ x: checked ? 20 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
            </button>
        </div>
    );
};
