import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');

export interface FileItem {
  name: string;
  type: 'folder' | 'note';
  path: string; // relative path within DATA_DIR
  childCount?: number;
  children?: FileItem[];
}

// Ensure base data and trash directories exist
async function ensureDir(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {}
}

export function resolveSafePath(relativePath: string): string {
  const resolved = path.resolve(DATA_DIR, relativePath);
  if (!resolved.startsWith(DATA_DIR)) {
    throw new Error('Unauthorized file path access (Directory Traversal Detected)');
  }
  return resolved;
}

export async function listDirectory(relativePath: string = ''): Promise<FileItem[]> {
  const targetDir = resolveSafePath(relativePath);
  await ensureDir(targetDir);

  const entries = await fs.readdir(targetDir, { withFileTypes: true });

  const items = await Promise.all(
    entries.map(async (entry): Promise<FileItem | null> => {
      const isDir = entry.isDirectory();
      const name = entry.name;
      const itemPath = relativePath ? path.join(relativePath, name) : name;

      // Skip hidden files/folders (starting with .)
      if (name.startsWith('.')) return null;

      let childCount = 0;
      if (isDir) {
        try {
          const subEntries = await fs.readdir(path.join(DATA_DIR, itemPath), { withFileTypes: true });
          childCount = subEntries.filter(
            (e) =>
              (e.isDirectory() || e.name.endsWith('.md')) &&
              e.name !== 'settings.json' &&
              !e.name.startsWith('.')
          ).length;
        } catch {
          // Ignore errors
        }
      }

      return {
        name,
        type: isDir ? 'folder' : 'note',
        path: itemPath,
        childCount: isDir ? childCount : undefined,
      };
    })
  );

  return items.filter(
    (item): item is FileItem =>
      item !== null &&
      (item.type === 'folder' || item.name.endsWith('.md')) &&
      item.name !== 'settings.json'
  );
}

// Recursively get all files in a directory
async function getFilesRecursive(dir: string, relativePath: string = ''): Promise<FileItem[]> {
  let results: FileItem[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const name = entry.name;
      // Skip hidden files/folders (starting with .) and settings.json
      if (name.startsWith('.') || name === 'settings.json') continue;

      const itemPath = relativePath ? path.join(relativePath, name) : name;
      const fullPath = path.join(dir, name);

      if (entry.isDirectory()) {
        results.push({
          name,
          type: 'folder',
          path: itemPath,
        });
        const subResults = await getFilesRecursive(fullPath, itemPath);
        results = results.concat(subResults);
      } else if (name.endsWith('.md')) {
        results.push({
          name,
          type: 'note',
          path: itemPath,
        });
      }
    }
  } catch (err: any) {
    console.error(`Error reading directory ${dir}:`, err.message);
  }
  return results;
}

export async function listAllFilesRecursive(): Promise<FileItem[]> {
  await ensureDir(DATA_DIR);
  return getFilesRecursive(DATA_DIR);
}

export async function listTrash(): Promise<FileItem[]> {
  const trashDir = path.join(DATA_DIR, '.trash');
  try {
    await fs.access(trashDir);
  } catch {
    return [];
  }

  const entries = await fs.readdir(trashDir, { withFileTypes: true });
  return entries.map((entry) => ({
    name: entry.name,
    type: entry.isDirectory() ? 'folder' : 'note' as const,
    path: path.join('.trash', entry.name),
  }));
}

export async function restoreItem(trashPath: string): Promise<void> {
  const fullTrashPath = resolveSafePath(trashPath);
  const trashDir = path.join(DATA_DIR, '.trash');

  if (!fullTrashPath.startsWith(trashDir)) {
    throw new Error('Not in trash');
  }

  // Restore back to root folder
  const originalName = path.basename(trashPath).replace(/_\d+$/, ''); // Strip timestamp
  let targetName = originalName;
  let targetPath = path.join(DATA_DIR, targetName);

  // Check for collisions in root directory
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
}

export async function readNote(notePath: string): Promise<string> {
  const fullPath = resolveSafePath(notePath);
  return fs.readFile(fullPath, 'utf-8');
}

export async function writeNote(notePath: string, content: string): Promise<void> {
  const fullPath = resolveSafePath(notePath);
  await ensureDir(path.dirname(fullPath));
  await fs.writeFile(fullPath, content, 'utf-8');
}

export async function createItem(
  name: string,
  type: 'folder' | 'note',
  parentPath: string = ''
): Promise<void> {
  const targetPath = resolveSafePath(path.join(parentPath, name));

  if (type === 'folder') {
    await fs.mkdir(targetPath, { recursive: true });
  } else {
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    const finalPath = resolveSafePath(path.join(parentPath, fileName));
    await fs.writeFile(finalPath, '', 'utf-8');
  }
}

export async function renameItem(oldPath: string, newName: string): Promise<void> {
  const oldFullPath = resolveSafePath(oldPath);
  const newFullPath = resolveSafePath(path.join(path.dirname(oldPath), newName));

  await fs.rename(oldFullPath, newFullPath);
}

export async function moveItem(sourcePath: string, targetParentPath: string): Promise<void> {
  const sourceFullPath = resolveSafePath(sourcePath);
  const targetFullPath = resolveSafePath(path.join(targetParentPath, path.basename(sourcePath)));

  if (sourceFullPath === targetFullPath) {
    throw new Error('Source and target are the same');
  }

  // Prevent moving folder into its own subdirectory
  if (targetFullPath.startsWith(sourceFullPath + path.sep)) {
    throw new Error('Cannot move a folder into its own subdirectory');
  }

  await fs.rename(sourceFullPath, targetFullPath);
}

export async function deleteItem(targetPath: string): Promise<void> {
  const fullPath = resolveSafePath(targetPath);
  const isTrash = targetPath.startsWith('.trash');

  if (isTrash) {
    // Permanent deletion
    await fs.rm(fullPath, { recursive: true, force: true });
  } else {
    // Move to trash
    const trashDir = path.join(DATA_DIR, '.trash');
    await ensureDir(trashDir);

    const fileName = path.basename(targetPath);
    const timestamp = Date.now();
    const trashName = `${fileName}_${timestamp}`;
    const fullTrashPath = path.join(trashDir, trashName);

    await fs.rename(fullPath, fullTrashPath);
  }
}
