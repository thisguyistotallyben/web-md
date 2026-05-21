const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');
const { createClient } = require('redis');

const app = express();
app.use(cors());
app.use(express.json());

const BROWSER_DIR = path.join(__dirname, 'dist/web-md/browser');
app.use(express.static(BROWSER_DIR));

// Redis Configuration
const redisClient = createClient({
  url: 'redis://database.local:6379'
});

redisClient.on('error', (err) => console.log('[Redis] Client Error', err));

async function connectRedis() {
  try {
    await redisClient.connect();
    console.log('[Redis] Connected to database.local');
  } catch (err) {
    console.error('[Redis] Connection failed. Redis is required for settings:', err.message);
  }
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow all origins
      callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  transports: ['polling', 'websocket']
});

// Debugging for Socket.IO
io.on('new_namespace', (namespace) => {
  console.log(`[Realtime] New namespace: ${namespace.name}`);
});

// Authentication configuration
// Helper to clean up expired tokens
const cleanupTokens = () => {
  const now = Date.now();
  for (const [token, expiry] of validTokens.entries()) {
    if (now > expiry) {
      validTokens.delete(token);
    }
  }
};

// Authentication Middleware
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const expiry = validTokens.get(token);

  if (!expiry || Date.now() > expiry) {
    if (expiry) validTokens.delete(token);
    return res.status(401).json({ error: 'Session expired' });
  }

  // Refresh expiry on successful use (optional, but requested "keep logged in for a nominal period")
  validTokens.set(token, Date.now() + TOKEN_EXPIRY_MS);
  next();
};

io.on('connection', (socket) => {
  console.log(`[Realtime] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Realtime] Client disconnected: ${socket.id}`);
  });
});

const PORT = 3000;
let DATA_DIR;

// Authentication configuration
const DEFAULT_PASSWORD = 'admin';
let ADMIN_PASSWORD = DEFAULT_PASSWORD;
const TOKEN_EXPIRY_MS = 3600000; // 1 hour
const validTokens = new Map();

// Load password from Redis
const loadPassword = async () => {
  try {
    if (redisClient.isOpen) {
      const redisPassword = await redisClient.get('web-md:config:password');
      if (redisPassword) {
        ADMIN_PASSWORD = redisPassword;
        console.log('[Auth] Password loaded from Redis');
        return;
      }
      
      // Initialize Redis with default if not set
      await redisClient.set('web-md:config:password', DEFAULT_PASSWORD);
      ADMIN_PASSWORD = DEFAULT_PASSWORD;
      console.log('[Auth] Redis initialized with default password');
    } else {
      console.warn('[Auth] Redis not connected, using default password (not persistent)');
      ADMIN_PASSWORD = DEFAULT_PASSWORD;
    }
  } catch (e) {
    console.error('[Auth] Error loading password from Redis:', e.message);
    ADMIN_PASSWORD = DEFAULT_PASSWORD;
  }
};

// Auth Endpoints
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + TOKEN_EXPIRY_MS;
    validTokens.set(token, expiry);
    cleanupTokens();
    res.json({ token, expiry });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (oldPassword === ADMIN_PASSWORD) {
    try {
      if (redisClient.isOpen) {
        await redisClient.set('web-md:config:password', newPassword);
        ADMIN_PASSWORD = newPassword;
        console.log('[Auth] Password updated in Redis');
        res.json({ success: true });
      } else {
        res.status(503).json({ error: 'Redis not available' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to save new password to Redis' });
    }
  } else {
    res.status(401).json({ error: 'Invalid old password' });
  }
});

// List files and folders
app.get('/api/fs', requireAuth, async (req, res) => {
  try {
    const relativePath = req.query.path || '';
    const targetDir = path.join(DATA_DIR, relativePath);
    
    if (!targetDir.startsWith(DATA_DIR)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    
    const items = await Promise.all(entries.map(async entry => {
      const isDir = entry.isDirectory();
      const name = entry.name;
      const itemPath = path.join(relativePath, name);

      // Skip hidden files/folders (starting with .)
      if (name.startsWith('.')) return null;
      
      let childCount = 0;
      if (isDir) {
        try {
          const subEntries = await fs.readdir(path.join(DATA_DIR, itemPath), { withFileTypes: true });
          childCount = subEntries.filter(e => 
            (e.isDirectory() || e.name.endsWith('.md')) && e.name !== 'settings.json' && !e.name.startsWith('.')
          ).length;
        } catch (e) {
          // Ignore errors
        }
      }

      return {
        name,
        type: isDir ? 'folder' : 'note',
        path: itemPath,
        childCount: isDir ? childCount : undefined
      };
    }));

    // Filter out settings.json and null entries
    const result = items.filter(item => item && (item.type === 'folder' || item.name.endsWith('.md')) && item.name !== 'settings.json');

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List trash content
app.get('/api/fs/trash', requireAuth, async (req, res) => {
  try {
    const trashDir = path.join(DATA_DIR, '.trash');
    try {
      await fs.access(trashDir);
    } catch {
      return res.json([]);
    }

    const entries = await fs.readdir(trashDir, { withFileTypes: true });
    const items = entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'folder' : 'note',
      path: path.join('.trash', entry.name)
    }));

    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restore from trash
app.post('/api/fs/restore', requireAuth, async (req, res) => {
  try {
    const { path: trashPath } = req.body;
    const fullTrashPath = path.join(DATA_DIR, trashPath);
    
    if (!fullTrashPath.startsWith(path.join(DATA_DIR, '.trash'))) {
      return res.status(400).json({ error: 'Not in trash' });
    }

    // Move back to root for now
    const originalName = path.basename(trashPath).replace(/_\d+$/, ''); // Remove timestamp
    let targetName = originalName;
    let targetPath = path.join(DATA_DIR, targetName);
    
    // Check for collisions in root
    let counter = 1;
    while (true) {
      try {
        await fs.access(targetPath);
        const ext = path.extname(originalName);
        const base = path.basename(originalName, ext);
        targetName = `${base}_${counter}${ext}`;
        targetPath = path.join(DATA_DIR, targetName);
        counter++;
      } catch {
        break;
      }
    }

    await fs.rename(fullTrashPath, targetPath);
    io.emit('fs-changed');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Read file content
app.get('/api/fs/read', requireAuth, async (req, res) => {
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
app.post('/api/fs/write', requireAuth, async (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, req.body.path);
    if (!filePath.startsWith(DATA_DIR)) return res.status(403).json({ error: 'Forbidden' });

    await fs.writeFile(filePath, req.body.content, 'utf-8');
    console.log(`[FS] Saved: ${req.body.path}`);
    
    // Broadcast update to other clients
    io.emit('file-updated', { path: req.body.path });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create file or folder
app.post('/api/fs/create', requireAuth, async (req, res) => {
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

    // Broadcast file system change
    io.emit('fs-changed');

    res.json({ success: true });
  } catch (error) {
    console.error('[FS] Create Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rename file or folder
app.post('/api/fs/rename', requireAuth, async (req, res) => {
  try {
    const { oldPath, newName } = req.body;
    const oldFullPath = path.join(DATA_DIR, oldPath);
    const newFullPath = path.join(path.dirname(oldFullPath), newName);

    if (!oldFullPath.startsWith(DATA_DIR) || !newFullPath.startsWith(DATA_DIR)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await fs.rename(oldFullPath, newFullPath);
    
    // Broadcast file system change
    io.emit('fs-changed');

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete file or folder
app.post('/api/fs/delete', requireAuth, async (req, res) => {
  try {
    const { path: targetPath } = req.body;
    const fullPath = path.join(DATA_DIR, targetPath);

    if (!fullPath.startsWith(DATA_DIR)) return res.status(403).json({ error: 'Forbidden' });

    const isTrash = targetPath.startsWith('.trash');
    
    if (isTrash) {
      // Permanent delete
      await fs.rm(fullPath, { recursive: true, force: true });
      console.log(`[FS] Permanently Deleted: ${targetPath}`);
    } else {
      // Move to trash
      const trashDir = path.join(DATA_DIR, '.trash');
      await fs.mkdir(trashDir, { recursive: true });
      
      const fileName = path.basename(targetPath);
      const timestamp = Date.now();
      const trashName = `${fileName}_${timestamp}`;
      const fullTrashPath = path.join(trashDir, trashName);
      
      await fs.rename(fullPath, fullTrashPath);
      console.log(`[FS] Moved to Trash: ${targetPath} -> ${trashName}`);
    }
    
    // Broadcast file system change
    io.emit('fs-changed');

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Settings Endpoints
app.get('/api/theme', async (req, res) => {
  try {
    if (redisClient.isOpen) {
      const redisSettings = await redisClient.get('web-md:config:theme');
      if (redisSettings) {
        const settings = JSON.parse(redisSettings);
        return res.json({ theme: settings.theme });
      }
    }
    res.json({ theme: 'dark' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    if (redisClient.isOpen) {
      const redisSettings = await redisClient.get('web-md:config:theme');
      if (redisSettings) {
        return res.json(JSON.parse(redisSettings));
      }
      
      // Default settings
      const defaults = { theme: 'dark' };
      await redisClient.set('web-md:config:theme', JSON.stringify(defaults));
      return res.json(defaults);
    } else {
      return res.json({ theme: 'dark' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings', requireAuth, async (req, res) => {
  try {
    if (redisClient.isOpen) {
      const settingsJson = JSON.stringify(req.body, null, 2);
      await redisClient.set('web-md:config:theme', settingsJson);
      console.log('[Settings] Updated in Redis');
      
      // Broadcast settings update
      io.emit('settings-updated', req.body);
      res.json({ success: true });
    } else {
      res.status(503).json({ error: 'Redis not available' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// System Endpoints
app.post('/api/system/restart', requireAuth, async (req, res) => {
  res.json({ success: true, message: 'Server is restarting...' });
  console.log('[System] Restart requested. Touching server.js...');
  
  try {
    const now = new Date();
    await fs.utimes(__filename, now, now);
  } catch (error) {
    console.error('[System] Restart Error:', error);
  }
});

app.get('/api/system/heartbeat', (req, res) => {
  res.json({ online: true, timestamp: Date.now() });
});

// For all non-API requests, serve the index.html from the Angular browser directory
app.get('*all', (req, res) => {
  // If the request is for an API, socket.io, or a file that might exist, don't serve index.html here
  if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
    res.sendFile(path.join(BROWSER_DIR, 'index.html'));
  }
});

async function start() {
  const dataPathArg = process.argv[2];

  if (!dataPathArg) {
    console.error('ERROR: Data directory path is required.');
    console.error('Usage: node server.js <path-to-data-directory>');
    process.exit(1);
  }

  DATA_DIR = path.resolve(dataPathArg);

  try {
    const stats = await fs.stat(DATA_DIR);
    if (!stats.isDirectory()) {
      console.error(`ERROR: The path "${DATA_DIR}" is not a directory.`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`ERROR: Could not access data directory "${DATA_DIR}":`, err.message);
    process.exit(1);
  }

  await connectRedis();
  await loadPassword();

  server.listen(PORT, '0.0.0.0', () => {
    console.log('====================================');
    console.log(`WebMD App & Backend started!`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`Data Dir: ${DATA_DIR}`);
    console.log('====================================');
  });
}

start();

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});
