/**
 * Shared Configuration
 * 
 * Centralizes URLs and environment-specific settings to avoid hardcoded localhost references.
 */

// Deployment Environment Detection
export const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.VITE_PROD;

// Base URLs
export const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
        // Client-side: use the current origin
        return window.location.origin;
    }
    // Server-side: use environment variable or fallback
    return process.env.SELF_URL || 'http://localhost:3001';
};

export const getWsUrl = () => {
    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        if (IS_PRODUCTION) {
            return `${protocol}//${window.location.host}`;
        }
        return process.env.WS_URL || `${protocol}//${window.location.hostname}:3001`;
    }
    return process.env.WS_URL || 'ws://localhost:3001';
};

// API Endpoints
export const API_BASE = '/api';
export const WS_PATH = '/ws';

export const CONFIG = {
    API_URL: IS_PRODUCTION ? API_BASE : `http://localhost:3001${API_BASE}`,
    WS_URL: getWsUrl(),
    // For agents (Puppeteer) to point back to the client
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
};
