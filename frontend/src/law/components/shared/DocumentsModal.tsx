"use client";
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { FileViewerModal } from './FileViewerModal';
import { fetchApi, fetchFileBlob } from '../../utils/apiHelper';
import { formatDate as sharedFormatDate } from '../../utils/dateFormat';
import { toast } from 'sonner';
import {
  FileText, Search, Loader2, FolderOpen, Users, Briefcase, Download, Eye,
  Image as ImageIcon, FileSpreadsheet, FileArchive, File as FileIcon,
} from 'lucide-react';

// ==================== MƏRKƏZİ SƏNƏDLƏR (Documents) MODALI ====================
//
// QEYD (2026-09, istifadəçi tapşırığı: "müasir task management sistemlərindəki
// fayl idarəetməsi"): bu komponent müştəri/müqavilə/tapşırıq üzrə artıq
// mövcud olan (ayrı-ayrı kartlarda səpələnmiş) sənədləri backend-in yeni
// /documents endpoint-i (bax: backend/internal/professionallaw/documents.go)
// vasitəsilə BİR yerdə, axtarıla/süzülə bilən siyahı kimi göstərir. Heç bir
// yeni fayl-yükləmə yolu YOXDUR (mövcud UploadFile axını dəyişməz qalır) —
// bu, sırf mövcud sənədlərə vahid bir "giriş nöqtəsi" verir. Hər 3 interfeys
// (manager/lawyer/client) eyni komponenti istifadə edir; backend artıq
// rol/sahiblik əsaslı süzgəci tətbiq etdiyi üçün frontend-də əlavə rol
// yoxlamasına ehtiyac yoxdur (server yalnız icazəli sənədləri qaytarır).

interface DocumentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SourceFilter = 'all' | 'client' | 'contract' | 'task';

function fileIconFor(name: string) {
  var ext = (name || '').split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].indexOf(ext) >= 0) return ImageIcon;
  if (['xls', 'xlsx', 'csv'].indexOf(ext) >= 0) return FileSpreadsheet;
  if (['zip', 'rar', '7z'].indexOf(ext) >= 0) return FileArchive;
  if (['pdf', 'doc', 'docx', 'txt'].indexOf(ext) >= 0) return FileText;
  return FileIcon;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

var SOURCE_LABEL: Record<string, string> = { client: 'Müştəri', contract: 'Müqavilə', task: 'Tapşırıq' };
var SOURCE_ICON: Record<string, any> = { client: Users, contract: Briefcase, task: FolderOpen };

// BUG DÜZƏLİŞİ (2026-09, istifadəçi bildirişi: "faylları yükləmək də olmur"):
// `d.url` autentifikasiya tələb edən bir server keçididir (bax FileViewerModal.tsx-
// dəki eyni düzəlişin izahı) — birbaşa <a href> kimi açılanda 401/403 verirdi.
// İndi eyni təhlükəsiz fetchFileBlob() ilə çəkilib YALNIZ bundan sonra yüklənir.
async function downloadDoc(d: any) {
  var name = d.name || d.description || 'Sənəd';
  try {
    var blobUrl = await fetchFileBlob(d.url);
    var a = document.createElement('a');
    a.href = blobUrl; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 1500);
  } catch (err: any) {
    toast.error('Fayl yüklənə bilmədi: ' + (err?.message || ''));
  }
}

export function DocumentsModal({ open, onOpenChange }: DocumentsModalProps) {
  var [loading, setLoading] = useState(false);
  var [docs, setDocs] = useState<any[]>([]);
  var [search, setSearch] = useState('');
  var [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  var [viewerDoc, setViewerDoc] = useState<any>(null);

  var load = async function () {
    setLoading(true);
    try {
      var data = await fetchApi('/documents');
      setDocs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error('Sənədlər yüklənmədi: ' + (err?.message || ''));
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(function () {
    if (open) load();
  }, [open]);

  var filtered = useMemo(function () {
    var q = search.trim().toLowerCase();
    return docs.filter(function (d) {
      if (sourceFilter !== 'all' && d.source_type !== sourceFilter) return false;
      if (!q) return true;
      var name = String(d.name || d.description || '').toLowerCase();
      var src = String(d.source_title || '').toLowerCase();
      var client = String(d.client_name || '').toLowerCase();
      return name.indexOf(q) >= 0 || src.indexOf(q) >= 0 || client.indexOf(q) >= 0;
    });
  }, [docs, search, sourceFilter]);

  var counts = useMemo(function () {
    var c: Record<string, number> = { all: docs.length, client: 0, contract: 0, task: 0 };
    docs.forEach(function (d) {
      if (c[d.source_type] !== undefined) c[d.source_type]++;
    });
    return c;
  }, [docs]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-slate-600" />
              Sənədlər
            </DialogTitle>
            <DialogDescription>
              Bütün müştəri, müqavilə və tapşırıq sənədləri bir yerdə — axtar, süz, aç.
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 pt-3 pb-2 space-y-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Sənəd, müştəri, müqavilə axtar..."
                value={search}
                onChange={function (e: any) { setSearch(e.target.value); }}
                className="pl-8 h-9"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['all', 'client', 'contract', 'task'] as SourceFilter[]).map(function (k) {
                var active = sourceFilter === k;
                return (
                  <button
                    key={k}
                    onClick={function () { setSourceFilter(k); }}
                    className={'text-xs px-2.5 py-1 rounded-full border transition-colors ' +
                      (active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}
                  >
                    {k === 'all' ? 'Hamısı' : SOURCE_LABEL[k]} ({counts[k] || 0})
                  </button>
                );
              })}
            </div>
          </div>

          <ScrollArea className="flex-1 px-5 py-3">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Yüklənir...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <FolderOpen className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm text-slate-500">
                  {docs.length === 0 ? 'Hələ heç bir sənəd yoxdur' : 'Axtarışa uyğun sənəd tapılmadı'}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 pb-1">
                {filtered.map(function (d, idx) {
                  var name = d.name || d.description || 'Sənəd';
                  var Icon = fileIconFor(name);
                  var SrcIcon = SOURCE_ICON[d.source_type] || FileText;
                  return (
                    <div
                      key={d._row_id || idx}
                      className="flex items-center gap-3 border border-slate-200 rounded-lg px-3 py-2.5 hover:border-slate-300 hover:bg-slate-50 transition-colors group cursor-pointer"
                      onClick={function () { setViewerDoc(d); }}
                    >
                      <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-500">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <SrcIcon className="h-3 w-3" />
                            {(SOURCE_LABEL[d.source_type] || d.source_type) + ': ' + d.source_title}
                          </span>
                          {d.client_name && d.source_type !== 'client' ? (
                            <>
                              <span className="text-slate-300">·</span>
                              <span>{d.client_name}</span>
                            </>
                          ) : null}
                          {d.uploaded_at || d.created_at ? (
                            <>
                              <span className="text-slate-300">·</span>
                              <span>{sharedFormatDate(d.uploaded_at || d.created_at, '')}</span>
                            </>
                          ) : null}
                          {d.file_size ? (
                            <>
                              <span className="text-slate-300">·</span>
                              <span>{formatSize(d.file_size)}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Bax" onClick={function (e: any) { e.stopPropagation(); setViewerDoc(d); }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {d.url ? (
                          <Button
                            size="sm" variant="ghost" className="h-7 w-7 p-0" title="Yüklə"
                            onClick={function (e: any) { e.stopPropagation(); downloadDoc(d); }}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <FileViewerModal doc={viewerDoc} open={!!viewerDoc} onClose={function () { setViewerDoc(null); }} allDocs={filtered} />
    </>
  );
}
