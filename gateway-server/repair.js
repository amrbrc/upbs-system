const db = require('./db');

async function repair() {
    console.log("Connecting to database and repairing table 'inbox'...");
    try {
        const [result] = await db.query("REPAIR TABLE inbox");
        console.log("Repair result:");
        console.table(result);
        process.exit(0);
    } catch (err) {
        console.error("Failed to repair table:", err.message);
        process.exit(1);
    }
}

repair();
