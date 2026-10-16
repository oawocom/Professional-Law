'use client';
import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { useManagerData, useDataMutations } from '../../hooks/useData';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { NotificationDropdown } from '../shared/NotificationDropdown';
import { ProfileSettings } from '../shared/ProfileSettings';
import { TaskListModal } from './TaskListModal';
import { ReportsModal } from './ReportsModal';
import { ControlPanelModal } from './ControlPanelModal';
import { LawyerAssignmentModal } from './LawyerAssignmentModal';
import { ClientDetailModal } from './ClientDetailModal';
import { ManagerTaskCreationModal } from './ManagerTaskCreationModal';
import { LibraryModal } from './LibraryModal';
import { RoleManagementModal } from './RoleManagementModal';
import { AutomationRulesModal } from './AutomationRulesModal';
import { PasswordChangeModal } from '../shared/PasswordChangeModal';
import { TaskDetailView } from '../shared/TaskDetailView';
import { LawyerManagementModal } from './LawyerManagementModal';
import { LawyerDetailModal } from './LawyerDetailModal';
import { NewClientModal } from './NewClientModal';
import { ClientStatsModal } from './ClientStatsModal';
import { LawyerListModal } from './LawyerListModal';
import { NewLawyerModal } from './NewLawyerModal';
import { GroupChatModal } from './GroupChatModal';
import { ClientDatabaseModal } from './ClientDatabaseModal';
import { TaskCreationModal } from './TaskCreationModal';
import { SystemSettingsModal } from './SystemSettingsModal';
import { ContractManagementModal } from './ContractManagementModal';
import { ContractDatabaseModal } from './ContractDatabaseModal';
import { ContractTasksModal } from './ContractTasksModal';
import { SuccessModal } from '../shared/SuccessModal';
import { ArchiveModal } from '../shared/ArchiveModal';
import { DocumentsModal } from '../shared/DocumentsModal';
import { TaskChatModal } from '../shared/TaskChatModal';
import { DeadlineCalendarModal } from './DeadlineCalendarModal';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Users, Settings, AlertTriangle,
  UserCheck, Shield, Calendar, FolderOpen,
  Archive, User, Briefcase, Loader2, Database,
  ClipboardList, Bell, LogOut, Plus, Book, Lock, BarChart3, Menu, FileText, Zap
} from 'lucide-react';
import { fetchApi } from '../../utils/apiHelper';


function getLawUserName(): string {
  if (typeof window === 'undefined') return 'Menecer';
  try {
    const u = JSON.parse(localStorage.getItem('law_user') || 'null');
    return u && u.name ? u.name : 'Menecer';
  } catch {
    return 'Menecer';
  }
}

function getLawUserInitials(): string {
  const name = getLawUserName();
  return name.split(' ').map(function (n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
}

// QEYD (2026-09, ana səhifə modernləşdirməsi): günün vaxtına görə salamlama —
// yalnız görünüş qatı, heç bir iş məntiqinə təsir etmir.
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Xeyirli gecələr';
  if (h < 12) return 'Sabahınız xeyir';
  if (h < 18) return 'Gününüz xeyirli keçsin';
  return 'Axşamınız xeyir';
}

interface Props {
  tenantId: number | null;
}

export function ManagerDashboard({ tenantId }: Props) {
  const {
    lawyers, clients, contracts, tasks, approvals,
    taskTypes, managerTasks, stats,
    loading, error, refresh
  } = useManagerData(tenantId);
  const mutations = useDataMutations(tenantId);


  // Modals
  const [taskListOpen, setTaskListOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  const [lawyerAssignmentOpen, setLawyerAssignmentOpen] = useState(false);
  const [clientDetailOpen, setClientDetailOpen] = useState(false);
  // BUG DÜZƏLİŞİ (2026-09): `ClientDetailModal`-a bu paneldə `onEditClient` heç vaxt
  // ötürülmürdü — nəticədə "Redaktə et" düyməsi bu axından açılanda görünmürdü
  // (ClientDatabaseModal.tsx-dəki eyni modaldan fərqli olaraq). ClientDatabaseModal.tsx-dəki
  // eyni nümunə ilə düzəldildi.
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [lawyerManagementOpen, setLawyerManagementOpen] = useState(false);
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const [clientStatsModalOpen, setClientStatsModalOpen] = useState(false);
  const [lawyerListModalOpen, setLawyerListModalOpen] = useState(false);
  const [newLawyerModalOpen, setNewLawyerModalOpen] = useState(false);
  const [groupChatOpen, setGroupChatOpen] = useState(false);
  const [clientDatabaseOpen, setClientDatabaseOpen] = useState(false);
  const [taskCreationOpen, setTaskCreationOpen] = useState(false);
  const [taskCreationOpenForLawyer, setTaskCreationOpenForLawyer] = useState(false);
  const [systemSettingsOpen, setSystemSettingsOpen] = useState(false);
  const [contractManagementOpen, setContractManagementOpen] = useState(false);
  const [contractDatabaseOpen, setContractDatabaseOpen] = useState(false);
  const [contractTasksOpen, setContractTasksOpen] = useState(false);
  const [lawyerDetailOpen, setLawyerDetailOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTask, setChatTask] = useState<any>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [managerTaskCreateOpen, setManagerTaskCreateOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [roleManagementOpen, setRoleManagementOpen] = useState(false);
  const [automationRulesOpen, setAutomationRulesOpen] = useState(false);
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [deadlineCalendarOpen, setDeadlineCalendarOpen] = useState(false);
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);

  // Modallar arası "1 addım geri" naviqasiyası üçün — hansı modal hansından açılıb
  const [taskDetailParent, setTaskDetailParent] = useState<'taskList' | null>(null);
  const [chatParent, setChatParent] = useState<'taskList' | 'taskDetail' | null>(null);
  const [contractTasksParent, setContractTasksParent] = useState<'lawyer' | 'contractDb' | null>(null);

  // Selected
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedLawyer, setSelectedLawyer] = useState<any>(null);
  const [selectedLawyerForDetail, setSelectedLawyerForDetail] = useState<any>(null);
  const [selectedContractForTasks, setSelectedContractForTasks] = useState<any>(null);
  const [selectedChatClient, setSelectedChatClient] = useState<any>(null);
  const [selectedLawyerForTask, setSelectedLawyerForTask] = useState<any>(null);
  const [selectedClientForContracts, setSelectedClientForContracts] = useState<any>(null);
  const [successMessage, setSuccessMessage] = useState({ title: '', message: '' });

  // Hesabatlar — açmazdan əvvəl icazəni yoxlayır, yoxdursa aydın bildiriş göstərir
  const openReports = async () => {
    try {
      const perms = await fetchApi('/auth/permissions');
      const allowed = !perms || !perms.restricted || !!(perms.permissions && perms.permissions.view_reports);
      if (!allowed) {
        toast.error('Hesabatları görmək üçün icazəniz yoxdur.', { description: 'İstəyirsinizsə, admin/menecerdən bu icazəni açmasını xahiş edin.' });
        return;
      }
    } catch { /* icazə yoxlanışı alınmasa, defolt olaraq aç */ }
    setReportsOpen(true);
  };

  const handleEditClient = (client: any) => {
    setEditingClient(client);
    setEditClientOpen(true);
  };

  // Bildiriş keçid handler-i: növə görə aidiyyatı yerə aparır
  const handleNotifNavigate = (info: any) => {
    const type = String(info?.type || '').toLowerCase();
    const entityId = info?.entityId;
    const findTask = () => (tasks || []).find((t: any) => String(t.id) === String(entityId));
    const findContract = () => (contracts || []).find((c: any) => String(c.id) === String(entityId));

    // Bildirişdən birbaşa açılan modalların "geri" zənciri yoxdur
    setChatParent(null);
    setContractTasksParent(null);
    setTaskDetailParent(null);

    // Chat mesajı → tapşırıq chat-ı
    if (type.indexOf('chat') >= 0 || type.indexOf('message') >= 0 || type.indexOf('mesaj') >= 0) {
      const t = findTask();
      if (t) { setChatTask(t); setChatOpen(true); return; }
    }

    // Müqavilə bildirişi → müqavilə tapşırıqları
    if (type.indexOf('contract') >= 0 || type.indexOf('müqavil') >= 0 || type.indexOf('muqavil') >= 0) {
      const c = findContract();
      if (c) { setSelectedContractForTasks(c); setContractTasksOpen(true); return; }
    }

    // Tapşırıq bildirişi (və ya default) → tapşırıq detalı
    const t = findTask();
    if (t) { setSelectedTask(t); setTaskDetailOpen(true); return; }

    // Tapşırıq tapılmadısa, müqavilə cəhd et
    const c = findContract();
    if (c) { setSelectedContractForTasks(c); setContractTasksOpen(true); return; }

    // Heç nə tapılmadı — silinmiş ola bilər
    console.warn('[Bildiriş] Aidiyyatı obyekt tapılmadı. type=', type, 'entityId=', entityId);
  };

  // Stats
  const deadlineThisMonth = useMemo(() => tasks.filter(t => {
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.status !== 'completed';
  }).length, [tasks]);

  const overdueTasks = useMemo(() => {
    const now = new Date();
    return tasks.filter(t => {
      if (!t.deadline || t.status === 'completed' || t.status === 'cancelled') return false;
      return new Date(t.deadline) < now;
    }).length;
  }, [tasks]);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/30">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 justify-between">
          {/* Sol tərəf: profil (yuxarı-sol) */}
          <button className="flex items-center gap-2 shrink-0 rounded-xl pl-1 pr-2 sm:pr-3 py-1 hover:bg-slate-100 transition-colors" onClick={() => setProfileSettingsOpen(true)} title="Profilim">
            <Avatar className="h-9 w-9 shadow-sm ring-2 ring-slate-300/60"><AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-900 text-white">{getLawUserInitials()}</AvatarFallback></Avatar>
            <div className="hidden sm:block text-left leading-tight">
              <p className="text-sm font-semibold text-slate-800 max-w-[160px] truncate">{getLawUserName()}</p>
              <p className="text-[11px] text-slate-400">Menecer</p>
            </div>
          </button>

          {/* Sağ tərəf: əməliyyatlar + menyu */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5 border-slate-200" onClick={() => setManagerTaskCreateOpen(true)}>
              <Plus className="h-4 w-4" /><span className="hidden sm:inline">Yeni tapşırıq</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 border-slate-200" onClick={() => setArchiveOpen(true)}>
              <Archive className="h-4 w-4" /><span className="hidden sm:inline">Arxiv</span>
            </Button>
            <Separator orientation="vertical" className="h-6 bg-slate-200 hidden sm:block" />
            <NotificationDropdown tenantId={tenantId} userId={1} userType="manager" onNavigate={handleNotifNavigate} validTaskIds={(tasks || []).map((t: any) => t.id)} />
            <Separator orientation="vertical" className="h-6 bg-slate-200 hidden sm:block" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="border-slate-200" title="Menyu">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setProfileSettingsOpen(true)}>
                  <User className="mr-2 h-4 w-4" />Profilim
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLibraryOpen(true)}>
                  <Book className="mr-2 h-4 w-4" />Konfiqurasiya kitabxanası
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRoleManagementOpen(true)}>
                  <Shield className="mr-2 h-4 w-4" />Rolların idarəedilməsi
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAutomationRulesOpen(true)}>
                  <Zap className="mr-2 h-4 w-4" />Avtomatlaşdırma qaydaları
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSystemSettingsOpen(true)}>
                  <Settings className="mr-2 h-4 w-4" />Tənzimləmələr
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setNewClientModalOpen(true)}>
                  <User className="mr-2 h-4 w-4" />Yeni müştəri hesabı
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setNewLawyerModalOpen(true)}>
                  <Briefcase className="mr-2 h-4 w-4" />Yeni vəkil hesabı
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPasswordChangeOpen(true)}>
                  <Lock className="mr-2 h-4 w-4" />Şifrəni dəyiş
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { localStorage.removeItem('law_token'); localStorage.removeItem('law_user'); window.location.href = '/login'; }} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />Çıxış
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 space-y-12">

        {/* ── Salamlama (2026-09, ana səhifə modernləşdirməsi) ──
            QEYD (2026-09, vizual-ardıcıllıq keçidi): əvvəllər burada 4 StatPill
            (aktiv müştəri/müqavilə/tapşırıq/gecikmiş tapşırıq) də göstərilirdi —
            LAKİN bunların HƏR BİRİ aşağıdakı "Məlumat bazası" kartlarında (ikon +
            başlıq + eyni rəqəm ilə, üstəlik kliklənə bilən) EYNƏN təkrarlanırdı;
            istifadəçinin bildirdiyi kimi eyni məlumat iki dəfə göstərilirdi. Təkrar
            StatPill sətri çıxarıldı, "Məlumat bazası" bölməsi bu rəqəmlərin YEGANƏ
            mənbəyi olaraq saxlanıldı. */}
        <section className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{getGreeting()}, {getLawUserName()}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Bugünkü ümumi vəziyyətə nəzər salın</p>
          </div>
        </section>

        {/* ── Section 1: Məlumat bazası ── */}
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Database className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Məlumat bazası</h2>
              <p className="text-sm text-gray-500">Əsas məlumat bazaları və qeydlər</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div className="group bg-white border border-slate-200 rounded-2xl p-5 cursor-pointer transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1 hover:bg-blue-50/60 hover:border-blue-300 active:translate-y-0 active:shadow-md"
              onClick={() => setClientDatabaseOpen(true)}>
              <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-blue-100 group-hover:scale-110 group-hover:-rotate-3">
                <Users className="h-5 w-5 text-slate-600 group-hover:text-blue-600 transition-colors duration-300" />
              </div>
              <p className="font-medium text-gray-900 text-sm transition-colors duration-300 group-hover:text-blue-900">Müştəri bazası</p>
              <p className="text-xs text-slate-500 mt-1">{clients.filter(c => !c.is_archived).length} müştəri</p>
            </div>

            <div className="group bg-white border border-slate-200 rounded-2xl p-5 cursor-pointer transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1 hover:bg-purple-50/60 hover:border-purple-300 active:translate-y-0 active:shadow-md"
              onClick={() => setContractDatabaseOpen(true)}>
              <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-purple-100 group-hover:scale-110 group-hover:-rotate-3">
                <FolderOpen className="h-5 w-5 text-slate-600 group-hover:text-purple-600 transition-colors duration-300" />
              </div>
              <p className="font-medium text-gray-900 text-sm transition-colors duration-300 group-hover:text-purple-900">Müqavilə bazası</p>
              <p className="text-xs text-slate-500 mt-1">{contracts.filter(c => !c.is_archived).length} müqavilə</p>
            </div>

            <div className="group bg-white border border-slate-200 rounded-2xl p-5 cursor-pointer transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1 hover:bg-emerald-50/60 hover:border-emerald-300 active:translate-y-0 active:shadow-md"
              onClick={() => setLawyerListModalOpen(true)}>
              <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-emerald-100 group-hover:scale-110 group-hover:-rotate-3">
                <UserCheck className="h-5 w-5 text-slate-600 group-hover:text-emerald-600 transition-colors duration-300" />
              </div>
              <p className="font-medium text-gray-900 text-sm transition-colors duration-300 group-hover:text-emerald-900">Vəkil bazası</p>
              <p className="text-xs text-slate-500 mt-1">{lawyers.filter(l => !l.is_archived).length} vəkil</p>
            </div>

            <div className="group bg-white border border-slate-200 rounded-2xl p-5 cursor-pointer transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1 hover:bg-orange-50/60 hover:border-orange-300 active:translate-y-0 active:shadow-md"
              onClick={() => setTaskListOpen(true)}>
              <div className="flex items-start justify-between mb-4">
                <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center transition-all duration-300 group-hover:bg-orange-100 group-hover:scale-110 group-hover:-rotate-3">
                  <ClipboardList className="h-5 w-5 text-slate-600 group-hover:text-orange-600 transition-colors duration-300" />
                </div>
                {overdueTasks > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
                    {overdueTasks}
                  </span>
                )}
              </div>
              <p className="font-medium text-gray-900 text-sm transition-colors duration-300 group-hover:text-orange-900">Bütün tapşırıqlar</p>
              <p className="text-xs text-slate-500 mt-1">
                {tasks.filter(t => !t.is_archived).length} tapşırıq
                {overdueTasks > 0 && <span className="text-red-500 ml-1">({overdueTasks} gecikmiş)</span>}
              </p>
            </div>

            <div className="group bg-white border border-slate-200 rounded-2xl p-5 cursor-pointer transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1 hover:bg-indigo-50/60 hover:border-indigo-300 active:translate-y-0 active:shadow-md"
              onClick={openReports}>
              <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-indigo-100 group-hover:scale-110 group-hover:-rotate-3">
                <BarChart3 className="h-5 w-5 text-slate-600 group-hover:text-indigo-600 transition-colors duration-300" />
              </div>
              <p className="font-medium text-gray-900 text-sm transition-colors duration-300 group-hover:text-indigo-900">Hesabatlar</p>
              <p className="text-xs text-slate-500 mt-1">Real məlumatlar əsasında analitika</p>
            </div>

            {/* Sənədlər (2026-09, istifadəçi tapşırığı: mərkəzi fayl idarəetməsi) —
                müştəri/müqavilə/tapşırıq sənədlərini bir yerdə göstərir, bax DocumentsModal.tsx */}
            <div className="group bg-white border border-slate-200 rounded-2xl p-5 cursor-pointer transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1 hover:bg-cyan-50/60 hover:border-cyan-300 active:translate-y-0 active:shadow-md"
              onClick={() => setDocumentsOpen(true)}>
              <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-cyan-100 group-hover:scale-110 group-hover:-rotate-3">
                <FileText className="h-5 w-5 text-slate-600 group-hover:text-cyan-600 transition-colors duration-300" />
              </div>
              <p className="font-medium text-gray-900 text-sm transition-colors duration-300 group-hover:text-cyan-900">Sənədlər</p>
              <p className="text-xs text-slate-500 mt-1">Bütün sənədlər bir yerdə</p>
            </div>
          </div>
        </section>

        <div className="border-t border-gray-200" />

        {/* ── Section 2: Gündəlik İdarəetmə ── (Menecer tapşırıqları silindi) */}
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Bell className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Gündəlik idarəetmə və əməliyyatlar</h2>
              <p className="text-sm text-gray-500">Proseslərin izlənməsi və deadline nəzarəti</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Nəzarət paneli */}
            <div className="group relative bg-white border border-indigo-200 rounded-2xl p-5 cursor-pointer transition-all duration-300 ease-out hover:shadow-xl hover:border-indigo-400 hover:-translate-y-1 hover:bg-indigo-50/60 active:translate-y-0 active:shadow-md"
              onClick={() => setControlPanelOpen(true)}>
              <div className="flex items-start justify-between mb-4">
                <div className="h-11 w-11 rounded-xl bg-indigo-50 flex items-center justify-center transition-all duration-300 group-hover:bg-indigo-100 group-hover:scale-110 group-hover:-rotate-3">
                  <AlertTriangle className="h-5 w-5 text-indigo-600" />
                </div>
              </div>
              <p className="font-medium text-gray-900 text-sm transition-colors duration-300 group-hover:text-indigo-900">Nəzarət paneli</p>
              <p className="text-xs text-indigo-600 mt-1 font-medium">Baş verən prosesləri izləyin</p>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Status</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Sənəd</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">Mesaj</span>
              </div>
            </div>

            {/* Vəkil təhkimi */}
            <div className="group relative bg-white border border-emerald-200 rounded-2xl p-5 cursor-pointer transition-all duration-300 ease-out hover:shadow-xl hover:border-emerald-400 hover:-translate-y-1 hover:bg-emerald-50/60 active:translate-y-0 active:shadow-md"
              onClick={() => setLawyerAssignmentOpen(true)}>
              <div className="flex items-start justify-between mb-4">
                <div className="h-11 w-11 rounded-xl bg-emerald-50 flex items-center justify-center transition-all duration-300 group-hover:bg-emerald-100 group-hover:scale-110 group-hover:-rotate-3">
                  <Briefcase className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
              <p className="font-medium text-gray-900 text-sm transition-colors duration-300 group-hover:text-emerald-900">Vəkil təhkimi</p>
              <p className="text-xs text-emerald-600 mt-1 font-medium">İş yükünə görə vəkil təyin edin</p>
            </div>

            {/* Deadline təqvimi */}
            <div className="group relative bg-white border border-rose-200 rounded-2xl p-5 cursor-pointer transition-all duration-300 ease-out hover:shadow-xl hover:border-rose-400 hover:-translate-y-1 hover:bg-rose-50/60 active:translate-y-0 active:shadow-md"
              onClick={() => setDeadlineCalendarOpen(true)}>
              <div className="flex items-start justify-between mb-2">
                <div className="h-11 w-11 rounded-xl bg-rose-50 flex items-center justify-center transition-all duration-300 group-hover:bg-rose-100 group-hover:scale-110 group-hover:-rotate-3">
                  <Calendar className="h-5 w-5 text-rose-600" />
                </div>
                <span className={'text-3xl font-extrabold tabular-nums leading-none ' + (overdueTasks > 0 ? 'text-red-600' : 'text-slate-800')}>
                  {deadlineThisMonth}
                </span>
              </div>
              <p className="font-medium text-gray-900 text-sm transition-colors duration-300 group-hover:text-rose-900">Deadline təqvimi</p>
              <p className="text-xs text-slate-500 mt-1">
                Bu ay bitən tapşırıqlar
                {overdueTasks > 0 && <span className="text-red-500 font-medium"> · {overdueTasks} gecikmiş</span>}
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* === Modals === */}

      <TaskListModal
        open={taskListOpen}
        onOpenChange={setTaskListOpen}
        tasks={tasks}
        title="Bütün tapşırıqlar"
        lawyers={lawyers}
        onTaskClick={(task: any) => { setTaskListOpen(false); setSelectedTask(task); setTaskDetailOpen(true); setTaskDetailParent('taskList'); }}
        onChat={(task: any) => { setTaskListOpen(false); setChatTask(task); setChatOpen(true); setChatParent('taskList'); }}
      />

      <ReportsModal
        open={reportsOpen}
        onOpenChange={setReportsOpen}
        allTasks={tasks}
        lawyers={lawyers}
        clients={clients}
        contracts={contracts}
        onTaskClick={(task: any) => { setSelectedTask(task); setTaskDetailOpen(true); }}
      />

<ClientDetailModal
        open={clientDetailOpen}
        onOpenChange={setClientDetailOpen}
        client={selectedClient}
        tenantId={tenantId}
        allContracts={contracts}
        allTasks={tasks}
        onRefresh={refresh}
        onEditClient={(c: any) => { setClientDetailOpen(false); handleEditClient(c); }}
      />

      <NewClientModal
        open={editClientOpen}
        editClient={editingClient}
        onOpenChange={(isOpen: boolean) => { setEditClientOpen(isOpen); if (!isOpen) setEditingClient(null); }}
        onClientUpdated={() => { setEditClientOpen(false); setEditingClient(null); refresh(); }}
      />

      <LawyerManagementModal
        open={lawyerManagementOpen}
        onOpenChange={setLawyerManagementOpen}
        lawyer={selectedLawyer}
        onRefresh={refresh}
        allLawyers={lawyers}
        onAssignTask={(l: any) => { setLawyerManagementOpen(false); setSelectedLawyerForTask(l); setTaskCreationOpenForLawyer(true); }}
      />

      <NewClientModal
        open={newClientModalOpen}
        onClose={() => setNewClientModalOpen(false)}
        onClientCreated={() => refresh()}
        onSuccess={(title: string, message: string) => {
          setSuccessMessage({ title, message });
          setSuccessModalOpen(true);
        }}
      />

      {/* BUG DÜZƏLİŞİ (2026-09): əvvəllər bu 3 callback ötürülmürdü — "Detallar",
          "Redaktə et" və mesaj düymələri görünüşdə fəal idi, amma klikləndikdə
          sadəcə "..." bildirişi göstərib heç nə etmirdi. */}
      <ClientStatsModal
        open={clientStatsModalOpen}
        onOpenChange={setClientStatsModalOpen}
        clients={clients}
        onViewClient={(client: any) => { setClientStatsModalOpen(false); setSelectedClient(client); setClientDetailOpen(true); }}
        onEditClient={(client: any) => { setClientStatsModalOpen(false); setSelectedClient(client); setClientDetailOpen(true); }}
        onMessageClient={(client: any) => { setClientStatsModalOpen(false); setSelectedChatClient(client); setGroupChatOpen(true); }}
      />

      <LawyerListModal
        open={lawyerListModalOpen}
        onOpenChange={setLawyerListModalOpen}
        lawyers={lawyers}
        onNewLawyer={() => setNewLawyerModalOpen(true)}
        onRefresh={refresh}
        onSelectLawyer={(lawyer: any) => {
          setSelectedLawyerForDetail(lawyer);
          setLawyerDetailOpen(true);
        }}
      />

      <LawyerDetailModal
        open={lawyerDetailOpen}
        onOpenChange={setLawyerDetailOpen}
        lawyer={selectedLawyerForDetail}
        contracts={contracts}
        tasks={tasks}
        clients={clients}
        onSelectContract={(contract: any) => {
          setSelectedContractForTasks(contract);
          setContractTasksOpen(true);
          setLawyerDetailOpen(false);
          setContractTasksParent('lawyer');
        }}
        onSave={async (id: any, data: any) => {
          var updated = await mutations.updateLawyer(id, data);
          setSelectedLawyerForDetail((prev: any) => (prev ? { ...prev, ...data } : prev));
          refresh();
          return updated;
        }}
      />

      <NewLawyerModal
        open={newLawyerModalOpen}
        onClose={() => setNewLawyerModalOpen(false)}
        onLawyerCreated={() => refresh()}
        onSuccess={(title: string, message: string) => {
          setSuccessMessage({ title, message });
          setSuccessModalOpen(true);
        }}
        tenantId={tenantId}
      />

      <GroupChatModal
        open={groupChatOpen}
        onOpenChange={setGroupChatOpen}
        client={selectedChatClient}
        contracts={contracts}
        taskTitle=""
      />

      <ClientDatabaseModal
        open={clientDatabaseOpen}
        onOpenChange={setClientDatabaseOpen}
        clients={clients}
        onRefresh={refresh}
      />

      <TaskCreationModal
        open={taskCreationOpen}
        onOpenChange={setTaskCreationOpen}
        prefilledClient={selectedClient?.name}
        clients={clients.map(c => c.name)}
        contracts={contracts}
        tenantId={tenantId}
        onContractUpdate={() => refresh()}
      />

      <TaskCreationModal
        open={taskCreationOpenForLawyer}
        onOpenChange={setTaskCreationOpenForLawyer}
        prefilledLawyer={selectedLawyerForTask?.name}
        clients={clients.map(c => c.name)}
        contracts={contracts}
        tenantId={tenantId}
        onContractUpdate={() => refresh()}
      />

      <SystemSettingsModal
        open={systemSettingsOpen}
        onOpenChange={setSystemSettingsOpen}
      />

      <ContractManagementModal
        open={contractManagementOpen}
        onOpenChange={setContractManagementOpen}
        clientId={selectedClientForContracts?.id || ''}
        clientName={selectedClientForContracts?.name || ''}
        contracts={contracts.filter(c => c.client_id === selectedClientForContracts?.id)}
        onContractsUpdate={() => refresh()}
        lawyers={lawyers}
      />

      <ContractDatabaseModal
        open={contractDatabaseOpen}
        onOpenChange={setContractDatabaseOpen}
        contracts={contracts}
        clients={clients}
        lawyers={lawyers}
        onSelectContract={(contract: any) => {
          setSelectedContractForTasks(contract);
          setContractTasksOpen(true);
          setContractDatabaseOpen(false);
          setContractTasksParent('contractDb');
        }}
        onRefresh={() => refresh()}
      />

      <ContractTasksModal
        open={contractTasksOpen}
        onOpenChange={(v) => { setContractTasksOpen(v); if (!v) setContractTasksParent(null); }}
        contract={selectedContractForTasks}
        tasks={tasks}
        lawyers={lawyers}
        onSelectTask={(task: any) => {
          setSelectedTask(task);
          setTaskDetailOpen(true);
        }}
        onRefresh={refresh}
        onBack={contractTasksParent ? () => {
          setContractTasksOpen(false);
          if (contractTasksParent === 'lawyer') setLawyerDetailOpen(true);
          else if (contractTasksParent === 'contractDb') setContractDatabaseOpen(true);
          setContractTasksParent(null);
        } : undefined}
      />

      {/* BUG DÜZƏLİŞİ (2026-09): SuccessModal `isOpen`/`onClose`/`description` prop-larını
          gözləyir, amma burada `open`/`onOpenChange`/`message` göndərilirdi — `isOpen`
          heç vaxt dəyər almadığı üçün pəncərə HEÇ VAXT açılmırdı. Nəticədə menecer yeni
          müştəri/vəkil hesabı yaratdıqda heç bir uğur bildirişi görmürdü. */}
      <SuccessModal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title={successMessage.title}
        description={successMessage.message}
      />

      <ArchiveModal
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        userRole="manager"
        onRefresh={refresh}
      />

      <DocumentsModal open={documentsOpen} onOpenChange={setDocumentsOpen} />

      <TaskChatModal
        open={chatOpen}
        onOpenChange={(v) => { setChatOpen(v); if (!v) setChatParent(null); }}
        taskId={chatTask?.id}
        taskTitle={chatTask?.title}
        userRole="manager"
        userId={0}
        userName="Menecer"
        onBack={chatParent ? () => {
          setChatOpen(false);
          if (chatParent === 'taskList') setTaskListOpen(true);
          else if (chatParent === 'taskDetail') setTaskDetailOpen(true);
          setChatParent(null);
        } : undefined}
      />

      <TaskDetailView
        open={taskDetailOpen}
        onOpenChange={(v) => { setTaskDetailOpen(v); if (!v) setTaskDetailParent(null); }}
        task={selectedTask}
        userRole="manager"
        onChat={(t) => { setTaskDetailOpen(false); setChatTask(t); setChatOpen(true); setChatParent('taskDetail'); }}
        onRefresh={refresh}
        onBack={taskDetailParent ? () => {
          setTaskDetailOpen(false);
          if (taskDetailParent === 'taskList') setTaskListOpen(true);
          setTaskDetailParent(null);
        } : undefined}
      />

      <ProfileSettings open={profileSettingsOpen} onOpenChange={setProfileSettingsOpen} />
      <LibraryModal open={libraryOpen} onOpenChange={setLibraryOpen} />
      <RoleManagementModal open={roleManagementOpen} onOpenChange={setRoleManagementOpen} />
      <AutomationRulesModal open={automationRulesOpen} onOpenChange={setAutomationRulesOpen} />
      <PasswordChangeModal open={passwordChangeOpen} onOpenChange={setPasswordChangeOpen} />

      <ManagerTaskCreationModal
        open={managerTaskCreateOpen}
        onOpenChange={setManagerTaskCreateOpen}
        clients={clients}
        contracts={contracts}
        lawyers={lawyers}
        tenantId={tenantId}
        onCreated={refresh}
      />

      <DeadlineCalendarModal
        open={deadlineCalendarOpen}
        onOpenChange={setDeadlineCalendarOpen}
        tasks={tasks}
        lawyers={lawyers}
        onRefresh={refresh}
        onSelectTask={(task: any) => {
          setSelectedTask(task);
          setTaskDetailOpen(true);
        }}
      />

      <ControlPanelModal
        open={controlPanelOpen}
        onOpenChange={setControlPanelOpen}
        lawyers={lawyers}
        clients={clients}
      />

      <LawyerAssignmentModal
        open={lawyerAssignmentOpen}
        onOpenChange={setLawyerAssignmentOpen}
        lawyers={lawyers}
        onRefresh={refresh}
      />
    </div>
  );
}

// QEYD (2026-09, vizual-ardıcıllıq keçidi): əvvəllər burada istifadə olunan
// StatPill komponenti (ani-baxış statistika "pill"-i) silindi — onun göstərdiyi
// rəqəmlər "Məlumat bazası" kartlarında artıq göstərilir, təkrar idi.