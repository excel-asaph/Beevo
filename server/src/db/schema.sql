CREATE TABLE IF NOT EXISTS page_states (
    state_hash TEXT PRIMARY KEY,
    snapshot TEXT NOT NULL,
    media_refs TEXT,
    metrics TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lead_submissions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    form_data TEXT NOT NULL,
    page_state_hash TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
