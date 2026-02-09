import React, { useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Image, Video, File } from 'lucide-react';

/**
 * Props for the DropZone component.
 */
interface DropZoneProps {
    /** Whether a file is currently being dragged over the zone. */
    isDragOver: boolean;
    /** Callback for dragover event. */
    onDragOver: (e: React.DragEvent) => void;
    /** Callback for dragleave event. */
    onDragLeave: () => void;
    /** Callback for drop event. */
    onDrop: (e: React.DragEvent) => void;
    /** Callback triggered when files are selected via the file dialog. */
    onFileSelect?: (files: File[]) => void;
    /** List of accepted file (extensions without dot). Defaults to common media/doc types. */
    acceptedTypes?: string[];
    /** Additional CSS classes. */
    className?: string;
}

/**
 * Helper function to get the appropriate icon for a file based on its extension.
 * 
 * @param {string} filename - The name of the file.
 * @returns {React.ReactNode} The Lucide icon component.
 */
export const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'pdf':
            return <FileText className="w-5 h-5" />;
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'webp':
            return <Image className="w-5 h-5" />;
        case 'mp4':
        case 'webm':
        case 'mov':
            return <Video className="w-5 h-5" />;
        default:
            return <File className="w-5 h-5" />;
    }
};

/**
 * A draggable file upload zone component.
 * 
 * Supports drag-and-drop interactions as well as clicking to open the native file dialog.
 * Handles visual feedback for drag states.
 * 
 * @param {DropZoneProps} props - The component props.
 */
export const DropZone: React.FC<DropZoneProps> = ({
    isDragOver,
    onDragOver,
    onDragLeave,
    onDrop,
    onFileSelect,
    acceptedTypes = ['pdf', 'png', 'jpg', 'jpeg', 'mp4', 'webm'],
    className = ''
}) => {
    // Use a ref just in case, but label should handle it
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        console.log('Files selected:', files.length);
        if (files.length > 0 && onFileSelect) {
            onFileSelect(files);
        }
        // Reset input so same file can be selected again
        e.target.value = '';
    }, [onFileSelect]);

    const acceptedTypesDisplay = useMemo(() => {
        return acceptedTypes.map(t => t.toUpperCase()).join(', ');
    }, [acceptedTypes]);

    const acceptString = useMemo(() => {
        return acceptedTypes.map(t => `.${t}`).join(',');
    }, [acceptedTypes]);

    return (
        <motion.label
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            animate={{
                borderColor: isDragOver ? 'rgb(99, 102, 241)' : 'rgba(100, 116, 139, 0.3)',
                backgroundColor: isDragOver ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0)',
                scale: isDragOver ? 1.02 : 1
            }}
            whileHover={{
                borderColor: 'rgba(99, 102, 241, 0.5)',
                backgroundColor: 'rgba(99, 102, 241, 0.05)'
            }}
            transition={{ duration: 0.2 }}
            className={`
                relative z-50
                w-full max-w-2xl p-8 
                border-2 border-dashed rounded-2xl
                flex flex-col items-center justify-center
                cursor-pointer
                transition-all duration-300
                ${isDragOver ? 'border-indigo-500' : 'border-slate-700'}
                ${className}
            `}
        >
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={acceptString}
                onChange={handleFileChange}
                className="hidden"
            />

            {/* Icon */}
            <motion.div
                animate={{
                    y: isDragOver ? -8 : 0,
                    scale: isDragOver ? 1.2 : 1
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="pointer-events-none" // Prevent blocking clicks/drags
            >
                <Upload className={`w-10 h-10 mb-4 ${isDragOver ? 'text-indigo-400' : 'text-slate-500'}`} />
            </motion.div>

            {/* Text */}
            <div className="text-center pointer-events-none">
                <p className={`text-base font-medium mb-1 ${isDragOver ? 'text-indigo-300' : 'text-slate-400'}`}>
                    {isDragOver ? 'Release to upload' : 'Drop files here or click to browse'}
                </p>
                <p className={`text-sm ${isDragOver ? 'text-indigo-400/70' : 'text-slate-500'}`}>
                    Brand book, images, or videos
                </p>
                <p className="text-xs text-slate-600 mt-2">
                    {acceptedTypesDisplay} supported
                </p>
            </div>

            {/* Animated border glow on drag */}
            {isDragOver && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{
                        boxShadow: '0 0 40px rgba(99, 102, 241, 0.3), inset 0 0 20px rgba(99, 102, 241, 0.1)'
                    }}
                />
            )}
        </motion.label>
    );
};
