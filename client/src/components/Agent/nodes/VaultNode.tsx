import React, { useCallback, useState } from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Database, FileText, UploadCloud, Shield, Lock } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

export interface VaultNodeData {
    label: string;
    fileCount?: number;
    totalTokens?: number;
    isIngesting?: boolean;
    onUpload?: (files: File[]) => void;
}

export const VaultNode: React.FC<NodeProps> = ({ data, selected }) => {
    const nodeData = data as unknown as VaultNodeData;
    const [isDragActive, setIsDragActive] = useState(false);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        setIsDragActive(false);
        if (acceptedFiles.length > 0) {
            nodeData.onUpload?.(acceptedFiles);
        }
    }, [nodeData]);

    const { getRootProps, getInputProps, isDragAccept } = useDropzone({
        onDrop,
        onDragEnter: () => setIsDragActive(true),
        onDragLeave: () => setIsDragActive(false),
        noClick: false,
        noKeyboard: true,
        accept: {
            'application/pdf': ['.pdf'],
            'text/plain': ['.txt', '.md'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
        }
    });

    return (
        <div
            {...getRootProps()}
            className={`
                w-64 relative group rounded-xl transition-all duration-300 overflow-hidden
                ${selected ? 'ring-4 ring-indigo-500/20' : ''}
                ${isDragActive ? 'scale-105 shadow-2xl shadow-indigo-500/30' : 'shadow-lg'}
            `}
        >
            <input {...getInputProps()} />

            {/* Glass/Metallic container background */}
            <div className={`
                absolute inset-0 backdrop-blur-xl border border-white/10
                ${isDragActive
                    ? 'bg-gradient-to-br from-indigo-900/90 to-slate-900/90'
                    : 'bg-gradient-to-br from-slate-800/95 to-slate-950/95'
                }
            `} />

            {/* Content */}
            <div className="relative p-5 flex flex-col items-center justify-center text-center h-full min-h-[160px]">

                {/* Icon Core */}
                <div className="relative mb-3">
                    <div className={`absolute inset-0 bg-indigo-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full`} />
                    <div className={`
                        w-12 h-12 rounded-xl flex items-center justify-center border border-white/10
                        bg-gradient-to-br from-slate-700 to-slate-800 shadow-inner
                    `}>
                        {nodeData.isIngesting ? (
                            <UploadCloud className="w-6 h-6 text-indigo-400 animate-pulse" />
                        ) : (
                            <Database className="w-6 h-6 text-slate-300" />
                        )}
                    </div>
                    {/* Security Badge */}
                    <div className="absolute -bottom-2 -right-2 bg-slate-900 rounded-full p-1 border border-slate-700">
                        <Lock className="w-3 h-3 text-emerald-400" />
                    </div>
                </div>

                {/* Text */}
                <h3 className="text-slate-100 font-semibold mb-1 tracking-wide">Brand Vault</h3>
                <p className="text-xs text-slate-400 mb-3">
                    {nodeData.isIngesting
                        ? 'Ingesting 1M Tokens...'
                        : 'Drop Brand Assets Here'
                    }
                </p>

                {/* Stats */}
                {(nodeData.fileCount || 0) > 0 && (
                    <div className="w-full bg-slate-900/50 rounded-lg p-2 flex items-center justify-between border border-white/5">
                        <div className="flex items-center gap-1.5">
                            <FileText className="w-3 h-3 text-indigo-400" />
                            <span className="text-xs text-slate-300">{nodeData.fileCount} Files</span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-500/80">
                            ~{((nodeData.totalTokens || 0) / 1000).toFixed(0)}k Tokens
                        </span>
                    </div>
                )}
            </div>

            {/* Handles for connecting ideas */}
            <Handle type="target" position={Position.Top} className="!bg-slate-500/50 !w-3 !h-3 !border-0" />
            <Handle type="source" position={Position.Bottom} className="!bg-slate-500/50 !w-3 !h-3 !border-0" />
        </div>
    );
};
