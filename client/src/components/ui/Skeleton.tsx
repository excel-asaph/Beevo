
import React from 'react';


/**
 * Common props for Skeleton components.
 */
interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
}

/**
 * Base Shimmer Effect
 * A subtle, diagonal gradient animation that moves across the element.
 * 
 * Usage:
 * <div className="relative overflow-hidden bg-gray-100 rounded-lg">
 *   <Shimmer />
 *   ... content ...
 * </div>
 */
export const Shimmer: React.FC = () => (
    <div
        className="absolute inset-0 -translate-x-full animate-[shimmer-slide_2s_infinite]"
        style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.5) 50%, transparent 100%)',
        }}
    />
);

/**
 * Skeleton Container
 * The "Glassy" card background for loading states.
 */
export const SkeletonContainer: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
    <div className={`relative bg-white/40 backdrop-blur-sm border border-white/50 shadow-sm rounded-2xl overflow-hidden ${className}`}>
        {children}
    </div>
);

/**
 * Skeleton Block
 * A generic block (div) with the shimmer effect built-in.
 */
export const SkeletonBlock: React.FC<SkeletonProps & { children?: React.ReactNode }> = ({ className = "", style, children }) => (
    <div className={`relative overflow-hidden bg-gray-100/80 rounded-lg ${className}`} style={style}>
        <Shimmer />
        {children}
    </div>
);

/**
 * Skeleton Text
 * A pill-shaped block to represent text lines.
 */
export const SkeletonText: React.FC<SkeletonProps & { width?: string | number }> = ({ className = "", width = "100%", style }) => (
    <div
        className={`relative overflow-hidden bg-gray-200/60 rounded-full h-4 ${className}`}
        style={{ width, ...style }}
    >
        <Shimmer />
    </div>
);

/**
 * Skeleton Circle
 * Fully rounded block for avatars or icons.
 */
export const SkeletonCircle: React.FC<SkeletonProps & { size?: number }> = ({ className = "", size = 40, style }) => (
    <div
        className={`relative overflow-hidden bg-gray-200/60 rounded-full ${className}`}
        style={{ width: size, height: size, ...style }}
    >
        <Shimmer />
    </div>
);
