'use client';
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { fetchApi } from '../../utils/apiHelper';
import { getStatusLabel, getStatusColor } from '../../utils/taskStatusConstants';
import { formatDate as sharedFormatDate, formatDateTime as sharedFormatDateTime } from '../../utils/dateFormat';
import { toast } from 'sonner';
import {
  Briefcase, Search, FolderOpen, Calendar, DollarSign, FileText, Eye, Download,
  User, CheckCircle, Loader2, RefreshCw, Filter
} from 'lucide-react';
import { FileViewerModal } from '../shared/FileViewerModal';

function fmtDate(d: any) {
  return sharedFormatDate(d, '—');
}
function fmtDT(d: any) {
  return sharedFormatDateTime(d, '—');
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
function clientDisplay(clientObj: any, fallbackName?: string): string {
  var n = g(clientObj, 'name') || fallbackName || '';
  var c = g(clientObj, 'company_name', 'companyName', 'company');
  if (n && c) return n + ' — ' + c;
  return n || 'Naməlum müştəri';
}
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
function specList(l: any): string[] {
  var arr = l.specializations;
  if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { arr = null; } }
  if (Array.isArray(arr) && arr.length) return arr;
  if (l.specialization) return String(l.specialization).split(',').map(function(s: string) { return s.trim(); }).filter(Boolean);
  return [];
}

export function LawyerAssignmentModal({ open, onOpenChange, lawyers = [], onRefresh }: any) {
  var lawyersList: any[] = lawyers || [];
  var [tasks, setTasks] = useState<any[]>([]);
  var [loading, setLoading] = useState(false);
  var [tick, setTick] = useState(0);
  var [viewerDoc, setViewerDoc] = useState<any>(null);

  var [search, setSearch] = useState('');
  var [onlyUnassigned, setOnlyUnassigned] = useState(true);
  var [selectedTask, setSelectedTask] = useState<any>(null);
  var [assigning, setAssigning] = useState(false);
  var [assignLawyer, setAssignLawyer] = useState('');

  // QEYD: əvvəllər eyni anda yalnız BİR tapşırığı bir vəkilə təhkim etmək
  // mümkün idi — oxşar çoxlu tapşırığı (məs. eyni müştərinin bir neçə işini)
  // bir vəkilə vermək üçün hər dəfə ayrıca açıb-bağlamaq lazım gəlirdi. "Toplu
  // seçim" rejimi əlavə edildi: bir neçə tapşırıq seçilib bir əməliyyatla eyni
  // vəkilə təhkim edilə bilər.
  var [bulkMode, setBulkMode] = useState(false);
  var [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  var [bulkAssignLawyer, setBulkAssignLawyer] = useState('');
  var [bulkAssigning, setBulkAssigning] = useState(false);

  useEffect(function() {
    if (!open) return;
    setLoading(true);
    fetchApi('/tasks?limit=500').then(function(t: any) {
      var list = Array.isArray(t) ? t : (t?.tasks || []);
      setTasks(list);
    }).catch(function() { setTasks([]); }).finally(function() { setLoading(false); });
  }, [open, tick]);

  var filteredTasks = useMemo(function() {
    var term = search.toLowerCase();
    return tasks.filter(function(t: any) {
      if (onlyUnassigned && (t.assigned_to || t.assignee)) return false;
      if (t.status === 'completed' || t.status === 'cancelled' || t.is_tamamlandi || t.is_tehvil_verildi) return false;
      if (!term) return true;
      return [
        t.respondent_name || '', t.title || '',
        g(t.contract, 'title', 'name') || t.contract_title || '',
        clientDisplay(t.client, t.client_name),
        t.task_number || ''
      ].some(function(s: string) { return String(s).toLowerCase().includes(term); });
    }).sort(function(a: any, b: any) {
      // Deadline-i olanlar əvvəl, sonra tarixə görə
      var ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      var bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return ad - bd;
    });
  }, [tasks, search, onlyUnassigned]);

  var unassignedCount = tasks.filter(function(t: any) {
    return !(t.assigned_to || t.assignee) && t.status !== 'completed' && t.status !== 'cancelled';
  }).length;

  async function handleAssign() {
    if (!selectedTask || !assignLawyer) return;
    setAssigning(true);
    try {
      var lawyer = lawyersList.find(function(l: any) { return String(l.id) === assignLawyer; });
      await fetchApi('/tasks/' + selectedTask.id, {
        method: 'PUT',
        body: JSON.stringify({ assigned_to: Number(assignLawyer) }),
      });
      toast.success((lawyer?.name || 'Vəkil') + ' tapşırığa təhkim edildi');
      setAssignLawyer('');
      setTick(function(n) { return n + 1; });
      setSelectedTask(function(prev: any) { return prev ? { ...prev, assigned_to: Number(assignLawyer), assignee: lawyer } : prev; });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error('Xəta: ' + (err?.message || 'Təhkim edilə bilmədi'));
    } finally {
      setAssigning(false);
    }
  }

  function toggleBulkSelect(taskId: any) {
    var key = String(taskId);
    setBulkSelectedIds(function(prev) {
      var next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleBulkAssign() {
    if (bulkSelectedIds.size === 0 || !bulkAssignLawyer) return;
    setBulkAssigning(true);
    var lawyer = lawyersList.find(function(l: any) { return String(l.id) === bulkAssignLawyer; });
    var ids = Array.from(bulkSelectedIds);
    var okCount = 0, failCount = 0;
    for (var i = 0; i < ids.length; i++) {
      try {
        await fetchApi('/tasks/' + ids[i], {
          method: 'PUT',
          body: JSON.stringify({ assigned_to: Number(bulkAssignLawyer) }),
        });
        okCount++;
      } catch {
        failCount++;
      }
    }
    setBulkAssigning(false);
    if (okCount > 0) {
      toast.success(okCount + ' tapşırıq ' + (lawyer?.name || 'vəkilə') + ' təhkim edildi' + (failCount > 0 ? ' (' + failCount + ' uğursuz)' : ''));
    } else {
      toast.error('Təhkim edilə bilmədi');
    }
    setBulkSelectedIds(new Set());
    setBulkAssignLawyer('');
    setBulkMode(false);
    setTick(function(n) { return n + 1; });
    if (onRefresh) onRefresh();
  }

  var lawyerOptions = lawyersList.filter(function(l: any) { return !l.is_archived && !l.isArchived; });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] !flex !flex-col overflow-hidden p-0 gap-0" data-modal="lawyer-assignment">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Briefcase className="h-5 w-5 text-indigo-600" />Vəkil təhkimi
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Tapşırığı seçin, vəkillərin iş yükünə və ixtisasına baxıb uyğun vəkili təhkim edin
              </DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={function() { setTick(function(n) { return n + 1; }); }}
              disabled={loading} className="h-8 w-8 p-0">
              <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left: task list */}
          <div className="w-[340px] shrink-0 border-r flex flex-col min-h-0">
            <div className="p-3 border-b space-y-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input className="pl-8 h-8 text-xs" placeholder="Tapşırıq, müştəri axtar..."
                  value={search} onChange={function(e) { setSearch(e.target.value); }} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button"
                  onClick={function() { setOnlyUnassigned(!onlyUnassigned); }}
                  className={'text-[11px] px-2.5 py-1 rounded-full border flex items-center gap-1 transition-colors ' +
                    (onlyUnassigned ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-300 text-slate-600')}>
                  <Filter className="h-3 w-3" />Yalnız təhkim olunmamış
                </button>
                <span className="text-[10px] text-slate-400">{unassignedCount} təhkim gözləyir</span>
              </div>
              <button type="button"
                onClick={function() { setBulkMode(!bulkMode); setBulkSelectedIds(new Set()); setSelectedTask(null); }}
                className={'w-full text-[11px] px-2.5 py-1.5 rounded-lg border flex items-center justify-center gap-1.5 transition-colors ' +
                  (bulkMode ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-300 text-slate-600 hover:border-emerald-300')}>
                <CheckCircle className="h-3 w-3" />{bulkMode ? 'Toplu seçimi bağla' : 'Bir neçə tapşırığı birlikdə təhkim et'}
              </button>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2 space-y-1.5">
                {loading ? (
                  <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>
                ) : filteredTasks.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Uyğun tapşırıq yoxdur
                  </div>
                ) : filteredTasks.map(function(t: any) {
                  var isSel = bulkMode ? bulkSelectedIds.has(String(t.id)) : (selectedTask && String(selectedTask.id) === String(t.id));
                  var lawyerName = g(t.assignee, 'name') || t.assigned_lawyer || '';
                  return (
                    <button key={t.id} type="button"
                      onClick={function() { if (bulkMode) { toggleBulkSelect(t.id); } else { setSelectedTask(t); setAssignLawyer(''); } }}
                      className={'w-full text-left rounded-lg border p-2.5 transition-colors flex items-start gap-2 ' +
                        (isSel ? (bulkMode ? 'border-emerald-400 bg-emerald-50' : 'border-indigo-400 bg-indigo-50') : 'border-slate-200 bg-white hover:border-slate-300')}>
                      {bulkMode && (
                        <div className={'mt-0.5 h-4 w-4 rounded border shrink-0 flex items-center justify-center ' +
                          (isSel ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 bg-white')}>
                          {isSel && <CheckCircle className="h-3 w-3 text-white" />}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">{t.respondent_name || t.title || ('#' + t.id)}</p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{clientDisplay(t.client, t.client_name)}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge className={'text-[9px] ' + getStatusColor(t.status || '')}>{getStatusLabel(t.status || '')}</Badge>
                          {t.deadline && <span className="text-[9px] text-amber-600 flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />{fmtDate(t.deadline)}</span>}
                          {lawyerName && <span className="text-[9px] text-green-600">{lawyerName}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right: task detail + assignment (or toplu təhkim paneli) */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4">
              {bulkMode ? (
                <BulkAssignPanel
                  count={bulkSelectedIds.size}
                  lawyerOptions={lawyerOptions}
                  assignLawyer={bulkAssignLawyer}
                  setAssignLawyer={setBulkAssignLawyer}
                  assigning={bulkAssigning}
                  handleAssign={handleBulkAssign}
                />
              ) : !selectedTask ? (
                <div className="text-center py-20 text-slate-400 text-sm">
                  <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  Təhkim etmək üçün soldan bir tapşırıq seçin
                </div>
              ) : (
                <TaskAssignPanel
                  task={selectedTask}
                  lawyerOptions={lawyerOptions}
                  assignLawyer={assignLawyer}
                  setAssignLawyer={setAssignLawyer}
                  assigning={assigning}
                  handleAssign={handleAssign}
                  setViewerDoc={setViewerDoc}
                />
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>

      <FileViewerModal open={!!viewerDoc} onOpenChange={function(v: boolean) { if (!v) setViewerDoc(null); }} doc={viewerDoc} />
    </Dialog>
  );
}

function BulkAssignPanel({ count, lawyerOptions, assignLawyer, setAssignLawyer, assigning, handleAssign }: any) {
  var [search, setSearch] = useState('');
  var filtered = lawyerOptions.filter(function(l: any) {
    var term = search.trim().toLowerCase();
    if (!term) return true;
    var specs = specList(l).join(' ').toLowerCase();
    return String(l.name || '').toLowerCase().includes(term) || specs.includes(term);
  });

  if (count === 0) {
    return (
      <div className="text-center py-20 text-slate-400 text-sm">
        <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
        Soldakı siyahıdan bir neçə tapşırıq seçin
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
        <p className="text-sm font-semibold text-emerald-800">{count} tapşırıq seçildi</p>
        <p className="text-xs text-emerald-600 mt-0.5">Hamısı eyni vəkilə bir əməliyyatla təhkim ediləcək</p>
      </div>

      {lawyerOptions.length > 5 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3 w-3 text-slate-400" />
          <Input className="pl-7 h-7 text-[11px]" placeholder="Vəkil adı və ya ixtisas üzrə axtar..."
            value={search} onChange={function(e: any) { setSearch(e.target.value); }} />
        </div>
      )}

      <div className="space-y-1.5 max-h-[400px] overflow-auto">
        {filtered.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-2">"{search}" üzrə vəkil tapılmadı</p>
        ) : filtered.slice().sort(function(a: any, b: any) {
          return Number(a.active_cases || 0) - Number(b.active_cases || 0);
        }).map(function(l: any) {
          var load = Number(l.active_cases || 0);
          var loadCls = load === 0 ? 'bg-green-50 text-green-700 border-green-200' : load <= 3 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200';
          var isSel = assignLawyer === String(l.id);
          var specs = specList(l);
          return (
            <button key={l.id} type="button" onClick={function() { setAssignLawyer(String(l.id)); }}
              className={'w-full text-left flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border transition-colors ' +
                (isSel ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 hover:border-emerald-300')}>
              <div className="min-w-0 flex-1">
                <p className={'text-xs font-medium truncate ' + (isSel ? 'text-white' : 'text-slate-800')}>{l.name}</p>
                {specs.length > 0 && (
                  <p className={'text-[10px] truncate ' + (isSel ? 'text-emerald-100' : 'text-slate-400')}>{specs.join(', ')}</p>
                )}
              </div>
              <span className={'text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ' + (isSel ? 'bg-white/20 border-white/30 text-white' : loadCls)}>
                {load} iş
              </span>
            </button>
          );
        })}
      </div>

      <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={!assignLawyer || assigning} onClick={handleAssign}>
        {assigning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
        {count} tapşırığı təhkim et
      </Button>
    </div>
  );
}

function TaskAssignPanel({ task, lawyerOptions, assignLawyer, setAssignLawyer, assigning, handleAssign, setViewerDoc }: any) {
  // QEYD: vəkil siyahısı əvvəllər axtarışsız idi — çox vəkili olan hesablarda
  // düymə siyahısında lazımi vəkili tapmaq üçün sonsuz scroll etmək lazım
  // gəlirdi. Ad/ixtisas üzrə sadə axtarış əlavə edildi (aşağıdakı düymə
  // siyahısını VƏ Select-in seçimlərini eyni filtrlə süzür).
  var [lawyerSearch, setLawyerSearch] = useState('');
  var claimAmounts = parseJSON(task.claim_amounts || task.claimAmounts);
  var totalClaim = Number(task.total_claim || task.totalClaim || 0);
  var lawyerName = g(task.assignee, 'name') || task.assigned_lawyer || '';
  var clientName = clientDisplay(task.client, task.client_name);
  var respondent = task.respondent_name || task.respondentName || task.title || '—';
  var contractName = g(task.contract, 'title', 'name') || task.contract_title || task.contractTitle || '';
  var statusColor = getStatusColor(task.status || '');
  var statusLabel = getStatusLabel(task.status || '');
  var taskDocs = parseJSON(task.document_checklist || task.documentChecklist);
  var taskPriority = task.priority || 'normal';
  var taskCategory = task.category || task.taskTypeName || task.task_type_name || '';

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Header — bütün tapşırıqlar pəncərəsi ilə eyni zənginlikdə */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-800 text-base">{respondent}</h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
            {task.task_number && <span className="text-xs text-slate-400">#{task.task_number}</span>}
            {contractName && (
              <span className="text-xs text-indigo-600 flex items-center gap-1">
                <FolderOpen className="h-3.5 w-3.5" />{contractName}
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
        {task.created_at && (
          <div className="bg-slate-50 rounded-lg p-2.5">
            <p className="text-[10px] text-slate-400 font-medium mb-0.5">Yaradılıb</p>
            <p className="font-medium text-slate-700 text-[11px]">{fmtDT(task.created_at)}</p>
          </div>
        )}
      </div>

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

      {task.description && (
        <div className="bg-slate-50 rounded-lg p-2.5">
          <p className="text-[10px] text-slate-400 font-medium mb-1">Təsvir</p>
          <p className="text-xs text-slate-600 whitespace-pre-wrap">{task.description}</p>
        </div>
      )}

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

      {task.notes && (
        <div className="bg-slate-50 rounded-lg p-2.5">
          <p className="text-[10px] text-slate-400 font-medium mb-1">Qeydlər</p>
          <p className="text-xs text-slate-600 whitespace-pre-wrap">{task.notes}</p>
        </div>
      )}

      {/* Vəkil təhkimi — iş yükü + ixtisas görünsün */}
      <div className="border rounded-xl p-3 bg-indigo-50/60 space-y-2.5">
        <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5" />Vəkil təhkimi
        </p>
        {lawyerName ? (
          <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-indigo-100">
            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0">
              {lawyerName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-800 truncate">{lawyerName}</p>
              <p className="text-[10px] text-slate-400">Hal-hazırda təhkim olunub</p>
            </div>
            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">Hələ vəkil təhkim olunmayıb</p>
        )}

        {lawyerOptions.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-slate-500 font-medium">{lawyerName ? 'Yenidən təhkim et:' : 'Vəkil seç:'} — iş yükü və ixtisasa görə</p>
            {lawyerOptions.length > 5 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3 w-3 text-slate-400" />
                <Input className="pl-7 h-7 text-[11px]" placeholder="Vəkil adı və ya ixtisas üzrə axtar..."
                  value={lawyerSearch} onChange={function(e: any) { setLawyerSearch(e.target.value); }} />
              </div>
            )}
            <div className="space-y-1.5">
              {lawyerOptions.filter(function(l: any) {
                var term = lawyerSearch.trim().toLowerCase();
                if (!term) return true;
                var specs = specList(l).join(' ').toLowerCase();
                return String(l.name || '').toLowerCase().includes(term) || specs.includes(term);
              }).slice().sort(function(a: any, b: any) {
                return Number(a.active_cases || 0) - Number(b.active_cases || 0);
              }).map(function(l: any) {
                var load = Number(l.active_cases || 0);
                var loadCls = load === 0 ? 'bg-green-50 text-green-700 border-green-200' : load <= 3 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200';
                var isSel = assignLawyer === String(l.id);
                var specs = specList(l);
                return (
                  <button key={l.id} type="button" onClick={function() { setAssignLawyer(String(l.id)); }}
                    className={'w-full text-left flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border transition-colors ' +
                      (isSel ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 hover:border-indigo-300')}>
                    <div className="min-w-0 flex-1">
                      <p className={'text-xs font-medium truncate ' + (isSel ? 'text-white' : 'text-slate-800')}>{l.name}</p>
                      {specs.length > 0 && (
                        <p className={'text-[10px] truncate ' + (isSel ? 'text-indigo-100' : 'text-slate-400')}>{specs.join(', ')}</p>
                      )}
                    </div>
                    <span className={'text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ' + (isSel ? 'bg-white/20 border-white/30 text-white' : loadCls)}>
                      {load} iş
                    </span>
                  </button>
                );
              })}
              {lawyerSearch.trim() && lawyerOptions.filter(function(l: any) {
                var term = lawyerSearch.trim().toLowerCase();
                var specs = specList(l).join(' ').toLowerCase();
                return String(l.name || '').toLowerCase().includes(term) || specs.includes(term);
              }).length === 0 && (
                <p className="text-[11px] text-slate-400 text-center py-2">"{lawyerSearch}" üzrə vəkil tapılmadı</p>
              )}
            </div>
            <div className="flex gap-1.5 pt-1">
              <Select value={assignLawyer} onValueChange={setAssignLawyer}>
                <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Vəkil seçin..." /></SelectTrigger>
                <SelectContent>
                  {lawyerOptions.map(function(l: any) {
                    var specs = specList(l);
                    return <SelectItem key={l.id} value={String(l.id)} className="text-xs">{l.name}{specs.length ? ' — ' + specs.join(', ') : ''} · {Number(l.active_cases || 0)} iş</SelectItem>;
                  })}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 shrink-0"
                disabled={!assignLawyer || assigning} onClick={handleAssign}>
                {assigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Təhkim et'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LawyerAssignmentModal;
