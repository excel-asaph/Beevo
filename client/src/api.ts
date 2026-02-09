/**
 * Triggers logo generation (Agentic Pipeline) for a workspace.
 * 
 * @param {string} workspaceId - The target workspace.
 * @param {string} context - Optional user context/overrides.
 * @returns {Promise<any>} Response from the generation endpoint.
 */
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

/**
 * Finalizes the logo selection and packages the assets.
 * 
 * @param {string} workspaceId - The target workspace.
 * @returns {Promise<any>} Response from the finalization endpoint.
 */
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
