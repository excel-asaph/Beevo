-- Page States Table: Stores snapshots of the web page for rollback and history.
CREATE TABLE IF NOT EXISTS page_states (
    state_hash TEXT PRIMARY KEY,
    snapshot TEXT NOT NULL,
    media_refs TEXT,
    metrics TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Lead Submissions Table: Stores form submissions from the landing page.
CREATE TABLE IF NOT EXISTS lead_submissions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    form_data TEXT NOT NULL,
    page_state_hash TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Workspace State Table: Stores the current state of the design workspace (canvas, UI).
CREATE TABLE IF NOT EXISTS workspace_state (
    id TEXT PRIMARY KEY, -- 'canvas_layout' | 'ui_state'
    data TEXT NOT NULL,   -- JSON
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Session History Table: Stores the chat history between user and AI models.
CREATE TABLE IF NOT EXISTS session_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL, -- 'user' | 'model' | 'thinking'
    content TEXT NOT NULL,
    metadata TEXT, -- JSON (e.g., confidence, thinking phase)
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
