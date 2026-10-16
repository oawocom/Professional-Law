// ============================================================
// Paylaşılan API helper - bütün modallar bu fayldan istifadə etməlidir.
//
// Giriş edilibsə (law_token): /api/sf/... + Authorization: Bearer <law_token>
// Giriş edilməyibsə: /api/... (giriş, kodlar, parol linkləri)
// Büro ünvandan (domendən) tanınır — server özü müəyyən edir.
// ============================================================

import { toast } from 'sonner';

export var API_BASE = '/api';

// permission_denied 403 cavablarını mərkəzləşdirilmiş şəkildə istifadəçiyə göstərir —
// backend hansı endpoint-i çağırsaq da, icazəsi olmayan istifadəçi həmişə aydın
// bildiriş görür ("bu əməliyyat üçün icazəniz yoxdur, admindən istəyin").
export function reportPermissionDenied(errorText: string): boolean {
  try {
    var parsed = JSON.parse(errorText);
    if (parsed && parsed.permission_denied) {
      toast.error(parsed.error || 'Bu əməliyyat üçün icazəniz yoxdur.', {
        description: 'İstəyirsinizsə, admin/menecerdən bu icazəni açmasını xahiş edin.',
      });
      return true;
    }
  } catch (e) { /* JSON deyil - adi xəta mesajı */ }
  return false;
}

export function getLawToken(): string {
  try { return localStorage.getItem('law_token') || ''; } catch(e) { return ''; }
}

// The law_token login has expired or is no longer valid: forget it and open the login page.
// Only the token checks answer with these messages; a wrong current password is a 401 too and signs nobody out.
var EXPIRED_LOGIN = ['Authorization token required', 'Invalid or expired token', 'Invalid token', 'Token bu büro üçün etibarlı deyil'];
export function handleExpiredLogin(status: number, errorText: string): void {
  if (status !== 401 || !getLawToken()) return;
  var msg = '';
  try { var body = JSON.parse(errorText); msg = (body && (body.detail || body.error)) || ''; } catch (e) { return; }
  if (EXPIRED_LOGIN.indexOf(msg) < 0) return;
  try { localStorage.removeItem('law_token'); localStorage.removeItem('law_user'); } catch (e) { /* ignore */ }
  if (typeof window !== 'undefined' && window.location.pathname.indexOf('/login') < 0) {
    window.location.href = '/login';
  }
}

export function getApiBase(): string {
  var token = getLawToken();
  return token ? API_BASE + '/sf' : API_BASE;
}

export function uploadFile(file: File | Blob, name?: string, onProgress?: (percent: number) => void): Promise<any> {
  return new Promise(function(resolve, reject) {
    var token = getLawToken();
    var base = getApiBase();
    var fd = new FormData();
    fd.append('file', file, name || (file as File).name || 'file');
    var xhr = new XMLHttpRequest();
    xhr.open('POST', base + '/files/upload');
    if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    if (onProgress) {
      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch(e) { reject(new Error('Upload: cavab oxunmadi')); }
      } else {
        reject(new Error(xhr.responseText || 'Upload Error: ' + xhr.status));
      }
    };
    xhr.onerror = function() { reject(new Error('Upload: shebeke xetasi')); };
    xhr.send(fd);
  });
}
export async function fetchFileBlob(url: string): Promise<string> {
  var token = getLawToken();
  var headers: Record<string, string> = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  var res = await fetch(url, { headers: headers });
  if (!res.ok) throw new Error('File fetch error: ' + res.status);
  var blob = await res.blob();
  return URL.createObjectURL(blob);
}
export async function fetchApi(endpoint: string, options?: RequestInit): Promise<any> {
  var token = getLawToken();
  var base = getApiBase();

  var headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  var res = await fetch(base + endpoint, {
    credentials: 'include',
    headers: {
      ...headers,
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    var errorText = await res.text().catch(function() { return 'API Error'; });
    if (res.status === 403) {
      reportPermissionDenied(errorText);
    }
    handleExpiredLogin(res.status, errorText);
    throw new Error(errorText || 'API Error: ' + res.status);
  }
  return res.json();
}