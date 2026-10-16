'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { fetchFileBlob } from '../../utils/apiHelper';
import {
  Download, FileText, Image as ImageIcon, File,
  ZoomIn, ZoomOut, ExternalLink, Loader2, AlertCircle,
  Music, Video, ChevronLeft, ChevronRight, X
} from 'lucide-react';

// Fayl linkləri giriş tələb edir (Bearer token); brauzer adi <img>/<iframe>/<a>
// keçidlərinə bu başlığı əlavə etmir. Ona görə fayl əvvəlcə fetchFileBlob() ilə
// blob kimi çəkilir və yalnız müvəqqəti blob: URL-i göstərilir/endirilir.
function isRemoteUrl(s: string): boolean {
  return typeof s === 'string' && (/^https?:\/\//.test(s) || s.startsWith('/'));
}

function getSource(doc: any): string {
  if (!doc) return '';
  return doc.file_data || doc.url || doc.fileData || doc.data || '';
}

function getName(doc: any): string {
  if (!doc) return 'Sənəd';
  return doc.name || doc.file_name || doc.fileName || doc.description || 'Sənəd';
}

function detectKind(doc: any): 'image' | 'pdf' | 'text' | 'video' | 'audio' | 'office' | 'unknown' {
  var src = getSource(doc);
  var mime = (doc.file_type || doc.fileType || doc.type || '').toLowerCase();
  var name = getName(doc).toLowerCase();
  var ext = (name.split('.').pop() || '').split('?')[0];

  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'text/html') return 'pdf';
  if (mime.startsWith('text/')) return 'text';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';

  if (src.startsWith('data:image/')) return 'image';
  if (src.startsWith('data:application/pdf')) return 'pdf';
  if (src.startsWith('data:text/html')) return 'pdf';
  if (src.startsWith('data:text/')) return 'text';
  if (src.startsWith('data:video/')) return 'video';
  if (src.startsWith('data:audio/')) return 'audio';

  if (['jpg','jpeg','png','gif','webp','svg','bmp','ico'].includes(ext)) return 'image';
  if (ext === 'pdf' || ext === 'html') return 'pdf';
  if (['txt','csv','log','md','json','xml'].includes(ext)) return 'text';
  if (['mp4','webm','mov','avi','mkv'].includes(ext)) return 'video';
  if (['mp3','wav','ogg','m4a','flac'].includes(ext)) return 'audio';
  if (['doc','docx','xls','xlsx','ppt','pptx'].includes(ext)) return 'office';
  return 'unknown';
}

function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

interface Props {
  doc: any | null;
  open: boolean;
  onClose: () => void;
  allDocs?: any[];
}

export function FileViewerModal({ doc, open, onClose, allDocs }: Props) {
  var [zoom, setZoom] = useState(1);
  var [textContent, setTextContent] = useState('');
  var [loading, setLoading] = useState(false);
  var [currentDoc, setCurrentDoc] = useState<any>(null);

  // resolvedSrc — həmişə İSTİFADƏ OLUNA BİLƏN mənbə (data: URI olduğu kimi,
  // ya da autentifikasiyalı fetchFileBlob() nəticəsində alınan müvəqqəti
  // blob: URL). `resolving`/`resolveFailed` — fayl serverdən çəkilərkən
  // yüklənmə/xəta vəziyyəti (bax fayl aça bilməmə düzəlişi, yuxarıdakı qeyd).
  var [resolvedSrc, setResolvedSrc] = useState('');
  var [resolving, setResolving] = useState(false);
  var [resolveFailed, setResolveFailed] = useState(false);

  useEffect(function() {
    setCurrentDoc(doc);
    setZoom(1);
    setTextContent('');
  }, [doc]);

  var activeDoc = currentDoc || doc;
  var src = getSource(activeDoc);
  var name = getName(activeDoc);
  var kind = activeDoc ? detectKind(activeDoc) : 'unknown';

  var docList = allDocs && allDocs.length > 1 ? allDocs : null;
  var currentIdx = docList ? docList.findIndex(function(d: any) {
    return d === activeDoc || (d.name === activeDoc?.name && d.uploaded_at === activeDoc?.uploaded_at);
  }) : -1;
  var hasPrev = docList && currentIdx > 0;
  var hasNext = docList && currentIdx < docList.length - 1;

  // Fayl mənbəyini HƏLL ET: data: URI-lər birbaşa istifadə olunur (fetch
  // lazım deyil), server keçidləri (url) isə əvvəlcə fetchFileBlob() ilə
  // (düzgün Authorization başlığı ilə) çəkilir və nəticədə
  // alınan blob: URL istifadə olunur — <img>/<iframe>/<video>/<audio> heç vaxt
  // birbaşa server keçidinə yönləndirilmir.
  useEffect(function() {
    var cancelled = false;
    var createdBlobUrl = '';
    setResolveFailed(false);

    if (!open || !src) {
      setResolvedSrc('');
      return;
    }
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      setResolvedSrc(src);
      return;
    }
    if (isRemoteUrl(src)) {
      setResolving(true);
      fetchFileBlob(src)
        .then(function(blobUrl) {
          if (cancelled) { URL.revokeObjectURL(blobUrl); return; }
          createdBlobUrl = blobUrl;
          setResolvedSrc(blobUrl);
        })
        .catch(function() {
          if (!cancelled) { setResolveFailed(true); setResolvedSrc(''); }
        })
        .finally(function() {
          if (!cancelled) setResolving(false);
        });
    } else {
      setResolvedSrc(src);
    }

    return function() {
      cancelled = true;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [open, src]);

  useEffect(function() {
    if (!open || kind !== 'text' || !resolvedSrc) return;
    setLoading(true);
    try {
      if (resolvedSrc.startsWith('data:')) {
        var b64 = resolvedSrc.split(',')[1] || '';
        try { setTextContent(decodeURIComponent(escape(atob(b64)))); }
        catch { setTextContent(atob(b64)); }
        setLoading(false);
      } else {
        fetch(resolvedSrc)
          .then(function(r) { return r.text(); })
          .then(function(t) { setTextContent(t); })
          .catch(function() { setTextContent('Mətn yüklənə bilmədi'); })
          .finally(function() { setLoading(false); });
      }
    } catch { setTextContent('Mətn yüklənə bilmədi'); setLoading(false); }
  }, [open, kind, resolvedSrc]);

  var toBlobUrl = function(): string {
    if (!resolvedSrc) return '';
    try {
      if (resolvedSrc.startsWith('data:')) {
        var parts = resolvedSrc.split(',');
        var mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
        var binary = atob(parts[1]);
        var arr = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
        return URL.createObjectURL(new Blob([arr], { type: mime }));
      }
      // artıq blob: URL-dir (fetchFileBlob-dan) — birbaşa istifadə olunur.
      return resolvedSrc;
    } catch { return resolvedSrc; }
  };

  var handleDownload = function() {
    var url = toBlobUrl();
    if (!url) return;
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    if (url !== resolvedSrc) setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
  };

  var handleOpenTab = function() {
    var url = toBlobUrl();
    if (url) window.open(url, '_blank');
  };

  if (!activeDoc) return null;

  var KindIcon = kind === 'image' ? ImageIcon
    : (kind === 'pdf' || kind === 'text') ? FileText
    : kind === 'video' ? Video
    : kind === 'audio' ? Music
    : File;

  var renderContent = function() {
    if (!src) return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
        <AlertCircle className="h-10 w-10 opacity-25" />
        <p className="text-sm">Fayl məzmunu mövcud deyil</p>
      </div>
    );

    if (resolveFailed) return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
        <AlertCircle className="h-10 w-10 opacity-25 text-red-400" />
        <p className="text-sm">Fayl yüklənə bilmədi (giriş icazəsi və ya şəbəkə xətası)</p>
      </div>
    );

    if (resolving || !resolvedSrc) return (
      <div className="flex items-center justify-center flex-1 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Fayl yüklənir...
      </div>
    );

    if (kind === 'image') return (
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-slate-50 rounded-lg">
        <img src={resolvedSrc} alt={name}
          style={{ transform: 'scale(' + zoom + ')', transition: 'transform 0.15s', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      </div>
    );

    if (kind === 'pdf') return (
      <div className="flex-1 rounded-lg overflow-hidden">
        <iframe src={resolvedSrc} title={name} style={{ width: '100%', height: '100%', border: 'none' }} />
      </div>
    );

    if (kind === 'text') return (
      <div className="flex-1 overflow-auto bg-[#1e1e2e] rounded-lg p-4">
        {loading
          ? <div className="flex items-center justify-center h-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
          : <pre className="text-xs text-slate-200 whitespace-pre-wrap break-words font-mono leading-relaxed">{textContent}</pre>
        }
      </div>
    );

    if (kind === 'video') return (
      <div className="flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden">
        <video src={resolvedSrc} controls style={{ maxWidth: '100%', maxHeight: '100%' }} />
      </div>
    );

    if (kind === 'audio') return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-8">
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
          <Music className="h-8 w-8 text-indigo-600" />
        </div>
        <p className="text-sm font-medium text-slate-700">{name}</p>
        <audio src={resolvedSrc} controls className="w-full max-w-xs" />
      </div>
    );

    // Office sənədləri (docx, xlsx, pptx) — modal içində online viewer ilə preview.
    // Yalnız public/https URL üçün işləyir (data: URL viewer-də açılmır).
    if (kind === 'office' && src && /^https?:\/\//.test(src)) {
      var officeUrl = 'https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(src);
      return (
        <div className="flex-1 rounded-lg overflow-hidden">
          <iframe src={officeUrl} title={name} style={{ width: '100%', height: '100%', border: 'none' }} />
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-slate-50 rounded-lg p-8">
        <div className="w-16 h-16 rounded-xl bg-white shadow flex items-center justify-center">
          <File className="h-8 w-8 text-slate-300" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700 mb-1">{name}</p>
          <p className="text-xs text-slate-400">
            {kind === 'office' ? 'Bu sənəd yalnız yüklədikdən sonra açıla bilər' : 'Bu fayl növünü göstərmək mümkün deyil'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5 mr-1.5" />Yüklə
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={function(o: boolean) { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl w-[90vw] max-h-[88vh] p-0 !flex !flex-col overflow-hidden gap-0">

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
          <KindIcon className="h-4 w-4 text-indigo-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
            {activeDoc?.file_size && (
              <p className="text-[10px] text-slate-400">{formatSize(activeDoc.file_size)}</p>
            )}
          </div>

          {/* Zoom (image only) */}
          {kind === 'image' && (
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 shrink-0">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                onClick={function() { setZoom(function(z) { return Math.max(0.25, z - 0.25); }); }}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[10px] text-slate-500 w-9 text-center">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                onClick={function() { setZoom(function(z) { return Math.min(4, z + 0.25); }); }}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0 p-3 gap-3 overflow-hidden">
          {renderContent()}
        </div>

        {/* Navigation */}
        {docList && (
          <div className="flex items-center justify-between px-4 py-2 border-t shrink-0 bg-slate-50">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" disabled={!hasPrev}
              onClick={function() { if (docList && currentIdx > 0) { setCurrentDoc(docList[currentIdx - 1]); setZoom(1); setTextContent(''); } }}>
              <ChevronLeft className="h-3.5 w-3.5" />Əvvəlki
            </Button>
            <span className="text-[11px] text-slate-400">{currentIdx + 1} / {docList.length}</span>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" disabled={!hasNext}
              onClick={function() { if (docList && currentIdx < docList.length - 1) { setCurrentDoc(docList[currentIdx + 1]); setZoom(1); setTextContent(''); } }}>
              Növbəti<ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}