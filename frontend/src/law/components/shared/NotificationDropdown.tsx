'use client';
import { useState, useEffect, useCallback } from 'react';
import { Bell, ArrowRight, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { fetchApi } from '../../utils/apiHelper';
import { formatDate } from '../../utils/dateFormat';

// ── Notification type → icon + color ─────────────────────────────────────────
var TYPE_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  document_request:  { emoji: '📎', color: 'bg-blue-100 text-blue-700',    label: 'Sənəd tələbi' },
  status_update:     { emoji: '🔄', color: 'bg-violet-100 text-violet-700', label: 'Status dəyişikliyi' },
  status_change:     { emoji: '🔄', color: 'bg-violet-100 text-violet-700', label: 'Status dəyişikliyi' },
  court_date:        { emoji: '🏛️', color: 'bg-amber-100 text-amber-700',   label: 'Məhkəmə tarixi' },
  task_completed:    { emoji: '✅', color: 'bg-green-100 text-green-700',   label: 'Tapşırıq tamamlandı' },
  chat_message:      { emoji: '💬', color: 'bg-indigo-100 text-indigo-700', label: 'Yeni mesaj' },
  task_note:         { emoji: '📝', color: 'bg-orange-100 text-orange-700', label: 'Qeyd əlavə edildi' },
  deadline_reminder: { emoji: '⏰', color: 'bg-red-100 text-red-700',       label: 'Deadline xatırlatması' },
  approval_request:  { emoji: '✋', color: 'bg-yellow-100 text-yellow-700', label: 'Təsdiq tələbi' },
  approval_done:     { emoji: '🎉', color: 'bg-green-100 text-green-700',   label: 'Təsdiq edildi' },
  new_task:          { emoji: '🆕', color: 'bg-cyan-100 text-cyan-700',     label: 'Yeni tapşırıq' },
  default:           { emoji: '🔔', color: 'bg-slate-100 text-slate-700',   label: 'Bildiriş' },
};

function getTypeConfig(type: string, title?: string, message?: string) {
  var t = (type || '').toLowerCase();
  if (TYPE_CONFIG[t]) return TYPE_CONFIG[t];

  // Dəqiq açar tapılmadı — type/title/message mətnində açar söz axtar
  var hay = (t + ' ' + (title || '') + ' ' + (message || '')).toLowerCase();
  if (/(status|vəziyyət|dəyiş)/.test(hay))                 return TYPE_CONFIG.status_change;
  if (/(sənəd|document|fayl|sened)/.test(hay))             return TYPE_CONFIG.document_request;
  if (/(mesaj|message|chat|yazdı)/.test(hay))              return TYPE_CONFIG.chat_message;
  if (/(məhkəmə|court|mehkeme|iclas)/.test(hay))           return TYPE_CONFIG.court_date;
  if (/(tamamlan|complete|bitir|yerinə yet)/.test(hay))    return TYPE_CONFIG.task_completed;
  if (/(qeyd|note|comment|şərh|serh)/.test(hay))           return TYPE_CONFIG.task_note;
  if (/(deadline|müddət|son tarix|xatırlat|muddet)/.test(hay)) return TYPE_CONFIG.deadline_reminder;
  if (/(təsdiq|approval|approve|tesdiq)/.test(hay))        return TYPE_CONFIG.approval_request;
  if (/(yeni tapşırıq|new task|təhkim|tehkim|yeni task|assign)/.test(hay)) return TYPE_CONFIG.new_task;
  if (/(tapşırıq|task|tapsiriq)/.test(hay))                return TYPE_CONFIG.new_task;
  return TYPE_CONFIG.default;
}

function fmtTime(d: any): string {
  if (!d) return '';
  try {
    var dt = new Date(d);
    var diff = Date.now() - dt.getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'indi';
    if (mins < 60) return mins + ' dəq əvvəl';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + ' saat əvvəl';
    var days = Math.floor(hours / 24);
    if (days < 7)  return days + ' gün əvvəl';
    return formatDate(dt, '');
  } catch { return ''; }
}

interface Props {
  tenantId?: number | null;
  userId?: number | null;
  userType?: string;
  onViewTask?: (taskId: string | number) => void;
  onNavigate?: (info: { type: string; entityId: any; entityType: string | null; notif: any }) => void;
  onViewAll?: () => void;
  onViewAllNotifications?: () => void;
  validTaskIds?: Array<string | number>;
}

export function NotificationDropdown({ tenantId, userId, userType, onViewTask, onNavigate, onViewAll, onViewAllNotifications, validTaskIds }: Props) {
  var viewAll = onViewAll || onViewAllNotifications;
  var [notifications, setNotifications] = useState<any[]>([]);
  var [open, setOpen] = useState(false);
  var [marking, setMarking] = useState(false);
  var [showFilters, setShowFilters] = useState(false);
  var [typeFilter, setTypeFilter] = useState('all');
  var [readFilter, setReadFilter] = useState('all'); // all | unread | read

  var unread = notifications.filter(function(n: any) { return !n.is_read && !n.isRead; }).length;

  var fetchNotifs = useCallback(function() {
    var params = new URLSearchParams();
    if (userId)   params.set('user_id',   String(userId));
    if (userType) params.set('user_type', userType);
    fetchApi('/notifications?' + params.toString())
      .then(function(data: any) { setNotifications(Array.isArray(data) ? data : []); })
      .catch(function() {});
  }, [userId, userType]);

  // Fetch on mount + every 30s
  useEffect(function() {
    fetchNotifs();
    var id = setInterval(fetchNotifs, 30000);
    return function() { clearInterval(id); };
  }, [fetchNotifs]);

  // Mark all as read when opened
  var markAllRead = async function() {
    var unreadIds = notifications
      .filter(function(n: any) { return !n.is_read && !n.isRead; })
      .map(function(n: any) { return n.id; });
    if (unreadIds.length === 0) return;
    setMarking(true);
    try {
      await fetchApi('/notifications/mark-read', { method: 'POST', body: JSON.stringify({ ids: unreadIds }) });
      setNotifications(function(prev: any[]) {
        return prev.map(function(n: any) { return { ...n, is_read: true }; });
      });
    } catch {}
    finally { setMarking(false); }
  };

  var handleOpen = function(v: boolean) {
    setOpen(v);
    if (v) markAllRead();
  };

  var extractTaskId = function(notif: any) {
    return notif.entity_id || notif.entityId || notif.task_id || notif.taskId ||
           notif.related_id || notif.relatedId || (notif.data && (notif.data.task_id || notif.data.taskId));
  };

  // DÜZGÜNLÜK (2026-09): `entity_id` təkcə tapşırıq ID-si demək DEYİL — backend
  // (handlers.go-dakı notify*/EntityType) eyni sahəni müqavilə ("contract"),
  // müştəri ("client") və təsdiq ("approval") bildirişləri üçün də istifadə edir
  // (məs. "contract_created" bildirişində entity_id → müqavilənin ID-si).
  // `onNavigate` yoxdursa (vəkil/müştəri — bax bölmə 19), bu ID birbaşa
  // `onViewTask`-a (yalnız TAPŞIRIQ ID-si gözləyən) ötürülürdü — nəticədə
  // müqavilə/müştəri/təsdiq bildirişlərinə klikləmək YA heç nə etmirdi (uyğun
  // ID-li tapşırıq yoxdursa), YA DA (nadir ID-toqquşması halında) SƏHV bir
  // tapşırığı açırdı. Bu funksiya YALNIZ "task" tipli (və ya entity_type
  // göstərilməyən köhnə) bildirişləri "tapşırığa keçid üçün etibarlı" sayır.
  var isTaskNotif = function(notif: any) {
    var et = notif.entity_type || notif.entityType || '';
    return !et || et === 'task';
  };

  // Bildirişin növünə görə hara aparacağını müəyyən edir
  var navigateNotif = function(notif: any) {
    setOpen(false);
    var entityId = extractTaskId(notif);
    // Universal handler varsa, ona ötür (dashboard qərar verir — entity_type-i
    // özü nəzərə alır, bax ManagerDashboard.handleNotifNavigate)
    if (onNavigate) {
      onNavigate({
        type: notif.type,
        entityId: entityId,
        entityType: notif.entity_type || notif.entityType || null,
        notif: notif,
      });
      return;
    }
    // Geri uyğunluq: köhnə onViewTask — YALNIZ həqiqətən "task" tipli bildiriş
    // üçün (bax yuxarıdakı isTaskNotif qeydi).
    if (entityId != null && onViewTask && isTaskNotif(notif)) onViewTask(entityId);
  };

  var handleNotifClick = function(notif: any) {
    navigateNotif(notif);
  };

  // validTaskIds verilibsə, silinmiş tapşırıqlara aid köhnə bildirişləri gizlət
  var validSet = validTaskIds ? new Set(validTaskIds.map(function(x) { return String(x); })) : null;

  // Filtrlər tətbiq olunur (13-cü məsələ)
  var filtered = notifications.filter(function(n: any) {
    // Silinmiş tapşırığın bildirişini gizlət (yalnız tapşırığa bağlı bildirişlər üçün).
    // DÜZGÜNLÜK (2026-09): `isTaskNotif` yoxlaması olmadan bu, "task" olmayan
    // (contract/client/approval) bildirişləri də `validTaskIds` (yalnız tapşırıq
    // ID-lərindən ibarət dəst) ilə müqayisə edirdi — demək olar HEÇ VAXT uyğun
    // gəlməyən bu müqayisə, o bildirişləri (məs. "Yeni müqavilə yaradıldı")
    // səhvən "silinmiş tapşırığa aid" sayıb TAMAMILƏ GİZLƏDİRDİ. Menecer
    // panelində (`validTaskIds` ötürülən yeganə yer) bu, contract/client/
    // approval bildirişlərinin demək olar heç görünməməsinə səbəb olurdu.
    if (validSet && isTaskNotif(n)) {
      var tid = extractTaskId(n);
      if (tid != null && !validSet.has(String(tid))) return false;
    }
    var isRead = n.is_read || n.isRead;
    if (readFilter === 'unread' && isRead) return false;
    if (readFilter === 'read' && !isRead) return false;
    if (typeFilter !== 'all' && (n.type || '') !== typeFilter) return false;
    return true;
  });
  var visible = filtered.slice(0, 30);

  // Mövcud bildirişlərdəki növlər (filtr seçimləri üçün)
  var availableTypes = Array.from(new Set(notifications.map(function(n: any) { return n.type; }).filter(Boolean)));

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group">
          <Bell className="h-5 w-5 transition-transform group-hover:scale-110 group-hover:rotate-12" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] font-bold bg-red-500 border-2 border-background animate-pulse">
              {unread > 9 ? '9+' : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[340px] p-0 rounded-2xl shadow-2xl border" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-slate-600" />
            <h3 className="font-semibold text-sm">Bildirişlər</h3>
            {unread > 0 && (
              <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5">{unread} yeni</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
              title="Ətraflı baxış / filtr"
              onClick={function() { setShowFilters(function(v) { return !v; }); }}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
            {unread > 0 && (
              <button className="text-[11px] text-blue-600 hover:underline" onClick={markAllRead} disabled={marking}>
                Hamısını oxu
              </button>
            )}
          </div>
        </div>

        {/* Filtr paneli (ətraflı baxış) */}
        {showFilters && (
          <div className="px-4 py-3 border-b bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-600">Filtr</span>
              <button className="text-slate-400 hover:text-slate-600" onClick={function() { setShowFilters(false); }}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 mb-1">Vəziyyət</p>
              <div className="flex gap-1">
                {[['all','Hamısı'],['unread','Oxunmamış'],['read','Oxunmuş']].map(function(o) {
                  return (
                    <button key={o[0]}
                      className={'px-2 py-1 rounded text-[10px] font-medium transition-colors ' +
                        (readFilter === o[0] ? 'bg-blue-600 text-white' : 'bg-white border text-slate-600 hover:bg-slate-100')}
                      onClick={function() { setReadFilter(o[0]); }}>
                      {o[1]}
                    </button>
                  );
                })}
              </div>
            </div>
            {availableTypes.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Mövzu</p>
                <div className="flex flex-wrap gap-1">
                  <button
                    className={'px-2 py-1 rounded text-[10px] font-medium transition-colors ' +
                      (typeFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white border text-slate-600 hover:bg-slate-100')}
                    onClick={function() { setTypeFilter('all'); }}>
                    Hamısı
                  </button>
                  {availableTypes.map(function(t: any) {
                    var cfg = getTypeConfig(t);
                    return (
                      <button key={t}
                        className={'px-2 py-1 rounded text-[10px] font-medium transition-colors inline-flex items-center gap-1 ' +
                          (typeFilter === t ? 'bg-blue-600 text-white' : 'bg-white border text-slate-600 hover:bg-slate-100')}
                        onClick={function() { setTypeFilter(t); }}>
                        <span>{cfg.emoji}</span>{cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto overscroll-contain">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground px-4">
              <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <Bell className="h-6 w-6 opacity-30" />
              </div>
              {notifications.length === 0 ? (
                <p className="text-sm text-center">Hələ ki bildirişiniz yoxdur</p>
              ) : (
                <>
                  <p className="text-sm text-center">Filtrə uyğun bildiriş tapılmadı</p>
                  <button
                    className="text-[11px] text-blue-600 hover:underline mt-1.5"
                    onClick={function() { setTypeFilter('all'); setReadFilter('all'); }}
                  >
                    Filtrləri sıfırla
                  </button>
                </>
              )}
            </div>
          ) : visible.map(function(notif: any) {
            var isRead = notif.is_read || notif.isRead;
            var cfg = getTypeConfig(notif.type || '', notif.title, notif.message);
            var taskId = extractTaskId(notif);
            // onNavigate varsa (menecer), entity_type-dan asılı olmayaraq kliklənə
            // bilər (özü düzgün istiqamətləndirir). Yoxdursa (vəkil/müştəri,
            // geri-uyğunluq onViewTask yolu), YALNIZ "task" tipli bildirişlər
            // üçün — bax yuxarıdakı isTaskNotif qeydi.
            var clickable = !!(taskId != null && (onNavigate || (onViewTask && isTaskNotif(notif))));

            return (
              <div
                key={notif.id}
                className={'flex items-start gap-3 px-4 py-3 border-b last:border-0 transition-colors ' +
                  (isRead ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/60 hover:bg-blue-50') +
                  (clickable ? ' cursor-pointer' : '')}
                onClick={clickable ? function() { handleNotifClick(notif); } : undefined}
              >
                {/* Type icon */}
                <div className={'w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 ' + cfg.color}>
                  {cfg.emoji}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <p className={'text-xs font-semibold truncate ' + (isRead ? 'text-slate-700' : 'text-slate-900')}>
                      {notif.title || cfg.label}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isRead && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {fmtTime(notif.created_at || notif.createdAt)}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                    {notif.message}
                  </p>
                  {clickable && (
                    <button
                      className="inline-flex items-center justify-center w-6 h-6 rounded-md text-blue-600 hover:bg-blue-100 mt-1 transition-colors"
                      title="Tapşırığa keç"
                      onClick={function(e) {
                        e.stopPropagation();
                        navigateNotif(notif);
                      }}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer — yalnız arxada həqiqətən "bütün bildirişlər" funksiyası (viewAll)
            varsa göstərilir (bax bölmə 19: menecerdə bu funksiya heç qurulmayıb,
            "onNavigate" var amma AllNotificationsModal istifadə olunmur — bu,
            düymənin heç nə etmədiyi, "ölü" görünən bir vəziyyət yaradırdı). */}
        {viewAll && (
          <div className="px-4 py-3 border-t bg-slate-50/50">
            <Button
              variant="ghost" size="sm" className="w-full text-xs text-slate-600 hover:text-slate-900"
              onClick={function() { setOpen(false); viewAll(); }}
            >
              Bütün bildirişləri gör
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}