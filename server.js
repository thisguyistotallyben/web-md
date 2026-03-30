const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

app.use(cors());
app.use(bodyParser.json());

// List files and folders
app.get('/api/fs', async (req, res) => {
  try {
    const relativePath = req.query.path || '';
    const targetDir = path.join(DATA_DIR, relativePath);
    
    if (!targetDir.startsWith(DATA_DIR)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const result = entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'folder' : 'note',
      path: path.join(relativePath, entry.name)
    })).filter(item => (item.type === 'folder' || item.name.endsWith('.md')) && item.name !== 'settings.json');

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Read file content
app.get('/api/fs/read', async (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, req.query.path);
    if (!filePath.startsWith(DATA_DIR)) return res.status(403).json({ error: 'Forbidden' });

    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Write file content
app.post('/api/fs/write', async (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, req.body.path);
    if (!filePath.startsWith(DATA_DIR)) return res.status(403).json({ error: 'Forbidden' });

    await fs.writeFile(filePath, req.body.content, 'utf-8');
    console.log(`[FS] Saved: ${req.body.path}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create file or folder
app.post('/api/fs/create', async (req, res) => {
  try {
    const { name, type, parentPath = '' } = req.body;
    const targetPath = path.join(DATA_DIR, parentPath, name);
    console.log(`[FS] Create: ${type} at ${targetPath}`);
    
    if (!targetPath.startsWith(DATA_DIR)) return res.status(403).json({ error: 'Forbidden' });

    if (type === 'folder') {
      await fs.mkdir(targetPath, { recursive: true });
    } else {
      const fileName = name.endsWith('.md') ? name : `${name}.md`;
      const finalPath = path.join(DATA_DIR, parentPath, fileName);
      await fs.writeFile(finalPath, '', 'utf-8');
    }
    res.json({ success: true });
  } catch (error) {
    console.error('[FS] Create Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rename file or folder
app.post('/api/fs/rename', async (req, res) => {
  try {
    const { oldPath, newName } = req.body;
    const oldFullPath = path.join(DATA_DIR, oldPath);
    const newFullPath = path.join(path.dirname(oldFullPath), newName);

    if (!oldFullPath.startsWith(DATA_DIR) || !newFullPath.startsWith(DATA_DIR)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await fs.rename(oldFullPath, newFullPath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete file or folder
app.post('/api/fs/delete', async (req, res) => {
  try {
    const { path: targetPath } = req.body;
    const fullPath = path.join(DATA_DIR, targetPath);

    if (!fullPath.startsWith(DATA_DIR)) return res.status(403).json({ error: 'Forbidden' });

    await fs.rm(fullPath, { recursive: true, force: true });
    console.log(`[FS] Deleted: ${targetPath}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Settings Endpoints
app.get('/api/settings', async (req, res) => {
  try {
    try {
      const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
      res.json(JSON.parse(data));
    } catch (e) {
      // Default settings
      res.json({ theme: 'dark' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(req.body, null, 2), 'utf-8');
    console.log('[Settings] Updated and saved');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================');
  console.log(`WebMD Backend started!`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Data Dir: ${DATA_DIR}`);
  console.log('====================================');
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});
