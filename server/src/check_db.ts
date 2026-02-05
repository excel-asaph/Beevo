
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkDB() {
    const args = process.argv.slice(2);
    const workspaceArg = args.find(a => a.startsWith('--workspace='));
    const workspaceId = workspaceArg ? workspaceArg.split('=')[1] : 'default';

    const DB_PATH = path.resolve(__dirname, `../brain/workspaces/${workspaceId}/beevo_history.db`);

    console.log(`📂 Opening Database for Workspace [${workspaceId}]: ${DB_PATH}`);
    try {
        const db = await open({
            filename: DB_PATH,
            driver: sqlite3.Database
        });

        console.log("\n📊 --- LATEST PAGE STATES ---");
        const states = await db.all('SELECT * FROM page_states ORDER BY timestamp DESC LIMIT 10');
        if (states.length === 0) {
            console.log("No states found.");
        } else {
            states.forEach((state, i) => {
                console.log(`\n[${i + 1}] Hash: ${state.state_hash}`);
                console.log(`    Timestamp: ${new Date(state.timestamp).toLocaleString()}`);
                console.log(`    Media Refs: ${state.media_refs ? state.media_refs.substring(0, 100) + '...' : 'None'}`);
                console.log(`    Snapshot (Preview): ${state.snapshot ? state.snapshot.substring(0, 150) + '...' : 'None'}`);
                try {
                    const meta = JSON.parse(state.metrics || '{}');
                    console.log(`    Message: ${meta.message || 'N/A'}`);
                } catch (e) { }
            });
        }

        console.log("\n📊 --- LATEST LEADS ---");
        const leads = await db.all('SELECT * FROM lead_submissions ORDER BY timestamp DESC LIMIT 10');
        if (leads.length === 0) {
            console.log("No leads found.");
        } else {
            leads.forEach((lead, i) => {
                console.log(`\n[${i + 1}] ID: ${lead.id}`);
                console.log(`    Type: ${lead.type}`);
                console.log(`    State Hash: ${lead.page_state_hash}`);
                console.log(`    Data: ${lead.form_data}`);
            });
        }

    } catch (e) {
        console.error("❌ Error reading database:", e);
    }
}

checkDB();
