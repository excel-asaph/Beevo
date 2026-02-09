import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interface definition for the Workspace Context.
 */
interface WorkspaceContextType {
    /** The current active workspace ID (defaults to 'default'). */
    workspaceId: string;
    /** The persistent user ID (stored in localStorage). */
    userId: string;
    /** Switch the active workspace. */
    setWorkspaceId: (id: string) => void;
    /** Manually set/override the user ID. */
    setUserId: (id: string) => void;
    /** Resolves a relative asset path to a full URL based on the workspace. */
    resolveAssetUrl: (url: string | undefined) => string;
    /** Generates a workspace ID string from a brand name and user ID. */
    getWorkspaceForBrand: (brandName: string, customUserId?: string) => string;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

/**
 * Context Provider for Workspace management.
 * 
 * Features:
 * - Persists User ID in localStorage.
 * - Persists Active Workspace in sessionStorage and URL search params.
 * - Provides utilities for asset URL resolution (scoped to workspace).
 * - Generates consistent workspace IDs based on user and brand name.
 */
export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Persistent User ID (Resident on browser)
    const [userId, setUserIdState] = useState<string>(() => {
        const saved = localStorage.getItem('beevo_user_id');
        if (saved) return saved;
        const newId = uuidv4().slice(0, 8).toUpperCase(); // Short persistent ID, uppercase for readability
        localStorage.setItem('beevo_user_id', newId);
        return newId;
    });

    const setUserId = (id: string) => {
        const cleanId = id.trim().toUpperCase();
        setUserIdState(cleanId);
        localStorage.setItem('beevo_user_id', cleanId);
    };

    const [workspaceId, setWorkspaceId] = useState<string>(() => {
        const params = new URLSearchParams(window.location.search);
        const ws = params.get('workspace');
        if (ws) return ws;
        const saved = sessionStorage.getItem('active_workspace');
        return saved || 'default';
    });

    useEffect(() => {
        // Sync to session storage if it was found in URL
        if (workspaceId !== 'default') {
            sessionStorage.setItem('active_workspace', workspaceId);
        }
    }, [workspaceId]);

    const updateWorkspace = (id: string) => {
        setWorkspaceId(id);
        sessionStorage.setItem('active_workspace', id);
        const url = new URL(window.location.href);
        url.searchParams.set('workspace', id);
        window.history.pushState({}, '', url);
    };

    // Helper: Map Brand Name + User ID to folder name
    // Format: user_brand (slugified)
    const getWorkspaceForBrand = useCallback((brandName: string, customUserId?: string): string => {
        const targetUserId = customUserId || userId;
        const slug = brandName
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        if (!slug) return 'default';
        return `${targetUserId}_${slug}`;
    }, [userId]);

    const resolveAssetUrl = (url: string | undefined): string => {
        if (!url) return '';
        if (url.startsWith('http') || url.startsWith('data:')) return url;
        // Scoped asset resolution: ensure path is /workspaces/:id/assets/...
        const cleanUrl = url.startsWith('/') ? url : `/${url}`;
        if (cleanUrl.startsWith('/workspaces/')) return cleanUrl;
        return `/workspaces/${workspaceId}${cleanUrl}`;
    };

    return (
        <WorkspaceContext.Provider value={{
            workspaceId,
            userId,
            setWorkspaceId: updateWorkspace,
            setUserId,
            resolveAssetUrl,
            getWorkspaceForBrand
        }}>
            {children}
        </WorkspaceContext.Provider>
    );
};

export const useWorkspace = () => {
    const context = useContext(WorkspaceContext);
    if (!context) throw new Error("useWorkspace must be used within WorkspaceProvider");
    return context;
};
