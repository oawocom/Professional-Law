'use client';
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { fetchApi } from '../../utils/apiHelper';
import { getStatusLabel, getStatusColor } from '../../utils/taskStatusConstants';
import { toast } from 'sonner';
import {
  Activity, FileText, ArrowRight, ArrowLeft, RefreshCw,
  Filter, X, ArrowUpDown, MessageSquare, Eye, FolderOpen,
  ChevronRight, Briefcase, DollarSign, Calendar, User,
  CheckCircle, Download
} from 'lucide-react';
import { FileViewerModal } from '../shared/FileViewerModal';
import { formatDate as sharedFormatDate, formatDateTime as sharedFormatDateTime } from '../../utils/dateFormat';

function fmtDT(d: any) {
  return sharedFormatDateTime(d, '—');
}
function fmtDate(d: any) {
  return sharedFormatDate(d, '—');
}
function parseJSON(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return [];
}
function g(obj: any, ...keys: string[]): any {
  if (!obj) return '';
  for (var k of keys) { if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k]; }
  return '';
}
// "Şəxsin adı + Şirkətin adı" formasında müştəri adı
function clientDisplay(clientObj: any, fallbackName?: string): string {
  var n = g(clientObj, 'name') || fallbackName || '';
  var c = g(clientObj, 'company_name', 'companyName', 'company');
  if (n && c) return n + ' — ' + c;
  return n || 'Naməlum müştəri';
}
// "Bütün tapşırıqlar" pəncərəsi ilə eyni prioritet təsviri — Nəzarət
// panelindəki tapşırıq detalı da indi bu sahələri göstərir.
function getPriorityLabel(p: string) {
  if (p === 'high' || p === 'urgent') return 'Yüksək';
  if (p === 'medium' || p === 'normal') return 'Orta';
  if (p === 'low') return 'Aşağı';
  return p || '';
}
function getPriorityClass(p: string) {
  if (p === 'high' || p === 'urgent') return 'border-red-300 text-red-700';
  if (p === 'medium' || p === 'normal') return 'border-yellow-300 text-yellow-700';
  return 'border-green-300 text-green-700';
}

var TYPE_FILTERS = [
  { key: 'all',              label: 'Hamısı',             icon: Activity },
  { key: 'status',           label: 'Status dəyişmələri', icon: ArrowUpDown },
  { key: 'document',         label: 'Sənəd əlavələri',    icon: FileText },
  { key: 'lawyer_to_client', label: 'Vəkil → Müştəri',   icon: ArrowRight },
  { key: 'client_to_lawyer', label: 'Müştəri → Vəkil',   icon: ArrowLeft },
];

var DATE_RANGES = [
  { key: 'all',    label: 'Bütün vaxt' },
  { key: 'today',  label: 'Bu gün' },
  { key: 'week',   label: 'Bu həftə' },
  { key: 'month',  label: 'Bu ay' },
  { key: 'custom', label: 'Xüsusi...' },
];


export function ControlPanelModal({ open, onOpenChange, lawyers = [], clients = [], tasks: propTasks = [], approvalRequests, onRefresh, tenantId }: any) {
  var lawyersList: any[] = lawyers || [];
  var clientsList: any[] = clients || [];
  var [tasks,    setTasks]    = useState<any[]>([]);
  var [messages, setMessages] = useState<any[]>([]);
  var [loading,  setLoading]  = useState(false);
  var [tick,     setTick]     = useState(0);
  var [viewerDoc, setViewerDoc] = useState<any>(null);

  // Nəzarət paneli artıq YALNIZ aktivlik lentindən ibarətdir — ayrı menyu/tab
  // başlığı yoxdur, panel açılan kimi birbaşa bu görünür. Bir aktivlik
  // sətrinə klikləyəndə həmin tapşırığın tam kontekstini sağda görmək olur
  // (izlənilə bilənliyi artırmaq üçün) — köhnə ayrıca "Tapşırıqlar" tabı
  // artıq lazım deyil, çünki bunun eyni funksiyasını dashboard-dakı
  // "Bütün tapşırıqlar" pəncərəsi onsuz da görür.

  // Activity filters
  var [typeFilter,   setTypeFilter]   = useState('all');
  var [clientFilter, setClientFilter] = useState('all');
  var [lawyerFilter, setLawyerFilter] = useState('all');
  var [dateRange,    setDateRange]    = useState('all');
  var [dateFrom,     setDateFrom]     = useState<Date | undefined>(undefined);
  var [dateTo,       setDateTo]       = useState<Date | undefined>(undefined);
  var [showFilters,  setShowFilters]  = useState(false);

  // Klikləndikdə sağda tam kontekst göstərilən tapşırıq
  var [selectedTask, setSelectedTask] = useState<any>(null);

  // Fetch
  useEffect(function() {
    if (!open) return;
    setLoading(true);
    Promise.all([
      fetchApi('/tasks?limit=500').catch(function() { return []; }),
      fetchApi('/messages?limit=500').catch(function() { return []; }),
    ]).then(function(res: any[]) {
      var t = res[0]; var m = res[1];
      setTasks(Array.isArray(t) ? t : (t?.tasks || []));
      setMessages(Array.isArray(m) ? m : (m?.messages || []));
    }).catch(function() {}).finally(function() { setLoading(false); });
  }, [open, tick]);

  // Unique clients/lawyers
  var allClients = useMemo(function() {
    var map: Record<string, string> = {};
    tasks.forEach(function(t: any) {
      var n = clientDisplay(t.client, t.client_name);
      var id = String(g(t.client, 'id') || t.client_id || '');
      if (n) map[id || n] = n;
    });
    clientsList.forEach(function(c: any) {
      var n = c.name || ''; var id = String(c.id || '');
      if (n) map[id || n] = n;
    });
    return Object.entries(map).map(function(e) { return { id: e[0], name: e[1] }; });
  }, [tasks, clientsList]);

  var allLawyers = useMemo(function() {
    var map: Record<string, string> = {};
    tasks.forEach(function(t: any) {
      var n = g(t.assignee, 'name') || t.assigned_lawyer || '';
      var id = String(g(t.assignee, 'id') || t.assigned_to || '');
      if (n) map[id || n] = n;
    });
    lawyersList.forEach(function(l: any) {
      var n = l.name || ''; var id = String(l.id || '');
      if (n && !l.is_archived && !l.isArchived) map[id || n] = n;
    });
    return Object.entries(map).map(function(e) { return { id: e[0], name: e[1] }; });
  }, [tasks, lawyersList]);

  // Date range check
  function inDateRange(ts: any): boolean {
    if (dateRange === 'all') return true;
    if (!ts) return false;
    var t = new Date(ts).getTime();
    var now = Date.now();
    if (dateRange === 'today') { var s = new Date(); s.setHours(0,0,0,0); return t >= s.getTime(); }
    if (dateRange === 'week')  return t >= now - 7 * 86400000;
    if (dateRange === 'month') return t >= now - 30 * 86400000;
    if (dateRange === 'custom') {
      var ok = true;
      if (dateFrom) ok = ok && t >= new Date(dateFrom).setHours(0,0,0,0);
      if (dateTo)   ok = ok && t <= new Date(dateTo).setHours(23,59,59,999);
      return ok;
    }
    return true;
  }

  // Build activity timeline
  var activity = useMemo(function() {
    var items: any[] = [];
    tasks.forEach(function(task: any) {
      if (task.status) {
        items.push({
          type: 'status', key: 'st-' + task.id, task,
          timestamp: task.updated_at || task.created_at,
          direction: 'lawyer_to_client',
          taskTitle: task.respondent_name
            ? task.respondent_name + (task.task_number ? ' #' + task.task_number : '')
            : task.title || '#' + task.id,
          clientName: clientDisplay(task.client, task.client_name),
          clientId: String(g(task.client, 'id') || task.client_id || ''),
          lawyerName: g(task.assignee, 'name') || task.assigned_lawyer || '',
          lawyerId: String(g(task.assignee, 'id') || task.assigned_to || ''),
        });
      }
      var docs = parseJSON(task.document_checklist || task.documentChecklist);
      docs.forEach(function(doc: any, di: number) {
        if (!doc.uploaded_at && !doc.is_later_addition) return;
        var dir = doc.uploaded_by === 'client' ? 'client_to_lawyer' : 'lawyer_to_client';
        items.push({
          type: 'document', key: 'doc-' + task.id + '-' + di, task, doc,
          timestamp: doc.uploaded_at || task.updated_at,
          direction: dir,
          taskTitle: task.respondent_name
            ? task.respondent_name + (task.task_number ? ' #' + task.task_number : '')
            : task.title || '#' + task.id,
          clientName: clientDisplay(task.client, task.client_name),
          clientId: String(g(task.client, 'id') || task.client_id || ''),
          lawyerName: g(task.assignee, 'name') || task.assigned_lawyer || '',
          lawyerId: String(g(task.assignee, 'id') || task.assigned_to || ''),
        });
      });
    });
    messages.forEach(function(msg: any) {
      // Backend sahəsi "sender_type"-dır (sender_role/senderRole heç vaxt
      // mövcud olmayıb) — bu səbəbdən mesajlar əvvəllər Nəzarət Panelinin
      // fəaliyyət lentində HEÇ VAXT görünmürdü.
      var sRole = msg.senderType || msg.sender_type || msg.sender_role || msg.senderRole || '';
      var dir = sRole === 'client' ? 'client_to_lawyer' : sRole === 'lawyer' ? 'lawyer_to_client' : null;
      if (!dir) return;
      var task = tasks.find(function(t: any) { return t.id === (msg.task_id || msg.taskId); });
      items.push({
        type: 'message', key: 'msg-' + msg.id, msg, task,
        timestamp: msg.created_at || msg.createdAt,
        direction: dir,
        content: msg.content || msg.message || '',
        taskTitle: task ? (task.respondent_name || task.title || '#' + task.id) : '',
        clientName: msg.client_name || g(task?.client, 'name') || '',
        clientId: String(msg.client_id || g(task?.client, 'id') || task?.client_id || ''),
        lawyerName: msg.lawyer_name || g(task?.assignee, 'name') || '',
        lawyerId: String(msg.lawyer_id || g(task?.assignee, 'id') || task?.assigned_to || ''),
      });
    });
    items.sort(function(a: any, b: any) {
      return (b.timestamp ? new Date(b.timestamp).getTime() : 0)
           - (a.timestamp ? new Date(a.timestamp).getTime() : 0);
    });
    return items;
  }, [tasks, messages]);

  // Apply filters
  var filteredActivity = useMemo(function() {
    return activity.filter(function(item: any) {
      if (typeFilter === 'status'           && item.type !== 'status')            return false;
      if (typeFilter === 'document'         && item.type !== 'document')          return false;
      if (typeFilter === 'lawyer_to_client' && item.direction !== 'lawyer_to_client') return false;
      if (typeFilter === 'client_to_lawyer' && item.direction !== 'client_to_lawyer') return false;
      if (clientFilter !== 'all') {
        if (item.clientId !== clientFilter && item.clientName !== clientFilter) return false;
      }
      if (lawyerFilter !== 'all') {
        if (item.lawyerId !== lawyerFilter && item.lawyerName !== lawyerFilter) return false;
      }
      if (!inDateRange(item.timestamp)) return false;
      return true;
    });
  }, [activity, typeFilter, clientFilter, lawyerFilter, dateRange, dateFrom, dateTo]);

  var activeFilterCount = [clientFilter !== 'all', lawyerFilter !== 'all', dateRange !== 'all'].filter(Boolean).length;

  // Bugünkü fəaliyyət say-summary-si (üst zolaqda göstərmək üçün)
  var todayCount = useMemo(function() {
    var s = new Date(); s.setHours(0, 0, 0, 0);
    return filteredActivity.filter(function(it: any) {
      return it.timestamp && new Date(it.timestamp).getTime() >= s.getTime();
    }).length;
  }, [filteredActivity]);

  // Activity item renderer
  function renderActivityItem(item: any) {
    var borderColor = 'border-l-slate-300';
    var icon = <Activity className="h-3.5 w-3.5 text-slate-400" />;
    var label = '';
    var detail = '';

    if (item.type === 'status') {
      borderColor = 'border-l-blue-400';
      icon = <ArrowUpDown className="h-3.5 w-3.5 text-blue-500" />;
      label = 'Status dəyişdi';
      detail = getStatusLabel(item.task?.status || '');
    } else if (item.type === 'document') {
      var isC = item.direction === 'client_to_lawyer';
      borderColor = isC ? 'border-l-violet-400' : 'border-l-amber-400';
      icon = <FileText className={'h-3.5 w-3.5 ' + (isC ? 'text-violet-500' : 'text-amber-500')} />;
      label = isC ? 'Müştəri sənəd yüklədi' : 'Vəkil sənəd yüklədi';
      detail = item.doc?.name || item.doc?.file_name || '';
    } else if (item.type === 'message') {
      var isC2 = item.direction === 'client_to_lawyer';
      borderColor = isC2 ? 'border-l-purple-400' : 'border-l-orange-400';
      icon = <MessageSquare className={'h-3.5 w-3.5 ' + (isC2 ? 'text-purple-500' : 'text-orange-500')} />;
      label = isC2 ? 'Müştəri mesaj göndərdi' : 'Vəkil mesaj göndərdi';
      detail = (item.content || '').slice(0, 70) + ((item.content || '').length > 70 ? '…' : '');
    }

    var isSel = !!(item.task && selectedTask && selectedTask.id === item.task.id);

    return (
      <button type="button" key={item.key}
        onClick={function() { if (item.task) setSelectedTask(item.task); }}
        className={'w-full text-left border-l-4 ' + borderColor + ' bg-white rounded-r-lg px-3 py-2.5 shadow-sm hover:shadow transition-shadow ' +
          (isSel ? 'ring-2 ring-indigo-300' : '') + (item.task ? ' cursor-pointer' : ' cursor-default')}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <div className="mt-0.5 shrink-0">{icon}</div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{item.taskTitle || '—'}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{label}{detail ? ' — ' + detail : ''}</p>
              {(item.clientName || item.lawyerName) && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {item.clientName && <span>Müştəri: {item.clientName}</span>}
                  {item.clientName && item.lawyerName && <span className="mx-1">·</span>}
                  {item.lawyerName && <span>Vəkil: {item.lawyerName}</span>}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-[10px] text-slate-400 whitespace-nowrap mt-0.5">{fmtDT(item.timestamp)}</span>
            {item.task && <ChevronRight className="h-3 w-3 text-slate-300" />}
          </div>
        </div>
      </button>
    );
  }

  // Task detail renderer
  function renderTaskDetail(task: any) {
    var claimAmounts = parseJSON(task.claim_amounts || task.claimAmounts);
    var totalClaim   = Number(task.total_claim || task.totalClaim || 0);
    var lawyerName   = g(task.assignee, 'name') || task.assigned_lawyer || '';
    var clientName   = clientDisplay(task.client, task.client_name);
    var respondent   = task.respondent_name || task.respondentName || task.title || '—';
    var contractName = g(task.contract, 'title', 'name') || task.contract_title || task.contractTitle || '';
    var statusColor  = getStatusColor(task.status || '');
    var statusLabel  = getStatusLabel(task.status || '');
    var taskDocs     = parseJSON(task.document_checklist || task.documentChecklist);
    var taskPriority = task.priority || 'normal';
    var taskCategory = task.category || task.taskTypeName || task.task_type_name || '';

    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-800 text-sm">{respondent}</h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              {task.task_number && <span className="text-xs text-slate-400">#{task.task_number}</span>}
              {contractName && (
                <span className="text-[11px] text-indigo-600 flex items-center gap-1">
                  <FolderOpen className="h-3 w-3" />{contractName}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge className={'text-[10px] ' + statusColor}>{statusLabel}</Badge>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className={'text-[9px] ' + getPriorityClass(taskPriority)}>{getPriorityLabel(taskPriority)}</Badge>
              {taskCategory && <Badge variant="secondary" className="text-[9px]">{taskCategory}</Badge>}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {clientName && (
            <div className="bg-blue-50 rounded-lg p-2.5">
              <p className="text-[10px] text-blue-500 font-medium mb-0.5 flex items-center gap-1"><User className="h-3 w-3" />Müştəri</p>
              <p className="font-semibold text-blue-800">{clientName}</p>
            </div>
          )}
          {task.court_name && (
            <div className="bg-slate-50 rounded-lg p-2.5">
              <p className="text-[10px] text-slate-400 font-medium mb-0.5">Məhkəmə</p>
              <p className="font-medium text-slate-700 text-[11px]">{task.court_name}</p>
              {task.case_number && <p className="text-slate-500 text-[10px]">İş № {task.case_number}</p>}
            </div>
          )}
          {task.deadline && (
            <div className="bg-amber-50 rounded-lg p-2.5">
              <p className="text-[10px] text-amber-500 font-medium mb-0.5 flex items-center gap-1"><Calendar className="h-3 w-3" />Deadline</p>
              <p className="font-medium text-amber-700">{fmtDate(task.deadline)}</p>
            </div>
          )}
        </div>

        {/* Claim amounts */}
        {(claimAmounts.length > 0 || totalClaim > 0) && (
          <div className="bg-emerald-50 rounded-lg p-2.5">
            <p className="text-[10px] text-emerald-600 font-medium mb-1 flex items-center gap-1"><DollarSign className="h-3 w-3" />İddia məbləği</p>
            {claimAmounts.map(function(ca: any, i: number) {
              return (
                <div key={i} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-emerald-700">{ca.type || ca.label || 'Məbləğ'}</span>
                  <span className="font-semibold text-emerald-800">₼{Number(ca.amount || 0).toLocaleString()}</span>
                </div>
              );
            })}
            {totalClaim > 0 && (
              <div className="flex items-center justify-between text-xs border-t border-emerald-200 mt-1.5 pt-1.5">
                <span className="font-semibold text-emerald-700">Cəmi</span>
                <span className="font-bold text-emerald-900">₼{Number(totalClaim).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Documents */}
        {taskDocs.length > 0 && (
          <div className="border rounded-xl p-3 bg-white space-y-1.5">
            <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-blue-600" />Sənədlər ({taskDocs.length})
            </p>
            {taskDocs.map(function(doc: any, di: number) {
              var uploader = doc.uploaded_by === 'client' ? 'Müştəri' : doc.uploaded_by === 'manager' ? 'Menecer' : 'Vəkil';
              return (
                <div key={di} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                  <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-slate-800 truncate">{doc.name || doc.file_name || 'Sənəd'}</p>
                    <p className="text-[9px] text-slate-400">{uploader}{doc.uploaded_at ? ' · ' + fmtDT(doc.uploaded_at) : ''}</p>
                  </div>
                  {(doc.file_data || doc.url) && (
                    <div className="shrink-0 flex items-center gap-0.5">
                      <button type="button" onClick={function() { setViewerDoc(doc); }}
                        title="Bax" className="p-1 hover:bg-blue-100 rounded">
                        <Eye className="h-3.5 w-3.5 text-blue-600" />
                      </button>
                      <a href={doc.file_data || doc.url} download={doc.name || 'file'}
                        title="Yüklə" className="p-1 hover:bg-blue-100 rounded" target="_blank" rel="noreferrer">
                        <Download className="h-3.5 w-3.5 text-blue-600" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {lawyerName && (
          <div className="border rounded-xl p-3 bg-indigo-50/60 space-y-1">
            <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5" />Təhkim olunan vəkil
            </p>
            <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-indigo-100">
              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0">
                {lawyerName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-800 truncate">{lawyerName}</p>
              </div>
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
            </div>
            <p className="text-[10px] text-slate-400">Vəkili dəyişmək üçün "Vəkil təhkimi" panelini istifadə edin</p>
          </div>
        )}

        {task.notes && (
          <div className="bg-slate-50 rounded-lg p-2.5">
            <p className="text-[10px] text-slate-400 font-medium mb-1">Qeydlər</p>
            <p className="text-xs text-slate-600 whitespace-pre-wrap">{task.notes}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] !flex !flex-col overflow-hidden p-0 gap-0">

        {/* Header — sadə başlıq, menyu/tab yoxdur. Panel açılan kimi birbaşa
            aktivlik lenti görünür (bu, panelin YEGANƏ görünüşüdür). */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5 text-indigo-600" />Nəzarət paneli
                <span className="text-[10px] font-normal bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
                  {filteredActivity.length}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Sistemdəki bütün iş axınını izləyin — kim nə etdi, nə dəyişdi
                {todayCount > 0 && <span className="text-indigo-600 font-medium"> · bu gün {todayCount} yeni</span>}
              </DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={function() { setTick(function(n) { return n + 1; }); }}
              disabled={loading} className="h-8 w-8 p-0" title="Yenilə">
              <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} />
            </Button>
          </div>
        </DialogHeader>

        {/* ── AKTİVLİK LENTİ (yeganə görünüş) ── */}
        <div className="flex flex-1 min-h-0">
          <div className="flex flex-col flex-1 min-h-0 min-w-0">
            {/* Filters */}
            <div className="px-5 pt-3 pb-2 border-b shrink-0 bg-slate-50/60 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {TYPE_FILTERS.map(function(f) {
                    var Icon = f.icon;
                    return (
                      <button key={f.key}
                        onClick={function() { setTypeFilter(f.key); }}
                        className={'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ' +
                          (typeFilter === f.key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300')}>
                        <Icon className="h-3 w-3" />{f.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={function() { setShowFilters(function(s) { return !s; }); }}
                  className={'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all shrink-0 ' +
                    (activeFilterCount > 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300')}>
                  <Filter className="h-3 w-3" />Filterlər{activeFilterCount > 0 ? ' (' + activeFilterCount + ')' : ''}
                </button>
              </div>

              {showFilters && (
                <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-slate-500 font-medium mb-1">Müştəri</p>
                      <Select value={clientFilter} onValueChange={setClientFilter}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Hamısı" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-xs">Hamısı</SelectItem>
                          {allClients.map(function(c) { return <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>; })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-medium mb-1">Vəkil</p>
                      <Select value={lawyerFilter} onValueChange={setLawyerFilter}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Hamısı" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-xs">Hamısı</SelectItem>
                          {allLawyers.map(function(l) { return <SelectItem key={l.id} value={l.id} className="text-xs">{l.name}</SelectItem>; })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-medium mb-1">Zaman</p>
                      <Select value={dateRange} onValueChange={function(v) { setDateRange(v); if (v !== 'custom') { setDateFrom(undefined); setDateTo(undefined); } }}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DATE_RANGES.map(function(r) { return <SelectItem key={r.key} value={r.key} className="text-xs">{r.label}</SelectItem>; })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {dateRange === 'custom' && (
                    <div className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 text-xs flex-1">{dateFrom ? fmtDate(dateFrom) : 'Başlanğıc'}</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <span className="text-slate-400 text-xs">—</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 text-xs flex-1">{dateTo ? fmtDate(dateTo) : 'Son tarix'}</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                  {activeFilterCount > 0 && (
                    <button className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                      onClick={function() { setClientFilter('all'); setLawyerFilter('all'); setDateRange('all'); setDateFrom(undefined); setDateTo(undefined); }}>
                      <X className="h-3 w-3" />Filterləri sıfırla
                    </button>
                  )}
                </div>
              )}
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="px-5 py-4 space-y-2">
                {loading ? (
                  <p className="text-center py-12 text-sm text-muted-foreground">Yüklənir...</p>
                ) : filteredActivity.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Activity className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Aktivlik tapılmadı</p>
                  </div>
                ) : filteredActivity.map(renderActivityItem)}
              </div>
            </ScrollArea>
          </div>

          {/* Sağ panel: aktivlik sətrinə klikləyəndə həmin tapşırığın tam
              konteksti burada açılır — izlənilməni asanlaşdırmaq üçün, ayrıca
              "Tapşırıqlar" tabına ehtiyac qalmadan. */}
          {selectedTask && (
            <div className="w-[360px] shrink-0 border-l flex flex-col min-h-0">
              <div className="px-4 py-2.5 border-b shrink-0 flex items-center justify-between bg-slate-50">
                <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" />Tapşırıq konteksti
                </p>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={function() { setSelectedTask(null); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4">{renderTaskDetail(selectedTask)}</div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
      <FileViewerModal doc={viewerDoc} open={!!viewerDoc} onClose={function() { setViewerDoc(null); }} />
    </Dialog>
  );
}