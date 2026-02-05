import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, ChevronDown, Folder } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

interface Workspace {
    id: string;
    name: string;
    lastActive: string;
}

export const WorkspaceSwitcher: React.FC = () => {
    const { workspaceId, setWorkspaceId } = useWorkspace();
    const [isOpen, setIsOpen] = useState(false);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchWorkspaces();
        }
    }, [isOpen]);

    const fetchWorkspaces = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('http://localhost:3000/api/workspaces');
            const data = await res.json();
            setWorkspaces(data);
        } catch (error) {
            console.error('Failed to fetch workspaces:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateNew = () => {
        const name = window.prompt('Enter brand name:');
        if (!name) return;

        const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (!id) return;

        setWorkspaceId(id);
        setIsOpen(false);

        // Refresh page to ensure clean state
        window.location.href = `/?workspace=${id}&skip_discovery=true`;
    };

    const handleSwitch = (id: string) => {
        setWorkspaceId(id);
        setIsOpen(false);
        window.location.href = `/?workspace=${id}`;
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-all text-gray-700 shadow-sm"
            >
                <Folder size={16} className="text-blue-500" />
                <span className="text-xs font-semibold truncate max-w-[120px]">
                    {workspaceId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-[110]"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 5, scale: 0.95 }}
                            className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-[120]"
                        >
                            <div className="p-2 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2">
                                    Your Brands
                                </span>
                            </div>

                            <div className="max-h-64 overflow-y-auto p-1">
                                {isLoading ? (
                                    <div className="p-4 text-center">
                                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                                    </div>
                                ) : (
                                    workspaces.map((ws) => (
                                        <button
                                            key={ws.id}
                                            onClick={() => handleSwitch(ws.id)}
                                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 rounded-lg transition-colors group"
                                        >
                                            <div className="flex items-center space-x-3">
                                                <div className={`w-2 h-2 rounded-full ${ws.id === workspaceId ? 'bg-blue-500' : 'bg-gray-300'}`} />
                                                <div className="flex flex-col items-start">
                                                    <span className={`text-sm font-medium ${ws.id === workspaceId ? 'text-blue-700' : 'text-gray-700'}`}>
                                                        {ws.name}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400">
                                                        ID: {ws.id}
                                                    </span>
                                                </div>
                                            </div>
                                            {ws.id === workspaceId && <Check size={14} className="text-blue-500" />}
                                        </button>
                                    ))
                                )}
                            </div>

                            <div className="p-1 border-t border-gray-50">
                                <button
                                    onClick={handleCreateNew}
                                    className="w-full flex items-center space-x-3 px-3 py-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <Plus size={18} />
                                    </div>
                                    <span className="text-sm font-semibold">New Brand Workspace</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
