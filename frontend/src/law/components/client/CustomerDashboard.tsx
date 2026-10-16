'use client';
import { useState, useMemo, useEffect } from 'react';
import { useClientData, useNotifications } from '../../hooks/useData';
import { DashboardHeader } from './DashboardHeader';
import { ClientTaskCreationModal } from './ClientTaskCreationModal';
import { TaskDetailView } from '../shared/TaskDetailView';
import { ClientContractDetailModal as ContractDetailModal } from './ClientContractDetailModal';
import { fetchApi } from '../../utils/apiHelper';
import { ArchiveModal } from '../shared/ArchiveModal';
import { DocumentsModal } from '../shared/DocumentsModal';
import { TaskChatModal } from '../shared/TaskChatModal';
import { AllNotificationsModal } from '../shared/AllNotificationsModal';
import { ChatFab } from '../shared/ChatFab';
import { LinkedAccountsModal } from './LinkedAccountsModal';
import { getStatusLabel, getStatusColor, getStatusGroup, ALL_STATUSES, STATUS_GROUPS, isCompletedStatus, isTerminalStatus } from '../../utils/taskStatusConstants';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { FileText, Users, FolderOpen, Activity, Plus, Briefcase, CheckCircle, ChevronRight, ChevronDown, User, Mail, Phone, MessageSquare, ClipboardList, Files } from 'lucide-react';

function parseJSON(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return [];
}

function fmtDate(d: any): string {
  if (!d) return '-';
  try { var dt = new Date(d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('az-AZ'); } catch { return String(d); }
}

// QEYD (2026-09, ana səhifə modernləşdirməsi): günün vaxtına görə salamlama —
// yalnız görünüş qatı, heç bir iş məntiqinə təsir etmir.
function getGreeting(): string {
  var h = new Date().getHours();
  if (h < 6) return 'Xeyirli gecələr';
  if (h < 12) return 'Sabahınız xeyir';
  if (h < 18) return 'Gününüz xeyirli keçsin';
  return 'Axşamınız xeyir';
}

function adaptTask(t: any): any {
  var a = t as any;
  var respondentName = a.respondentName || a.respondent_name || '';
  var contractTitle = a.contractTitle || a.contract_title || a.contract?.title || '';
  var taskNumber = a.taskNumber || a.task_number || '';
  var clientName = a.clientName || a.client_name || a.client?.name || '';
  var status = a.status || a.Status || 'new';
  var deadline = a.deadline || a.Deadline || '';
  var claimAmounts = parseJSON(a.claimAmounts || a.claim_amounts);
  var totalClaim = Number(a.totalClaim || a.total_claim || 0);
  var documentChecklist = parseJSON(a.documentChecklist || a.document_checklist);
  var displayTitle = respondentName
    ? respondentName + (contractTitle ? ' - ' + contractTitle : '') + (taskNumber ? ' #' + taskNumber : '')
    : a.title || '';
  return {
    id: a.id, title: displayTitle, rawStatus: status, status, priority: a.priority || 'normal',
    deadline, category: a.category || a.taskTypeName || a.task_type_name || '',
    assignedLawyer: a.assignedLawyer || a.assigned_lawyer || a.assignee?.name || 'Təyin edilməyib',
    createdAt: a.createdAt || a.created_at || '', description: a.description || a.notes || '',
    respondentName, taskNumber, contractName: contractTitle, clientName,
    claimAmounts, totalClaim: totalClaim || claimAmounts.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0),
    documentChecklist, contractId: a.contractId || a.contract_id,
    notes: a.notes || a.description || '', isArchived: a.isArchived || a.is_archived || false,
  };
}

function adaptContract(c: any): any {
  var a = c as any;
  var taskQuota = a.taskQuota || a.task_quota || 100;
  var tasksUsed = a.tasksUsed || a.tasks_used || 0;
  return {
    id: String(a.id), name: a.name || a.title || ('Müqavilə #' + (a.contract_number || a.id)),
    status: a.status || 'active', taskQuota, tasksUsed, remaining: Math.max(0, taskQuota - tasksUsed),
    startDate: a.startDate || a.start_date || '', endDate: a.endDate || a.end_date || '',
    category: a.taskTypeName || a.task_type_name || a.category || '',
    // QEYD: "value" (müqavilənin müştəriyə olan dəyəri) əvvəllər boş/0 olduqda
    // static_lawyer_fee-yə (vəkilə ödənilən daxili haqq — tamam ayrı, müştəriyə
    // aid olmayan məlumat) düşürdü. Bu fallback çıxarıldı.
    value: Number(a.value || 0),
    clientName: a.clientName || a.client_name || '', _raw: a,
  };
}

interface Props { tenantId: number | null; clientId: number | null; clientName?: string; }

export function CustomerDashboard({ tenantId, clientId, clientName = 'Müştəri' }: Props) {
  var { contracts: rawContracts, tasks: rawTasks, lawyers: rawLawyers, loading, refresh } = useClientData(tenantId, clientId);
  var tasks = useMemo(() => rawTasks.map(adaptTask), [rawTasks]);
  var contracts = useMemo(() => rawContracts.map(adaptContract), [rawContracts]);


  var [statusChanges, setStatusChanges] = useState<any[]>([]);
  var [selectedTask, setSelectedTask] = useState<any>(null);
  var [taskDetailOpen, setTaskDetailOpen] = useState(false);
  var [taskCreationOpen, setTaskCreationOpen] = useState(false);
  var [contractDetailOpen, setContractDetailOpen] = useState(false);
  var [selectedContract, setSelectedContract] = useState<any>(null);
  var [taskListOpen, setTaskListOpen] = useState(false);
  var [taskListTitle, setTaskListTitle] = useState('');
  var [taskListData, setTaskListData] = useState<any[]>([]);
  var [contractListOpen, setContractListOpen] = useState(false);
  var [lawyerListOpen, setLawyerListOpen] = useState(false);
  var [statusTrackingOpen, setStatusTrackingOpen] = useState(false);
  var [archiveOpen, setArchiveOpen] = useState(false);
  var [documentsOpen, setDocumentsOpen] = useState(false);
  var [chatOpen, setChatOpen] = useState(false);
  var [allNotifsOpen, setAllNotifsOpen] = useState(false);
  var [chatTask, setChatTask] = useState<any>(null);
  var [ownClientType, setOwnClientType] = useState<string>('');
  var [linkedAccountsOpen, setLinkedAccountsOpen] = useState(false);

  // Hüquqi şəxs olub-olmadığını bilmək üçün öz müştəri qeydini çəkirik —
  // yalnız Hüquqi şəxs "Bağlı hesablar" kartını görür.
  useEffect(() => {
    if (!clientId) return;
    fetchApi('/clients/' + clientId).then((data: any) => {
      setOwnClientType((data && data.type) || '');
    }).catch(() => {});
  }, [clientId]);
  var isLegalEntity = ownClientType === 'legal' || ownClientType === 'company';

  // Fetch status changes
  useEffect(() => {
    if (!tenantId) return;
    fetchApi('/approvals').then((data: any[]) => {
      setStatusChanges((data || []).filter((a: any) => (a.approval_type || a.type) === 'status_change'));
    }).catch(() => setStatusChanges([]));
  }, [tenantId, loading]);

  // Computed
  var handleViewTaskById = function(taskId: any) {
    setAllNotifsOpen(false);
    var found = tasks.find(function(t: any) { return String(t.id) === String(taskId); });
    if (found) { setSelectedTask(found); setTaskDetailOpen(true); }
  };

  var activeTasks = tasks.filter((t: any) => !isTerminalStatus(t.status) && !t.isArchived);
  var completedTasks = tasks.filter((t: any) => isCompletedStatus(t.status));
  var uniqueLawyers = useMemo(() => {
    // Build lawyer map from tasks assigned to this client
    var lawyerMap: Record<string, { name: string; taskCount: number; activeTasks: number; completedTasks: number; totalClaim: number; securedClaim: number; data: any }> = {};
    tasks.forEach((t: any) => {
      var name = t.assignedLawyer;
      if (!name || name === 'Təyin edilməyib') return;
      if (!lawyerMap[name]) lawyerMap[name] = { name, taskCount: 0, activeTasks: 0, completedTasks: 0, totalClaim: 0, securedClaim: 0, data: null };
      lawyerMap[name].taskCount++;
      var s = t.status || '';
      if (isCompletedStatus(s)) {
        lawyerMap[name].completedTasks++;
        lawyerMap[name].securedClaim += Number(t.totalClaim || 0);
      } else {
        lawyerMap[name].activeTasks++;
      }
      lawyerMap[name].totalClaim += Number(t.totalClaim || 0);
    });
    // Merge with rawLawyers data
    rawLawyers.forEach((l: any) => {
      var n = l.name || l.Name || '';
      if (n && lawyerMap[n]) lawyerMap[n].data = l;
    });
    return Object.values(lawyerMap);
  }, [tasks, rawLawyers]);
  var [selectedLawyerDetail, setSelectedLawyerDetail] = useState<any>(null);

  // Status groups for tracking
  var statusGroups = useMemo(() => {
    var groups: Record<string, any[]> = {};
    ALL_STATUSES.forEach(s => { groups[s.key] = []; });
    tasks.forEach((t: any) => { if (groups[t.status]) groups[t.status].push(t); });
    return groups;
  }, [tasks]);

  var openTaskList = (list: any[], title: string) => { setTaskListData(list); setTaskListTitle(title); setTaskListOpen(true); };
  var handleViewTask = (task: any) => { setSelectedTask(task); setTaskDetailOpen(true); };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/30">
      <div className="text-center"><div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" /><p className="text-muted-foreground">Yüklənir...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/30">
      <DashboardHeader tenantId={tenantId} onOpenArchive={() => setArchiveOpen(true)} onViewTask={handleViewTaskById} onViewAllNotifications={() => setAllNotifsOpen(true)} />

      <main className="container mx-auto px-6 py-10 space-y-12">

        {/* ── Salamlama (2026-09, ana səhifə modernləşdirməsi) ──
            QEYD (2026-09, vizual-ardıcıllıq keçidi): əvvəllər burada 4 StatPill
            göstərilirdi, LAKİN aşağıdakı DashCard-larla EYNİ rəqəmləri təkrarlayırdı
            (istifadəçinin bildirdiyi təkrarlanma) — çıxarıldı. */}
        <section className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{getGreeting()}, {clientName}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Bugünkü ümumi vəziyyətə nəzər salın</p>
          </div>
        </section>

        {/* Section: Əsas panel */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center"><Briefcase className="h-4 w-4 text-slate-600" /></div>
              <div><h2 className="text-lg font-semibold text-gray-900">İş paneli</h2><p className="text-sm text-gray-500">Tapşırıqlarınız, müqavilələriniz və statuslar</p></div>
            </div>
            <Button onClick={() => setTaskCreationOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />Yeni tapşırıq
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <DashCard icon={FileText} title="Bütün tapşırıqlar" subtitle={activeTasks.length + ' aktiv / ' + completedTasks.length + ' tamamlanmış'} onClick={() => openTaskList(tasks, 'Bütün tapşırıqlar')} />
            <DashCard icon={FolderOpen} title="Müqavilələrim" subtitle={contracts.length + ' müqavilə'} onClick={() => setContractListOpen(true)} />
            <DashCard icon={Users} title="Vəkillərim" subtitle={uniqueLawyers.length + ' vəkil'} onClick={() => setLawyerListOpen(true)} />
            <DashCard icon={Activity} title="Statuslar üzrə izləmə" subtitle={activeTasks.length + ' aktiv iş'} color="blue" onClick={() => setStatusTrackingOpen(true)} />
            {/* Sənədlər (2026-09, istifadəçi tapşırığı: mərkəzi fayl idarəetməsi) */}
            <DashCard icon={Files} title="Sənədlər" subtitle="Bütün sənədlər bir yerdə" onClick={() => setDocumentsOpen(true)} />
            {isLegalEntity && (
              <DashCard icon={Users} title="Bağlı hesablar" subtitle="Fərdi hesablar və rollar" color="amber" onClick={() => setLinkedAccountsOpen(true)} />
            )}
          </div>
        </section>

      </main>

      {/* === MODALS === */}
      <TaskDetailView open={taskDetailOpen} onOpenChange={setTaskDetailOpen} task={selectedTask} userRole="client" onChat={function(t) { setTaskDetailOpen(false); setChatTask(t); setChatOpen(true); }} onRefresh={refresh} />
      <ClientTaskCreationModal open={taskCreationOpen} onOpenChange={setTaskCreationOpen} tenantId={tenantId} clientId={clientId} contracts={rawContracts} onTaskCreated={refresh} />

      {/* Task List Modal */}
      <Dialog open={taskListOpen} onOpenChange={setTaskListOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader><DialogTitle>{taskListTitle} ({taskListData.length})</DialogTitle><DialogDescription className="sr-only">Tapşırıqlar</DialogDescription></DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2 pr-2">
              {taskListData.map((t: any) => (
                <TaskRow key={t.id} task={t} onClick={() => { setTaskListOpen(false); handleViewTask(t); }} onChat={() => { setTaskListOpen(false); setChatTask(t); setChatOpen(true); }} />
              ))}
              {taskListData.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <ClipboardList className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">Tapşırıq yoxdur</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Contract List Modal */}
      <Dialog open={contractListOpen} onOpenChange={setContractListOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader><DialogTitle>Müqavilələrim ({contracts.length})</DialogTitle><DialogDescription className="sr-only">Müqavilələr</DialogDescription></DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2 pr-2">
              {contracts.map((c: any) => (
                <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setContractListOpen(false); setSelectedContract(c._raw || c); setContractDetailOpen(true); }}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {c.category && <Badge variant="outline" className="text-[10px]">{c.category}</Badge>}
                        <span className="text-xs text-muted-foreground">{fmtDate(c.startDate)} — {fmtDate(c.endDate)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={c.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>{c.status === 'active' ? 'Aktiv' : c.status}</Badge>
                      <div className="text-right text-xs text-muted-foreground"><p>{c.tasksUsed}/{c.taskQuota}</p></div>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
              {contracts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <FolderOpen className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">Müqavilə yoxdur</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Lawyer List Modal */}
      <Dialog open={lawyerListOpen} onOpenChange={setLawyerListOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader><DialogTitle>Vəkillərim ({uniqueLawyers.length})</DialogTitle><DialogDescription>Sizə təhkim olunmuş vəkillər və onların statistikası</DialogDescription></DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-3 pr-2">
              {uniqueLawyers.map((lawyer: any, i: number) => {
                var completionRate = lawyer.taskCount > 0 ? Math.round((lawyer.completedTasks / lawyer.taskCount) * 100) : 0;
                var claimSecuredRate = lawyer.totalClaim > 0 ? Math.round((lawyer.securedClaim / lawyer.totalClaim) * 100) : 0;
                var isExpanded = selectedLawyerDetail === lawyer.name;
                var ld = lawyer.data || {};
                var spec = ld.specialization || ld.Specialization || '';
                var exp = ld.experience || ld.Experience || 0;
                var rating = ld.rating || ld.Rating || 0;
                var lEmail = ld.email || ld.Email || '';
                var lPhone = ld.phone || ld.Phone || '';

                return (
                  <Card key={i} className={isExpanded ? 'ring-2 ring-blue-200' : ''}>
                    <CardContent className="p-0">
                      <div className="p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setSelectedLawyerDetail(isExpanded ? null : lawyer.name)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{lawyer.name}</p>
                              {spec && <p className="text-xs text-muted-foreground">{spec}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-medium">{lawyer.taskCount} iş</p>
                              <p className="text-[10px] text-muted-foreground">{lawyer.activeTasks} aktiv</p>
                            </div>
                            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t p-4 space-y-4 bg-slate-50/50">
                          {/* Contact info */}
                          <div className="grid grid-cols-2 gap-3">
                            {lEmail && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{lEmail}</span>
                              </div>
                            )}
                            {lPhone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{lPhone}</span>
                              </div>
                            )}
                            {exp > 0 && (
                              <div className="flex items-center gap-2 text-sm">
                                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{exp} il təcrübə</span>
                              </div>
                            )}
                            {rating > 0 && (
                              <div className="flex items-center gap-2 text-sm">
                                <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>Reytinq: {rating}/5</span>
                              </div>
                            )}
                          </div>

                          {/* Stats grid */}
                          <div className="grid grid-cols-4 gap-2">
                            <div className="text-center p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                              <p className="text-lg font-bold text-blue-700">{lawyer.taskCount}</p>
                              <p className="text-[10px] text-muted-foreground">Ümumi iş</p>
                            </div>
                            <div className="text-center p-2.5 bg-green-50 rounded-lg border border-green-100">
                              <p className="text-lg font-bold text-green-700">{completionRate}%</p>
                              <p className="text-[10px] text-muted-foreground">Tamamlanma</p>
                            </div>
                            <div className="text-center p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                              <p className="text-lg font-bold text-amber-700">{lawyer.totalClaim > 0 ? '₼' + lawyer.totalClaim.toLocaleString() : '-'}</p>
                              <p className="text-[10px] text-muted-foreground">İddia məbləği</p>
                            </div>
                            <div className="text-center p-2.5 bg-purple-50 rounded-lg border border-purple-100">
                              <p className="text-lg font-bold text-purple-700">{claimSecuredRate}%</p>
                              <p className="text-[10px] text-muted-foreground">Təmin faizi</p>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div>
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Tamamlanma nisbəti</span>
                              <span>{lawyer.completedTasks}/{lawyer.taskCount}</span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: completionRate + '%' }} />
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {uniqueLawyers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <User className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">Sizə təhkim olunmuş vəkil yoxdur</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Status Tracking Modal */}
      <Dialog open={statusTrackingOpen} onOpenChange={setStatusTrackingOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Statuslar üzrə izləmə</DialogTitle><DialogDescription>Tapşırıqlarınızın hansı statusda olduğunu izləyin</DialogDescription></DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-6 pr-2">
              {Object.entries(STATUS_GROUPS).map(([groupKey, group]) => {
                var groupStatuses = ALL_STATUSES.filter(s => s.group === groupKey);
                var groupTasks = groupStatuses.flatMap(s => statusGroups[s.key] || []);
                return (
                  <div key={groupKey}>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className={group.color + ' text-xs'}>{group.label}</Badge>
                      <span className="text-sm font-medium">{groupTasks.length} tapşırıq</span>
                    </div>
                    <div className="space-y-2 ml-2">
                      {groupStatuses.map(status => {
                        var sTasks = statusGroups[status.key] || [];
                        if (sTasks.length === 0) return null;
                        return (
                          <div key={status.key} className="p-3 bg-white border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusColor(status.key) + ' text-[10px]'}>{status.label}</Badge>
                                <span className="text-sm font-semibold">{sTasks.length}</span>
                              </div>
                              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setStatusTrackingOpen(false); openTaskList(sTasks, status.label); }}>Hamısını gör</Button>
                            </div>
                            {sTasks.slice(0, 3).map((t: any) => (
                              <div key={t.id} className="flex items-center justify-between py-1.5 border-t text-sm cursor-pointer hover:bg-muted/30" onClick={() => { setStatusTrackingOpen(false); handleViewTask(t); }}>
                                <span className="truncate flex-1">{t.title}</span>
                                {t.deadline && <span className="text-xs text-muted-foreground ml-2">{fmtDate(t.deadline)}</span>}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                      {groupTasks.length === 0 && <p className="text-sm text-muted-foreground py-2 ml-2">Bu qrupda tapşırıq yoxdur</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* QEYD: "onTaskClick" əvvəllər ötürülmürdü — müqavilə detalında tapşırığın
          üstünə klikləmək heç nə etmirdi (müqavilədən tapşırığa keçid işləmirdi).
          Vəkil interfeysində eyni modal buna sahib idi, müştəri tərəfində unudulmuşdu. */}
      <ContractDetailModal open={contractDetailOpen} onOpenChange={setContractDetailOpen} contract={selectedContract} tasks={rawTasks} onTaskClick={function(t: any) { setContractDetailOpen(false); handleViewTask(t); }} />
      <ArchiveModal open={archiveOpen} onOpenChange={setArchiveOpen} userRole="client" onRefresh={refresh} />
      <DocumentsModal open={documentsOpen} onOpenChange={setDocumentsOpen} />
      <TaskChatModal open={chatOpen} onOpenChange={setChatOpen} taskId={chatTask?.id} taskTitle={chatTask?.title} userRole="client" userId={clientId || 0} userName={clientName || 'Müştəri'} />
      <AllNotificationsModal open={allNotifsOpen} onOpenChange={setAllNotifsOpen} userId={clientId || 0} userType="client" onViewTask={handleViewTaskById} />
      <ChatFab userRole="client" userId={clientId || 0} userName={clientName || 'Müştəri'} tasks={rawTasks} />
      {isLegalEntity && <LinkedAccountsModal open={linkedAccountsOpen} onOpenChange={setLinkedAccountsOpen} />}
    </div>
  );
}

// QEYD (2026-09, vizual-ardıcıllıq keçidi): StatPill komponenti silindi — göstərdiyi
// rəqəmlər aşağıdakı DashCard-larda artıq var idi, təkrar idi.
function DashCard({ icon: Icon, title, subtitle, color, onClick }: { icon: any; title: string; subtitle: string; color?: string; onClick?: () => void }) {
  var bgColor = color === 'blue' ? 'bg-blue-50 border-blue-200 hover:bg-blue-100/70 hover:border-blue-300' : color === 'amber' ? 'bg-amber-50 border-amber-200 hover:bg-amber-100/70 hover:border-amber-300' : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300';
  var iconBg = color === 'blue' ? 'bg-blue-100 group-hover:bg-blue-200' : color === 'amber' ? 'bg-amber-100 group-hover:bg-amber-200' : 'bg-slate-100 group-hover:bg-slate-200';
  var iconColor = color === 'blue' ? 'text-blue-600' : color === 'amber' ? 'text-amber-600' : 'text-slate-600';
  var titleColor = color === 'blue' ? 'group-hover:text-blue-800' : color === 'amber' ? 'group-hover:text-amber-800' : 'group-hover:text-slate-950';
  return (
    <div className={'group border rounded-2xl p-5 cursor-pointer transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1 active:translate-y-0 active:shadow-md ' + bgColor} onClick={onClick}>
      <div className={'h-11 w-11 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3 ' + iconBg}><Icon className={'h-5 w-5 ' + iconColor} /></div>
      <p className={'font-medium text-gray-900 text-sm transition-colors duration-300 ' + titleColor}>{title}</p>
      <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
    </div>
  );
}

function TaskRow({ task, onClick, onChat }: { task: any; onClick: () => void; onChat?: () => void }) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={getStatusColor(task.status || task.rawStatus || '') + ' text-[10px]'}>{getStatusLabel(task.status || task.rawStatus || '')}</Badge>
            {task.assignedLawyer && task.assignedLawyer !== 'Təyin edilməyib' && <span className="text-[10px] text-muted-foreground">{task.assignedLawyer}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-2">
          {task.totalClaim > 0 && <span className="text-xs font-semibold text-amber-700">₼{task.totalClaim.toLocaleString()}</span>}
          {task.deadline && <span className="text-xs text-muted-foreground">{fmtDate(task.deadline)}</span>}
          {onChat && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={function(e: any) { e.stopPropagation(); onChat(); }}>
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}