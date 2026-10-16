import { useState, useMemo, useEffect } from 'react';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { TaskDetailView } from '../shared/TaskDetailView';
import { StatusChangeModal } from './StatusChangeModal';
import { TaskChatModal } from '../shared/TaskChatModal';
import { AllNotificationsModal } from '../shared/AllNotificationsModal';
import { ChatFab } from '../shared/ChatFab';
import { ContractsModal } from './ContractsModal';
import { ContractDetailModal } from './ContractDetailModal';
import { ClientDetailsModal } from './ClientDetailsModal';
import { ClientsModal } from './ClientsModal';

import { NotificationDropdown } from '../shared/NotificationDropdown';
import { ArchiveModal } from '../shared/ArchiveModal';
import { DocumentsModal } from '../shared/DocumentsModal';
import { ProfileSettings } from '../shared/ProfileSettings';
import { useLawyerData, useNotifications } from '../../hooks/useData';
import { getStatusLabel, getStatusColor, ALL_STATUSES, isCompletedStatus, isTerminalStatus } from '../../utils/taskStatusConstants';
import { fetchApi } from '../../utils/apiHelper';
import { FolderOpen, Users, FileText, AlertTriangle, CheckCircle, Calendar, LogOut, Briefcase, Activity, User, Archive, MessageSquare, Menu, ClipboardList, Files } from 'lucide-react';

function parseJSON(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return [];
}

function adaptTask(t) {
  var a = t;
  var respondentName = a.respondentName || a.respondent_name || '';
  var contractTitle = a.contractTitle || a.contract_title || a.contract?.title || '';
  var taskNumber = a.taskNumber || a.task_number || '';
  var clientName = a.clientName || a.client_name || a.client?.name || '';
  var title = a.title || a.Title || '';
  var createdAt = a.createdAt || a.created_at || '';
  var deadline = a.deadline || a.Deadline || '';
  var managerDeadline = a.manager_deadline || a.managerDeadline || '';
  var category = a.category || a.Category || a.taskTypeName || a.task_type_name || '';
  var status = a.status || a.Status || 'pending';
  var priority = a.priority || a.Priority || 'medium';
  var description = a.description || a.notes || '';
  var claimAmounts = parseJSON(a.claimAmounts || a.claim_amounts);
  var totalClaim = Number(a.totalClaim || a.total_claim || 0);
  var documentChecklist = parseJSON(a.documentChecklist || a.document_checklist);
  var displayTitle = respondentName
    ? respondentName + (contractTitle ? ' - ' + contractTitle : '') + (taskNumber ? ' #' + taskNumber : '')
    : title;
  var clientIdRaw = a.clientId !== undefined && a.clientId !== null ? a.clientId : a.client_id;
  return {
    ...a,
    id: Number(a.id) || a.id, title: displayTitle, originalTitle: title,
    respondentName, taskNumber, client: clientName || 'Müştəri', clientName, priority, status,
    deadline: managerDeadline || deadline, category: category || 'Digər', description,
    createdAt, contractId: Number(a.contractId || a.contract_id) || undefined,
    clientId: clientIdRaw !== undefined && clientIdRaw !== null ? Number(clientIdRaw) : undefined,
    contractTitle, contractName: contractTitle,
    claimAmounts, totalClaim: totalClaim || claimAmounts.reduce((s, c) => s + (Number(c.amount) || 0), 0),
    documentChecklist, currentStep: a.currentStep || a.current_step || 0,
    assignedLawyer: a.assignedLawyer || a.assigned_lawyer || a.assignee?.name || '',
    notes: a.notes || description, isArchived: a.isArchived || a.is_archived || false,
  };
}

// QEYD (2026-09, ana səhifə modernləşdirməsi): günün vaxtına görə salamlama —
// yalnız görünüş qatı, heç bir iş məntiqinə təsir etmir.
function getGreeting() {
  var h = new Date().getHours();
  if (h < 6) return 'Xeyirli gecələr';
  if (h < 12) return 'Sabahınız xeyir';
  if (h < 18) return 'Gününüz xeyirli keçsin';
  return 'Axşamınız xeyir';
}

function adaptContract(c) {
  var a = c;
  // Xam obyekti (bütün snake_case sahələr daxil) əvvəlcə spread edirik ki,
  // ContractDetailModal-ın öz f() normalizatoru (camelCase/snake_case hər
  // ikisinə baxan) bütün real sahələrə (contract_number, value, currency,
  // static_lawyer_fee, court_name, case_number, claim_amount, priority,
  // allowed_categories, auto_renew, notes və s.) çıxışı olsun — əvvəllər
  // yalnız 10 sahə saxlanılırdı və müqavilə detalları boş görünürdü.
  return {
    ...a,
    id: Number(a.id) || a.id, name: a.name || a.title || '', client: a.clientName || a.client_name || a.client?.name || '',
    clientId: Number(a.clientId || a.client_id) || 0, category: a.taskTypeName || a.task_type_name || a.category || '',
    taskQuota: a.taskQuota || a.task_quota || 100, usedQuota: a.tasksUsed || a.tasks_used || 0,
    startDate: a.startDate || a.start_date || '', endDate: a.endDate || a.end_date || '',
    status: a.status || 'active', description: a.description || '',
  };
}



export function LawyerDashboard({ tenantId, lawyerId, lawyerName = 'Vəkil' }) {
  var { tasks: rawTasks, contracts: rawContracts, clients: rawClients, loading, refresh } = useLawyerData(tenantId, lawyerId);
  var { notifications: rawNotifications, unreadCount } = useNotifications(tenantId, lawyerId || undefined);

  var safeTasks = rawTasks || [];
  var safeContracts = rawContracts || [];
  var safeClients = rawClients || [];

  var tasks = useMemo(() => safeTasks.map(adaptTask), [safeTasks]);
  var contracts = useMemo(() => safeContracts.map(adaptContract), [safeContracts]);


  // States
  var [selectedTask, setSelectedTask] = useState<any>(null);
  var [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  var [isStatusChangeOpen, setIsStatusChangeOpen] = useState(false);
  var [allNotifsOpen, setAllNotifsOpen] = useState(false);
  var [isContractsOpen, setIsContractsOpen] = useState(false);
  var [isContractDetailOpen, setIsContractDetailOpen] = useState(false);
  var [selectedContract, setSelectedContract] = useState<any>(null);
  var [isClientDetailsOpen, setIsClientDetailsOpen] = useState(false);
  var [selectedClient, setSelectedClient] = useState<any>(null);
  var [isClientsOpen, setIsClientsOpen] = useState(false);
  var [isAllTasksOpen, setIsAllTasksOpen] = useState(false);
  var [taskListFilter, setTaskListFilter] = useState<any[]>([]);
  var [taskListTitle, setTaskListTitle] = useState('');
  var [isChatOpen, setIsChatOpen] = useState(false);
  var [isArchiveOpen, setIsArchiveOpen] = useState(false);
  var [isDocumentsOpen, setIsDocumentsOpen] = useState(false);
  var [isProfileOpen, setIsProfileOpen] = useState(false);

  // Computed
  var now = new Date();
  var oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  var activeTasks = tasks.filter((t) => {
    return !isTerminalStatus(t.status || '') && !t.isArchived;
  });

  var deadlineThisWeek = activeTasks.filter((t) => {
    if (!t.deadline) return false;
    try { var d = new Date(t.deadline); return d >= now && d <= oneWeekFromNow; } catch { return false; }
  });

  var overdueList = activeTasks.filter((t) => {
    if (!t.deadline) return false;
    try { return new Date(t.deadline) < now; } catch { return false; }
  });

  var completedList = tasks.filter((t) => {
    return isCompletedStatus(t.status || '');
  });

  var openTaskList = (list, title) => {
    setTaskListFilter(list);
    setTaskListTitle(title);
    setIsAllTasksOpen(true);
  };

  var handleTaskClick = (task) => { setSelectedTask(task); setIsTaskDetailOpen(true); };
  var handleViewTaskById = (taskId) => {
    setAllNotifsOpen(false);
    var found = (tasks || []).find(function(t) { return String(t.id) === String(taskId); });
    if (found) { setSelectedTask(found); setIsTaskDetailOpen(true); }
  };
  var handleContractClick = (c) => { setSelectedContract(c); setIsContractDetailOpen(true); };
  var handleClientClick = (c) => { setSelectedClient(c); setIsClientDetailsOpen(true); };

  var handleLogout = () => { localStorage.removeItem('law_token'); localStorage.removeItem('law_user'); window.location.href = '/login'; };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/30">
      <div className="text-center"><div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" /><p className="text-muted-foreground">Yüklənir...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/30">
      {/* Header — QEYD (2026-09, ana səhifə modernləşdirməsi): əvvəllər parlaq sarı
          qradiyent idi; indi menecer interfeysi ilə eyni təmiz/neytral üslub,
          vəkil rolu isə avatarın kəhrəba (amber) rəngli halqası və "Vəkil"
          etiketinin rəngi ilə fərqləndirilir — sistemlər arası vizual ardıcıllıq üçün. */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 justify-between">
          {/* Sol tərəf: profil (yuxarı-sol) */}
          <button className="flex items-center gap-2 shrink-0 rounded-xl pl-1 pr-2 sm:pr-3 py-1 hover:bg-slate-100 transition-colors" onClick={() => setIsProfileOpen(true)} title="Profilim">
            <Avatar className="h-9 w-9 shadow-sm ring-2 ring-amber-400/60"><AvatarFallback className="bg-gradient-to-br from-amber-500 to-amber-700 text-white">{lawyerName.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback></Avatar>
            <div className="hidden sm:block text-left leading-tight">
              <p className="text-sm font-semibold text-slate-800 max-w-[160px] truncate">{lawyerName}</p>
              <p className="text-[11px] text-amber-600 font-medium">Vəkil</p>
            </div>
          </button>

          {/* Sağ tərəf: əməliyyatlar + menyu */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5 border-slate-200" onClick={() => setIsArchiveOpen(true)}>
              <Archive className="h-4 w-4" /><span className="hidden sm:inline">Arxiv</span>
            </Button>
            <Separator orientation="vertical" className="h-6 bg-slate-200 hidden sm:block" />
            <NotificationDropdown tenantId={tenantId} userId={lawyerId} userType="lawyer" onViewTask={handleViewTaskById} onViewAllNotifications={() => setAllNotifsOpen(true)} />
            <Separator orientation="vertical" className="h-6 bg-slate-200 hidden sm:block" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="border-slate-200" title="Menyu">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsProfileOpen(true)}><User className="mr-2 h-4 w-4" />Profilim</DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-red-600"><LogOut className="mr-2 h-4 w-4" />Çıxış</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-10 space-y-12">

        {/* ── Salamlama (2026-09, ana səhifə modernləşdirməsi) ──
            QEYD (2026-09, vizual-ardıcıllıq keçidi): əvvəllər burada 4 StatPill
            göstərilirdi, LAKİN aşağıdakı DashCard-larla EYNİ rəqəmləri təkrarlayırdı
            (istifadəçinin bildirdiyi təkrarlanma) — çıxarıldı. */}
        <section className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{getGreeting()}, {lawyerName}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Bugünkü ümumi vəziyyətə nəzər salın</p>
          </div>
        </section>

        {/* Section: İş paneli
            QEYD: bütün kart şəbəkələri (bu bölmə + aşağıdakı "Gündəlik idarəetmə")
            EYNİ sütun şablonunu (1/2/3/4) istifadə edir ki, kartlar bölmədən asılı
            olmayaraq HƏMİŞƏ eyni ölçüdə olsun (əvvəllər bu bölmə 4 sütun, aşağıdakı
            isə cəmi 2 sütun idi — nəticədə eyni tip kartlar fərqli enlərdə görünürdü). */}
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center"><Briefcase className="h-4 w-4 text-slate-600" /></div>
            <div><h2 className="text-lg font-semibold text-gray-900">İş paneli</h2><p className="text-sm text-gray-500">Əsas məlumat bazaları və tapşırıqlar</p></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Müqavilələrim */}
            <DashCard icon={FolderOpen} title="Müqavilələrim" subtitle={contracts.length + ' müqavilə'} onClick={() => setIsContractsOpen(true)} />
            {/* Müştərilərim */}
            <DashCard icon={Users} title="Müştərilərim" subtitle={safeClients.length + ' müştəri'} onClick={() => setIsClientsOpen(true)} />
            {/* Bütün tapşırıqlar */}
            <DashCard icon={FileText} title="Bütün tapşırıqlar" subtitle={activeTasks.length + ' aktiv tapşırıq'} onClick={() => openTaskList(tasks, 'Bütün tapşırıqlar')} />
            {/* Bu həftə deadline */}
            <DashCard icon={Calendar} title="Bu həftə deadline" subtitle={deadlineThisWeek.length + ' tapşırıq'} color={deadlineThisWeek.length > 0 ? 'amber' : undefined} onClick={() => openTaskList(deadlineThisWeek, 'Bu həftə deadline')} />
            {/* Sənədlər (2026-09, istifadəçi tapşırığı: mərkəzi fayl idarəetməsi) */}
            <DashCard icon={Files} title="Sənədlər" subtitle="Bütün sənədlər bir yerdə" onClick={() => setIsDocumentsOpen(true)} />
          </div>
        </section>

        {/* Section: Əməliyyatlar */}
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center"><Activity className="h-4 w-4 text-slate-600" /></div>
            <div><h2 className="text-lg font-semibold text-gray-900">Gündəlik idarəetmə</h2><p className="text-sm text-gray-500">Deadline izləmə, tamamlanmış və gözləyən işlər</p></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Deadline keçmiş */}
            <DashCard icon={AlertTriangle} title="Deadline keçmiş işlər" subtitle={overdueList.length + ' tapşırıq'} color={overdueList.length > 0 ? 'red' : undefined} badge={overdueList.length > 0 ? String(overdueList.length) : undefined} onClick={() => openTaskList(overdueList, 'Deadline keçmiş işlər')} />
            {/* Tamamlanmış */}
            <DashCard icon={CheckCircle} title="Tamamlanmış işlər" subtitle={completedList.length + ' tapşırıq'} color="green" onClick={() => openTaskList(completedList, 'Tamamlanmış işlər')} />
          </div>
        </section>
      </main>

      {/* Modals */}
      <TaskDetailView open={isTaskDetailOpen} onOpenChange={setIsTaskDetailOpen} task={selectedTask} userRole="lawyer" onChat={function(t) { setIsTaskDetailOpen(false); setSelectedTask(t); setIsChatOpen(true); }} onStatusChange={function(t) { setIsTaskDetailOpen(false); setSelectedTask(t); setIsStatusChangeOpen(true); }} onRefresh={refresh} />
      <StatusChangeModal task={selectedTask} isOpen={isStatusChangeOpen} onClose={() => setIsStatusChangeOpen(false)} onStatusChanged={() => { setIsStatusChangeOpen(false); refresh(); }} tenantId={tenantId} lawyerId={lawyerId} />
      <ContractsModal open={isContractsOpen} onOpenChange={setIsContractsOpen} contracts={contracts} tasks={tasks} onContractClick={handleContractClick} />
      <ContractDetailModal open={isContractDetailOpen} onOpenChange={setIsContractDetailOpen} contract={selectedContract} tasks={tasks} onTaskClick={handleTaskClick} hideQuota />
      <ClientsModal open={isClientsOpen} onOpenChange={setIsClientsOpen} clients={safeClients} tasks={tasks} onClientClick={handleClientClick} />
      <ClientDetailsModal client={selectedClient} isOpen={isClientDetailsOpen} onClose={() => setIsClientDetailsOpen(false)} onTaskClick={handleTaskClick} tasks={tasks} />
      <TaskChatModal open={isChatOpen} onOpenChange={setIsChatOpen} taskId={selectedTask?.id} taskTitle={selectedTask?.title} userRole="lawyer" userId={lawyerId || 0} userName={lawyerName} />
      <AllNotificationsModal open={allNotifsOpen} onOpenChange={setAllNotifsOpen} userId={lawyerId || 0} userType="lawyer" onViewTask={handleViewTaskById} />
      <ChatFab userRole="lawyer" userId={lawyerId || 0} userName={lawyerName} tasks={tasks} />
      {/* Task list modal */}
      <Dialog open={isAllTasksOpen} onOpenChange={setIsAllTasksOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader><DialogTitle>{taskListTitle} ({taskListFilter.length})</DialogTitle><DialogDescription className="sr-only">Tapshiriqlar</DialogDescription></DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2 pr-2">
              {taskListFilter.map((t) => (
                <Card key={t.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setIsAllTasksOpen(false); handleTaskClick(t); }}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getStatusColor(t.status || '') + ' text-[10px]'}>{getStatusLabel(t.status || '')}</Badge>
                        {t.clientName && <span className="text-[10px] text-muted-foreground">{t.clientName}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-2">
                      {t.totalClaim > 0 && <span className="text-xs font-semibold text-amber-700">₼{t.totalClaim.toLocaleString()}</span>}
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setIsAllTasksOpen(false); setSelectedTask(t); setIsChatOpen(true); }}><MessageSquare className="h-3 w-3 mr-1" />Chat</Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setIsAllTasksOpen(false); setSelectedTask(t); setIsStatusChangeOpen(true); }}>Status dəyiş</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {taskListFilter.length === 0 && (
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
      <ArchiveModal open={isArchiveOpen} onOpenChange={setIsArchiveOpen} userRole="lawyer" onRefresh={refresh} />
      <DocumentsModal open={isDocumentsOpen} onOpenChange={setIsDocumentsOpen} />
      <ProfileSettings open={isProfileOpen} onOpenChange={setIsProfileOpen} />
    </div>
  );
}

// QEYD (2026-09, vizual-ardıcıllıq keçidi): StatPill komponenti silindi —
// göstərdiyi rəqəmlər aşağıdakı DashCard-larda artıq var idi, təkrar idi.

function DashCard({ icon: Icon, title, subtitle, color, badge, onClick }) {
  var bgColor = color === 'red' ? 'bg-red-50 border-red-200 hover:bg-red-100/70 hover:border-red-300' : color === 'amber' ? 'bg-amber-50 border-amber-200 hover:bg-amber-100/70 hover:border-amber-300' : color === 'green' ? 'bg-green-50 border-green-200 hover:bg-green-100/70 hover:border-green-300' : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300';
  var iconBg = color === 'red' ? 'bg-red-100 group-hover:bg-red-200' : color === 'amber' ? 'bg-amber-100 group-hover:bg-amber-200' : color === 'green' ? 'bg-green-100 group-hover:bg-green-200' : 'bg-slate-100 group-hover:bg-slate-200';
  var iconColor = color === 'red' ? 'text-red-600' : color === 'amber' ? 'text-amber-600' : color === 'green' ? 'text-green-600' : 'text-slate-600';
  var titleColor = color === 'red' ? 'group-hover:text-red-800' : color === 'amber' ? 'group-hover:text-amber-800' : color === 'green' ? 'group-hover:text-green-800' : 'group-hover:text-slate-950';
  return (
    <div className={'group relative border rounded-2xl p-5 cursor-pointer transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1 active:translate-y-0 active:shadow-md ' + bgColor} onClick={onClick}>
      {badge && (
        <span className="absolute top-3 right-3 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
          {badge}
        </span>
      )}
      <div className={'h-11 w-11 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3 ' + iconBg}><Icon className={'h-5 w-5 ' + iconColor} /></div>
      <p className={'font-medium text-gray-900 text-sm transition-colors duration-300 ' + titleColor}>{title}</p>
      <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
    </div>
  );
}