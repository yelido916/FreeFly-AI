const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3001;

// Ensure server directory exists for db file
const dbDir = __dirname;
if (!fs.existsSync(dbDir)){
    fs.mkdirSync(dbDir);
}
const dbPath = path.resolve(dbDir, 'inkflow.db');

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Support large payloads (images)

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Could not connect to database', err);
    else console.log('Connected to SQLite database at ' + dbPath);
});

// Initialize Tables
db.serialize(() => {
    // Novels table - storing full JSON blob for simplicity in this migration
    db.run(`CREATE TABLE IF NOT EXISTS novels (
        id TEXT PRIMARY KEY,
        data TEXT,
        updatedAt INTEGER
    )`);

    // Prompts table
    db.run(`CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        data TEXT
    )`);

    // Categories table
    db.run(`CREATE TABLE IF NOT EXISTS prompt_categories (
        name TEXT PRIMARY KEY
    )`);

    // Stats table (Single row for global stats)
    db.run(`CREATE TABLE IF NOT EXISTS stats (
        id TEXT PRIMARY KEY,
        data TEXT
    )`);
    
    // Insert default categories if empty
    const defaults = ['脑洞', '大纲', '卷纲', '细纲', '正文', '简介', '人物', '书名'];
    defaults.forEach(cat => {
        db.run("INSERT OR IGNORE INTO prompt_categories (name) VALUES (?)", [cat]);
    });
});

// --- API Routes ---

// 1. Novels
app.get('/api/novels', (req, res) => {
    db.all("SELECT data FROM novels ORDER BY updatedAt DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const novels = rows.map(row => JSON.parse(row.data));
        res.json(novels);
    });
});

app.get('/api/novels/:id', (req, res) => {
    db.get("SELECT data FROM novels WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Novel not found" });
        res.json(JSON.parse(row.data));
    });
});

app.post('/api/novels', (req, res) => {
    const novel = req.body;
    if (!novel.id) return res.status(400).json({ error: "Missing ID" });
    const data = JSON.stringify(novel);
    
    db.run("INSERT OR REPLACE INTO novels (id, data, updatedAt) VALUES (?, ?, ?)", 
        [novel.id, data, novel.updatedAt], 
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

app.delete('/api/novels/:id', (req, res) => {
    db.run("DELETE FROM novels WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// 2. Prompts
app.get('/api/prompts', (req, res) => {
    db.all("SELECT data FROM prompts", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const prompts = rows.map(row => JSON.parse(row.data));
        res.json(prompts);
    });
});

app.post('/api/prompts', (req, res) => {
    const prompt = req.body;
    const data = JSON.stringify(prompt);
    db.run("INSERT OR REPLACE INTO prompts (id, data) VALUES (?, ?)", [prompt.id, data], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/prompts/:id', (req, res) => {
    db.run("DELETE FROM prompts WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// 3. Categories
app.get('/api/prompt-categories', (req, res) => {
    db.all("SELECT name FROM prompt_categories", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => r.name));
    });
});

app.post('/api/prompt-categories', (req, res) => {
    const { name } = req.body;
    db.run("INSERT OR IGNORE INTO prompt_categories (name) VALUES (?)", [name], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/prompt-categories/:name', (req, res) => {
    db.run("DELETE FROM prompt_categories WHERE name = ?", [req.params.name], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// 4. Stats
app.get('/api/stats', (req, res) => {
    db.get("SELECT data FROM stats WHERE id = 'global'", [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.json({ totalInputTokens: 0, totalOutputTokens: 0, dailyStats: {} });
        res.json(JSON.parse(row.data));
    });
});

app.post('/api/stats', (req, res) => {
    const stats = req.body;
    const data = JSON.stringify(stats);
    db.run("INSERT OR REPLACE INTO stats (id, data) VALUES ('global', ?)", [data], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.listen(port, () => {
    console.log(`FreeFly AI Server running at http://localhost:${port}`);
});
