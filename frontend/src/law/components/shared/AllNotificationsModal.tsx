'use client';
import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { fetchApi } from '../../utils/apiHelper';
import { formatDateTime, formatDate, formatDateRelative } from '../../utils/dateFormat';
import { Bell, Search, Filter, ExternalLink, RefreshCw, CheckCheck } from 'lucide-react';

var TYPE_CONFIG: Record<string, { emoji: string; color: string; borderColor: string; label: string }> = {
  document_request:  { emoji: '📎', color: 'bg-blue-50',    borderColor: 'border-l-blue-400',    label: 'Sənəd tələbi' },
  status_update:     { emoji: '🔄', color: 'bg-violet-50',  borderColor: 'border-l-violet-400',  label: 'Status dəyişikliyi' },
  status_change:     { emoji: '🔄', color: 'bg-violet-50',  borderColor: 'border-l-violet-400',  label: 'Status dəyişikliyi' },
  court_date:        { emoji: '🏛️', color: 'bg-amber-50',   borderColor: 'border-l-amber-400',   label: 'Məhkəmə tarixi' },
  task_completed:    { emoji: '✅', color: 'bg-green-50',   borderColor: 'border-l-green-400',   label: 'Tapşırıq tamamlandı' },
  chat_message:      { emoji: '💬', color: 'bg-indigo-50',  borderColor: 'border-l-indigo-400',  label: 'Yeni mesaj' },
  task_note:         { emoji: '📝', color: 'bg-orange-50',  borderColor: 'border-l-orange-400',  label: 'Qeyd əlavə edildi' },
  deadline_reminder: { emoji: '⏰', color: 'bg-red-50',     borderColor: 'border-l-red-400',     label: 'Deadline xatırlatması' },
  approval_request:  { emoji: '✋', color: 'bg-yellow-50',  borderColor: 'border-l-yellow-400',  label: 'Təsdiq tələbi' },
  approval_done:     { emoji: '🎉', color: 'bg-green-50',   borderColor: 'border-l-green-400',   label: 'Təsdiq edildi' },
  new_task:          { emoji: '🆕', color: 'bg-cyan-50',    borderColor: 'border-l-cyan-400',    label: 'Yeni tapşırıq' },
  default:           { emoji: '🔔', color: 'bg-slate-50',   borderColor: 'border-l-slate-300',   label: 'Bildiriş' },
};

function getCfg(type: string) { return TYPE_CONFIG[type] || TYPE_CONFIG.default; }

function fmtFull(d: any): string {
  if (!d) return '';
  return formatDateTime(d, '');
}

function fmtTime(d: any): string {
  if (!d) return '';
  try {
    var dt = new Date(d);
    var diff = Date.now() - dt.getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'indi';
    if (mins < 60) return mins + ' dəq əvvəl';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + ' saat əvvəl';
    return formatDate(dt, '');
  } catch { return ''; }
}

var FILTERS = [
  { key: 'all',              label: 'Hamısı' },
  { key: 'unread',           label: 'Oxunmamış' },
  { key: 'status_change',    label: 'Status' },
  { key: 'document_request', label: 'Sənəd' },
  { key: 'chat_message',     label: 'Mesaj' },
  { key: 'deadline_reminder',label: 'Deadline' },
  { key: 'court_date',       label: 'Məhkəmə' },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId?: number | null;
  userType?: string;
  onViewTask?: (taskId: string | number) => void;
}

export function AllNotificationsModal({ open, onOpenChange, userId, userType, onViewTask }: Props) {
  var [notifications, setNotifications] = useState<any[]>([]);
  var [loading, setLoading] = useState(false);
  var [search, setSearch] = useState('');
  var [filter, setFilter] = useState('all');
  var [tick, setTick] = useState(0);

  var fetch_ = useCallback(function() {
    setLoading(true);
    var params = new URLSearchParams();
    if (userId)   params.set('user_id',   String(userId));
    if (userType) params.set('user_type', userType);
    params.set('limit', '200');
    fetchApi('/notifications?' + params.toString())
      .then(function(data: any) { setNotifications(Array.isArray(data) ? data : []); })
      .catch(function() {})
      .finally(function() { setLoading(false); });
  }, [userId, userType]);

  useEffect(function() { if (open) fetch_(); }, [open, tick, fetch_]);

  var markAllRead = async function() {
    var ids = notifications.filter(function(n: any) { return !n.is_read; }).map(function(n: any) { return n.id; });
    if (!ids.length) return;
    try {
      await fetchApi('/notifications/mark-read', { method: 'POST', body: JSON.stringify({ ids }) });
      setNotifications(function(prev: any[]) { return prev.map(function(n: any) { return { ...n, is_read: true }; }); });
    } catch {}
  };

  var filtered = notifications.filter(function(n: any) {
    if (filter === 'unread' && (n.is_read || n.isRead)) return false;
    if (filter !== 'all' && filter !== 'unread' && n.type !== filter) return false;
    if (search) {
      var term = search.toLowerCase();
      return (n.title || '').toLowerCase().includes(term) ||
             (n.message || '').toLowerCase().includes(term);
    }
    return true;
  });

  var unreadCount = notifications.filter(function(n: any) { return !n.is_read; }).length;

  // Group by date — QEYD (2026-09, bildiriş paneli modernləşdirməsi): "Bugün" /
  // "Dünən" kimi nisbi etiketlər üçün artıq mövcud (əvvəllər istifadə olunmayan)
  // formatDateRelative helper-i işə salınıb; daha köhnə tarixlər üçün eynilə
  // dəqiq tarix (formatDate) göstərilir — qruplaşdırma məntiqi dəyişməyib.
  var groups: Record<string, any[]> = {};
  filtered.forEach(function(n: any) {
    var d = n.created_at || n.createdAt;
    var dateKey = d ? formatDateRelative(d, 'Naməlum tarix') : 'Naməlum tarix';
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(n);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] p-0 !flex !flex-col overflow-hidden gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0 pr-12">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Bell className="h-5 w-5 text-blue-600" />Bildirişlər və İş tarixçəsi
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Tapşırıqlarla bağlı bütün fəaliyyətlər və loglar
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={markAllRead}>
                  <CheckCheck className="h-3.5 w-3.5" />Hamısını oxu
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={function() { setTick(function(n) { return n + 1; }); }} disabled={loading}>
                <RefreshCw className={'h-3.5 w-3.5 ' + (loading ? 'animate-spin' : '')} />
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-9 h-8 text-sm" placeholder="Bildirişlərdə axtar..." value={search}
              onChange={function(e) { setSearch(e.target.value); }} />
          </div>

          {/* Filters */}
          <div className="flex gap-1.5 flex-wrap mt-2">
            {FILTERS.map(function(f) {
              var count = f.key === 'all' ? notifications.length
                : f.key === 'unread' ? unreadCount
                : notifications.filter(function(n: any) { return n.type === f.key; }).length;
              return (
                <button key={f.key}
                  onClick={function() { setFilter(f.key); }}
                  className={'px-2.5 py-1 rounded-full text-xs font-medium transition-all ' +
                    (filter === f.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                  {f.label} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
                </button>
              );
            })}
          </div>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-5">
            {loading && filtered.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <Bell className="h-7 w-7 opacity-25" />
                </div>
                <p className="text-sm">
                  {notifications.length === 0 ? 'Hələ ki bildirişiniz yoxdur' : 'Bildiriş tapılmadı'}
                </p>
                {notifications.length > 0 && (search || filter !== 'all') && (
                  <button
                    className="text-xs text-blue-600 hover:underline mt-1.5"
                    onClick={function() { setSearch(''); setFilter('all'); }}
                  >
                    Axtarışı və filtrləri sıfırla
                  </button>
                )}
              </div>
            ) : Object.entries(groups).map(function([dateKey, items]) {
              return (
                <div key={dateKey}>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
                    {dateKey}
                  </p>
                  <div className="space-y-2">
                    {items.map(function(notif: any) {
                      var isRead = notif.is_read || notif.isRead;
                      var cfg = getCfg(notif.type || '');
                      var taskId = notif.entity_id || notif.entityId || notif.task_id || notif.taskId;
                      // DÜZGÜNLÜK (2026-09): `entity_id` təkcə tapşırıq ID-si demək
                      // DEYİL — backend eyni sahəni müqavilə/müştəri/təsdiq
                      // bildirişləri üçün də istifadə edir (bax NotificationDropdown.tsx-
                      // dəki eyni qeyd, bölmə 19-un davamı). `onViewTask` yalnız
                      // tapşırıq ID-si gözlədiyi üçün, "Tapşırığa keç" düyməsi
                      // YALNIZ "task" tipli (və ya entity_type göstərilməyən köhnə)
                      // bildirişlərdə göstərilir — əks halda səhv və ya heç bir
                      // tapşırığın açılmasına səbəb olardı.
                      var entType = notif.entity_type || notif.entityType || '';
                      var isTaskEntity = !entType || entType === 'task';
                      var hasTask = !!taskId && isTaskEntity;

                      return (
                        <div
                          key={notif.id}
                          className={'border-l-4 ' + cfg.borderColor + ' ' + cfg.color + ' rounded-r-xl px-4 py-3 ' +
                            (isRead ? '' : 'ring-1 ring-blue-200')}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <span className="text-base shrink-0 mt-0.5">{cfg.emoji}</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className={'text-sm font-semibold ' + (isRead ? 'text-slate-700' : 'text-slate-900')}>
                                    {notif.title || cfg.label}
                                  </p>
                                  {!isRead && (
                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">{notif.message}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                {fmtTime(notif.created_at || notif.createdAt)}
                              </span>
                              {hasTask && (
                                <button
                                  className="flex items-center gap-1 text-[10px] font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2 py-0.5 rounded-full transition-colors"
                                  onClick={function() {
                                    onOpenChange(false);
                                    if (onViewTask) onViewTask(taskId);
                                  }}
                                >
                                  <ExternalLink className="h-2.5 w-2.5" />Tapşırığa keç
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}