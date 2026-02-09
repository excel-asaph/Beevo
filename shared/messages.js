// WebSocket message types for client-server communication
// ============================================
// MESSAGE HELPERS
// ============================================
export function isClientMessage(msg) {
    return msg && typeof msg.type === 'string' && [
        'START_SESSION', 'END_SESSION', 'AUDIO_CHUNK',
        'TEXT_INPUT', 'SELECTION_EVENT', 'UPDATE_DNA', 'INTERRUPT', 'FILE_UPLOAD'
    ].includes(msg.type);
}
export function isServerMessage(msg) {
    return msg && typeof msg.type === 'string' && [
        'SESSION_STARTED', 'SESSION_ENDED', 'AUDIO_CHUNK',
        'TRANSCRIPTION', 'FONT_SUGGESTIONS', 'COLOR_SUGGESTIONS',
        'DNA_UPDATE', 'PROGRESS_UPDATE', 'THOUGHT', 'ERROR', 'CONNECTION_STATUS',
        'INTERRUPT', 'TOOL_PROCESSING_START', 'TOOL_PROCESSING_END',
        'INTERRUPT', 'TOOL_PROCESSING_START', 'TOOL_PROCESSING_END',
        'THINKING_START', 'THINKING_STREAM', 'THINKING_END', 'UI_STATE_CHANGE',
        'COMPETITIVE_ANALYSIS', 'LOGO_CONCEPTS', 'AUDIT_RESULT',
        'LOGO_RESEARCH_PROGRESS', 'LOGO_RESEARCH_RESULT',
        'LOGO_STRUCTURE_OPTIONS', 'IMAGERY_SUGGESTIONS', 'VAULT_UPDATE',
        'LOGO_STRUCTURE_OPTIONS', 'IMAGERY_SUGGESTIONS', 'VAULT_UPDATE',
        'LOGO_STRUCTURE_OPTIONS', 'IMAGERY_SUGGESTIONS', 'VAULT_UPDATE',
        'RESEARCH_UPDATE', 'THOUGHT_SIGNATURE', 'FULL_STATE_UPDATE', 'RESEARCH_COMPLETE',
        'INTERVENTION_REQUIRED', 'STATE_UPDATE', 'ASSET_UPDATE'
    ].includes(msg.type);
}
//# sourceMappingURL=messages.js.map