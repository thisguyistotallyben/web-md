import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface FileItem {
  name: string;
  type: 'folder' | 'note';
  path: string;
  childCount?: number;
  children?: FileItem[];
}

@Injectable({
  providedIn: 'root'
})
export class FileService {
  constructor(private http: HttpClient) {}

  list(path: string = ''): Observable<FileItem[]> {
    return this.http.get<FileItem[]>(`/api/fs?path=${encodeURIComponent(path)}`);
  }

  read(filePath: string): Observable<{ content: string }> {
    return this.http.get<{ content: string }>(`/api/fs/read?path=${encodeURIComponent(filePath)}`);
  }

  write(filePath: string, content: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/fs/write', { path: filePath, content });
  }

  create(name: string, type: 'folder' | 'note', parentPath: string = ''): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/fs/create', { name, type, parentPath });
  }

  rename(oldPath: string, newName: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/fs/rename', { oldPath, newName });
  }

  delete(path: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/fs/delete', { path });
  }

  listAll(): Observable<FileItem[]> {
    return this.http.get<FileItem[]>('/api/fs/all');
  }

  listTrash(): Observable<FileItem[]> {
    return this.http.get<FileItem[]>('/api/fs/trash');
  }

  restore(path: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/fs/restore', { path });
  }

  restartServer(): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/api/system/restart', {});
  }
}
