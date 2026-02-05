export const apiGenerateLogos = async (workspaceId: string, context?: string) => {
    const res = await fetch('/api/logos/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': workspaceId
        },
        body: JSON.stringify({ context })
    });
    if (!res.ok) throw new Error("Generation failed");
    return res.json();
};

export const apiFinalizeLogos = async (workspaceId: string) => {
    const res = await fetch('/api/logos/finalize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': workspaceId
        }
    });
    if (!res.ok) throw new Error("Finalization failed");
    return res.json();
};
