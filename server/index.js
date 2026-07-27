import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import 'express-async-errors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const DB_PATH = path.join(DATA_DIR, 'feedback.db');
const PORT = process.env.PORT || 3000;
const app = express();
const upload = multer({ dest: UPLOAD_DIR });

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(UPLOAD_DIR, { recursive: true });

const db = await open({
  filename: DB_PATH,
  driver: sqlite3.Database
});

function now() {
  return new Date().toISOString();
}

async function ensureColumnExists(table, column, definition) {
  const row = await db.get(`PRAGMA table_info(${table}) WHERE name = ?`, column);
  if (!row) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function initDatabase() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shortDescription TEXT NOT NULL,
      longDescription TEXT NOT NULL,
      submitterName TEXT,
      submitterEmail TEXT,
      status TEXT NOT NULL DEFAULT 'New',
      feedbackType TEXT DEFAULT 'Unclassified',
      teamOwner TEXT DEFAULT '',
      actionOwner TEXT DEFAULT '',
      productName TEXT DEFAULT '',
      dueDateNextAction TEXT,
      dueDateCompletion TEXT,
      nextActions TEXT DEFAULT '',
      triageDecision TEXT DEFAULT 'Pending',
      triageComment TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  await ensureColumnExists('feedback', 'submitterEmail', 'TEXT');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feedbackId INTEGER NOT NULL,
      title TEXT NOT NULL,
      details TEXT,
      owner TEXT,
      dueDate TEXT,
      status TEXT DEFAULT 'Pending',
      result TEXT DEFAULT '',
      createdBy TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY(feedbackId) REFERENCES feedback(id) ON DELETE CASCADE
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feedbackId INTEGER NOT NULL,
      userName TEXT,
      eventType TEXT,
      note TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(feedbackId) REFERENCES feedback(id) ON DELETE CASCADE
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feedbackId INTEGER NOT NULL,
      originalName TEXT NOT NULL,
      storedName TEXT NOT NULL,
      mimeType TEXT,
      url TEXT NOT NULL,
      uploadedAt TEXT NOT NULL,
      FOREIGN KEY(feedbackId) REFERENCES feedback(id) ON DELETE CASCADE
    );
  `);
}

await initDatabase();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/api/feedback', async (req, res) => {
  const items = await db.all(`SELECT * FROM feedback ORDER BY createdAt DESC`);
  res.json(items);
});

app.get('/api/feedback/:id', async (req, res) => {
  const feedback = await db.get(`SELECT * FROM feedback WHERE id = ?`, req.params.id);
  if (!feedback) return res.status(404).json({ error: 'Feedback not found' });
  const actions = await db.all(`SELECT * FROM actions WHERE feedbackId = ? ORDER BY updatedAt DESC`, req.params.id);
  const history = await db.all(`SELECT * FROM history WHERE feedbackId = ? ORDER BY createdAt DESC`, req.params.id);
  const attachments = await db.all(`SELECT * FROM attachments WHERE feedbackId = ? ORDER BY uploadedAt DESC`, req.params.id);
  res.json({ feedback, actions, history, attachments });
});

app.post('/api/feedback', upload.array('attachments', 6), async (req, res) => {
  const {
    shortDescription,
    longDescription,
    submitterName,
    submitterEmail,
    feedbackType,
    productName
  } = req.body;

  const timestamp = now();
  const result = await db.run(
    `INSERT INTO feedback (shortDescription, longDescription, submitterName, submitterEmail, feedbackType, productName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    shortDescription,
    longDescription,
    submitterName || 'Anonymous',
    submitterEmail || '',
    feedbackType || 'Unclassified',
    productName || '',
    timestamp,
    timestamp
  );

  const feedbackId = result.lastID;

  if (req.files && req.files.length) {
    const attachmentStatements = req.files.map((file) => {
      const url = `/uploads/${file.filename}`;
      return db.run(
        `INSERT INTO attachments (feedbackId, originalName, storedName, mimeType, url, uploadedAt) VALUES (?, ?, ?, ?, ?, ?)`,
        feedbackId,
        file.originalname,
        file.filename,
        file.mimetype,
        url,
        timestamp
      );
    });
    await Promise.all(attachmentStatements);
  }

  await db.run(`INSERT INTO history (feedbackId, userName, eventType, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    feedbackId,
    submitterName,
    'Submitted',
    'Initial feedback submitted.',
    timestamp
  );

  const feedback = await db.get(`SELECT * FROM feedback WHERE id = ?`, feedbackId);
  res.status(201).json({ feedback });
});

app.put('/api/feedback/:id', async (req, res) => {
  const existing = await db.get(`SELECT * FROM feedback WHERE id = ?`, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Feedback not found' });

  const {
    status,
    feedbackType,
    teamOwner,
    actionOwner,
    productName,
    dueDateNextAction,
    dueDateCompletion,
    nextActions,
    triageDecision,
    triageComment
  } = req.body;

  const updatedAt = now();
  await db.run(`
    UPDATE feedback SET
      status = ?,
      feedbackType = ?,
      teamOwner = ?,
      actionOwner = ?,
      productName = ?,
      dueDateNextAction = ?,
      dueDateCompletion = ?,
      nextActions = ?,
      triageDecision = ?,
      triageComment = ?,
      updatedAt = ?
    WHERE id = ?
  `,
  status || existing.status,
  feedbackType || existing.feedbackType,
  teamOwner || existing.teamOwner,
  actionOwner || existing.actionOwner,
  productName || existing.productName,
  dueDateNextAction || existing.dueDateNextAction,
  dueDateCompletion || existing.dueDateCompletion,
  nextActions || existing.nextActions,
  triageDecision || existing.triageDecision,
  triageComment || existing.triageComment,
  updatedAt,
  req.params.id);

  await db.run(`INSERT INTO history (feedbackId, userName, eventType, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    req.params.id,
    req.body.managerName || 'Manager',
    'Updated',
    `Updated feedback fields: status=${status || existing.status}, owner=${actionOwner || existing.actionOwner}.`,
    updatedAt
  );

  const feedback = await db.get(`SELECT * FROM feedback WHERE id = ?`, req.params.id);
  res.json({ feedback });
});

app.post('/api/feedback/:id/attachments', upload.array('attachments', 6), async (req, res) => {
  const feedbackId = req.params.id;
  const existing = await db.get(`SELECT * FROM feedback WHERE id = ?`, feedbackId);
  if (!existing) return res.status(404).json({ error: 'Feedback not found' });

  const timestamp = now();
  const attachments = [];

  if (req.files && req.files.length) {
    for (const file of req.files) {
      const url = `/uploads/${file.filename}`;
      const stmt = await db.run(
        `INSERT INTO attachments (feedbackId, originalName, storedName, mimeType, url, uploadedAt) VALUES (?, ?, ?, ?, ?, ?)`,
        feedbackId,
        file.originalname,
        file.filename,
        file.mimetype,
        url,
        timestamp
      );
      attachments.push({ id: stmt.lastID, feedbackId, originalName: file.originalname, url, uploadedAt: timestamp });
    }
  }

  await db.run(`INSERT INTO history (feedbackId, userName, eventType, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    feedbackId,
    req.body.userName || 'Contributor',
    'Attachment added',
    `Added ${req.files.length} attachments.`,
    timestamp
  );

  res.json({ attachments });
});

app.post('/api/feedback/:id/actions', async (req, res) => {
  const feedbackId = req.params.id;
  const existing = await db.get(`SELECT * FROM feedback WHERE id = ?`, feedbackId);
  if (!existing) return res.status(404).json({ error: 'Feedback not found' });

  const { title, details, owner, dueDate, status, createdBy } = req.body;
  const timestamp = now();
  const result = await db.run(
    `INSERT INTO actions (feedbackId, title, details, owner, dueDate, status, result, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    feedbackId,
    title,
    details || '',
    owner || '',
    dueDate || '',
    status || 'Pending',
    '',
    createdBy || 'Manager',
    timestamp,
    timestamp
  );

  await db.run(`INSERT INTO history (feedbackId, userName, eventType, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    feedbackId,
    createdBy || 'Manager',
    'Action added',
    `Created action '${title}'.`,
    timestamp
  );

  const action = await db.get(`SELECT * FROM actions WHERE id = ?`, result.lastID);
  res.status(201).json({ action });
});

app.put('/api/actions/:id', async (req, res) => {
  const existing = await db.get(`SELECT * FROM actions WHERE id = ?`, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Action not found' });

  const { title, details, owner, dueDate, status, result } = req.body;
  const updatedAt = now();
  await db.run(`
    UPDATE actions SET
      title = ?,
      details = ?,
      owner = ?,
      dueDate = ?,
      status = ?,
      result = ?,
      updatedAt = ?
    WHERE id = ?
  `,
  title || existing.title,
  details || existing.details,
  owner || existing.owner,
  dueDate || existing.dueDate,
  status || existing.status,
  result || existing.result,
  updatedAt,
  req.params.id);

  await db.run(`INSERT INTO history (feedbackId, userName, eventType, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    existing.feedbackId,
    req.body.updatedBy || existing.owner || 'Action Owner',
    'Action updated',
    `Updated action '${title || existing.title}'.`,
    updatedAt
  );

  const action = await db.get(`SELECT * FROM actions WHERE id = ?`, req.params.id);
  res.json({ action });
});

app.get('/api/actions/owner/:owner', async (req, res) => {
  const items = await db.all(`SELECT a.*, f.shortDescription, f.status AS feedbackStatus, f.teamOwner FROM actions a JOIN feedback f ON a.feedbackId = f.id WHERE LOWER(a.owner) LIKE LOWER(?) ORDER BY a.updatedAt DESC`, `%${req.params.owner}%`);
  res.json(items);
});

app.get('/api/feedback/:id/history', async (req, res) => {
  const history = await db.all(`SELECT * FROM history WHERE feedbackId = ? ORDER BY createdAt DESC`, req.params.id);
  res.json(history);
});

app.post('/api/feedback/:id/history', async (req, res) => {
  const feedbackId = req.params.id;
  const { userName, eventType, note } = req.body;
  const timestamp = now();
  const result = await db.run(
    `INSERT INTO history (feedbackId, userName, eventType, note, createdAt) VALUES (?, ?, ?, ?, ?)`,
    feedbackId,
    userName || 'Contributor',
    eventType || 'Note',
    note || '',
    timestamp
  );
  const history = await db.get(`SELECT * FROM history WHERE id = ?`, result.lastID);
  res.status(201).json({ history });
});

app.get('/api/dashboard', async (req, res) => {
  const total = await db.get(`SELECT COUNT(*) AS count FROM feedback`);
  const active = await db.get(`SELECT COUNT(*) AS count FROM feedback WHERE status NOT IN ('Declined', 'Complete')`);
  const inProgress = await db.get(`SELECT COUNT(*) AS count FROM feedback WHERE status = 'In Progress'`);
  const statusCounts = await db.all(`SELECT status, COUNT(*) AS count FROM feedback GROUP BY status`);
  const teamPerformance = await db.all(`SELECT teamOwner AS team, COUNT(*) AS count FROM feedback WHERE teamOwner != '' GROUP BY teamOwner ORDER BY count DESC`);
  const ownerPerformance = await db.all(`SELECT actionOwner AS owner, COUNT(*) AS count FROM feedback WHERE actionOwner != '' GROUP BY actionOwner ORDER BY count DESC`);

  res.json({
    total: total.count,
    active: active.count,
    inProgress: inProgress.count,
    statusCounts,
    teamPerformance,
    ownerPerformance
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`Feedback system listening on http://localhost:${PORT}`);
});
