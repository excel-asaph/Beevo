import { useState, useEffect } from 'react';
import { SystemConfig } from '../../../shared/types';

export const useConfig = () => {
    const [config, setConfig] = useState<SystemConfig | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchConfig = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/config');
            if (res.ok) {
                const data = await res.json();

                // Deep Compare to prevent re-renders (Phantom Event Fix)
                setConfig(prev => {
                    if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
                    return data;
                });
            }
        } catch (error) {
            console.error("Failed to fetch config:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
        // Optionally: Poll or use WebSockets for real-time config updates
        const interval = setInterval(fetchConfig, 30000); // 30s poll
        return () => clearInterval(interval);
    }, []);

    return { config, loading, refresh: fetchConfig };
};
