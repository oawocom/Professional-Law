"use client";
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import {
  Archive, FileText, FolderOpen, Search, User, RotateCcw, Trash2, Loader2, AlertCircle, AlertTriangle, ChevronDown, ChevronRight, Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchApi } from '../../utils/apiHelper';
import { formatDate as sharedFormatDate } from '../../utils/dateFormat';

interface ArchiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole?: 'manager' | 'lawyer' | 'client';
  onRefresh?: () => void;
}

function formatDateAz(d?: string | Date | null) {
  return sharedFormatDate(d, '—');
}

export function ArchiveModal({ open, onOpenChange, userRole = 'manager', onRefresh }: ArchiveModalProps) {
  // Rol üzrə görünüş: menecer hər 3 tabı görür (tam CRUD); vəkil yalnız öz
  // arxivləşmiş tapşırıqlarını (yalnız bərpa, silmə yoxdur — bu menecer icazəsidir);
  // müştəri öz arxivləşmiş müqavilə/tapşırıqlarını yalnız baxış rejimində görür.
  const showClientsTab = userRole === 'manager';
  const showContractsTab = userRole === 'manager' || userRole === 'client';
  const canDelete = userRole === 'manager';
  const canRestore = userRole === 'manager' || userRole === 'lawyer';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(userRole === 'manager' ? 'clients' : userRole === 'client' ? 'contracts' : 'tasks');
  const [loading, setLoading] = useState(false);
  const [archivedClients, setArchivedClients] = useState<any[]>([]);
  const [archivedContracts, setArchivedContracts] = useState<any[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<any[]>([]);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  // BUG DÜZƏLİŞİ (2026-09): əvvəllər 3 həmişəlik-silmə əməliyyatı da (müştəri/
  // müqavilə/tapşırıq) yalnız brauzerin sadə `window.confirm()` pəncərəsi ilə
  // təsdiqlənirdi — ClientDatabaseModal.tsx/ContractDatabaseModal.tsx-dəki
  // "yaz və təsdiqlə" nümunəsi ilə eyni, daha təhlükəsiz standarta gətirildi.
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'client' | 'contract' | 'task'; item: any } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  // Hüquqi şəxsə bağlı Fərdi hesablar arxivdə droplist kimi göstərilir
  const [expandedParents, setExpandedParents] = useState<Set<number>>(new Set());
  const toggleExpanded = (id: number) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Modal açılanda və ya yenilənmə olduqda data çək
  const fetchArchived = async () => {
    setLoading(true);
    try {
      const data = await fetchApi('/archived');
      setArchivedClients(data?.clients || []);
      setArchivedContracts(data?.contracts || []);
      setArchivedTasks(data?.tasks || []);
    } catch (err: any) {
      console.error('Failed to fetch archived items:', err);
      toast.error('Arxiv yüklənmədi: ' + (err?.message || ''));
      setArchivedClients([]);
      setArchivedContracts([]);
      setArchivedTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchArchived();
  }, [open]);

  // === MÜŞTƏRİ ===
  const restoreClient = async (client: any) => {
    setActionInProgress('client-' + client.id);
    try {
      await fetchApi('/clients/' + client.id + '/archive', {
        method: 'PUT',
        body: JSON.stringify({ is_archived: false }),
      });
      toast.success(client.name + ' bərpa edildi (müqavilələri və tapşırıqları da)');
      await fetchArchived();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error('Bərpa xətası: ' + (err?.message || ''));
    } finally {
      setActionInProgress(null);
    }
  };

  const deleteClient = (client: any) => {
    setDeleteTarget({ kind: 'client', item: client });
    setDeleteConfirmText('');
  };

  // === MÜQAVİLƏ ===
  const restoreContract = async (contract: any) => {
    setActionInProgress('contract-' + contract.id);
    try {
      await fetchApi('/contracts/' + contract.id + '/archive', {
        method: 'PUT',
        body: JSON.stringify({ is_archived: false }),
      });
      toast.success((contract.title || 'Müqavilə') + ' bərpa edildi');
      await fetchArchived();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error('Bərpa xətası: ' + (err?.message || ''));
    } finally {
      setActionInProgress(null);
    }
  };

  const deleteContract = (contract: any) => {
    setDeleteTarget({ kind: 'contract', item: contract });
    setDeleteConfirmText('');
  };

  // === TAPŞIRIQ ===
  const restoreTask = async (task: any) => {
    setActionInProgress('task-' + task.id);
    try {
      await fetchApi('/tasks/' + task.id + '/archive', {
        method: 'PUT',
        body: JSON.stringify({ is_archived: false }),
      });
      toast.success((task.title || 'Tapşırıq') + ' bərpa edildi');
      await fetchArchived();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error('Bərpa xətası: ' + (err?.message || ''));
    } finally {
      setActionInProgress(null);
    }
  };

  const deleteTask = (task: any) => {
    setDeleteTarget({ kind: 'task', item: task });
    setDeleteConfirmText('');
  };

  // Bütün 3 tip üçün paylaşılan, təsdiq pəncərəsindən çağırılan həmişəlik-silmə funksiyası
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { kind, item } = deleteTarget;
    setDeleting(true);
    setActionInProgress(kind + '-' + item.id);
    try {
      if (kind === 'client') {
        await fetchApi('/clients/' + item.id, { method: 'DELETE' });
        toast.success((item.name || 'Müştəri') + ' həmişəlik silindi');
      } else if (kind === 'contract') {
        await fetchApi('/contracts/' + item.id, { method: 'DELETE' });
        toast.success((item.title || 'Müqavilə') + ' həmişəlik silindi');
      } else {
        await fetchApi('/tasks/' + item.id, { method: 'DELETE' });
        toast.success((item.title || 'Tapşırıq') + ' həmişəlik silindi');
      }
      setDeleteTarget(null);
      setDeleteConfirmText('');
      await fetchArchived();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error('Silmə xətası: ' + (err?.message || ''));
    } finally {
      setDeleting(false);
      setActionInProgress(null);
    }
  };

  const deleteTargetLabel = deleteTarget
    ? (deleteTarget.kind === 'client'
        ? (deleteTarget.item.name || 'Bu müştəri')
        : (deleteTarget.item.title || (deleteTarget.kind === 'contract' ? 'Bu müqavilə' : 'Bu tapşırıq')))
    : '';
  const deleteTargetNoun = deleteTarget
    ? (deleteTarget.kind === 'client' ? 'müştəri' : deleteTarget.kind === 'contract' ? 'müqavilə' : 'tapşırıq')
    : '';

  // === FILTERS ===
  const q = searchQuery.toLowerCase();
  const matchesClientQuery = (c: any) =>
    !q ||
    (c.name || '').toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q);

  // Yalnız kök (bağlı olmayan) müştərilər əsas siyahıda göstərilir; Hüquqi
  // şəxsə bağlı Fərdi hesablar öz valideynlərinin altında droplist kimi.
  const topLevelClients = archivedClients.filter((c: any) => !c.parent_client_id);
  const childrenByParent = (parentId: number) =>
    archivedClients.filter((c: any) => c.parent_client_id === parentId);
  const filteredClients = topLevelClients.filter((c: any) =>
    matchesClientQuery(c) || childrenByParent(c.id).some(matchesClientQuery)
  );
  const filteredContracts = archivedContracts.filter((c: any) =>
    !q ||
    (c.title || c.name || '').toLowerCase().includes(q) ||
    (c.contract_number || '').toLowerCase().includes(q) ||
    (c.client?.name || '').toLowerCase().includes(q)
  );
  const filteredTasks = archivedTasks.filter((t: any) =>
    !q ||
    (t.title || '').toLowerCase().includes(q) ||
    (t.task_number || '').toLowerCase().includes(q) ||
    (t.contract?.title || '').toLowerCase().includes(q)
  );

  const counts = {
    clients: archivedClients.length,
    contracts: archivedContracts.length,
    tasks: archivedTasks.length,
  };
  const totalCount = counts.clients + counts.contracts + counts.tasks;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />Arxiv
          </DialogTitle>
          <DialogDescription>
            Arxivləşdirilmiş müştərilər, müqavilələr və tapşırıqlar.
            Bərpa edə və ya həmişəlik silə bilərsiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col px-6 py-4 min-h-0">
          {/* Axtarış */}
          <div className="relative mb-3 shrink-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Axtarış..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : totalCount === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
              <Archive className="h-16 w-16 mb-4 opacity-40" />
              <h3 className="font-medium mb-1">Arxiv boşdur</h3>
              <p className="text-sm">Heç bir arxivləşdirilmiş element yoxdur</p>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className={'grid w-full shrink-0 ' + (showClientsTab ? 'grid-cols-3' : showContractsTab ? 'grid-cols-2' : 'grid-cols-1')}>
                {showClientsTab && (
                  <TabsTrigger value="clients" className="gap-2">
                    <User className="h-3.5 w-3.5" />Müştərilər
                    <Badge variant="secondary" className="ml-1">{counts.clients}</Badge>
                  </TabsTrigger>
                )}
                {showContractsTab && (
                  <TabsTrigger value="contracts" className="gap-2">
                    <FolderOpen className="h-3.5 w-3.5" />Müqavilələr
                    <Badge variant="secondary" className="ml-1">{counts.contracts}</Badge>
                  </TabsTrigger>
                )}
                <TabsTrigger value="tasks" className="gap-2">
                  <FileText className="h-3.5 w-3.5" />Tapşırıqlar
                  <Badge variant="secondary" className="ml-1">{counts.tasks}</Badge>
                </TabsTrigger>
              </TabsList>

              {/* === MÜŞTƏRİLƏR (yalnız menecer) === */}
              {showClientsTab && (
              <TabsContent value="clients" className="flex-1 mt-3 min-h-0">
                <ScrollArea className="h-full pr-2">
                  {filteredClients.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Müştəri tapılmadı
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredClients.map((client: any) => {
                        const busy = actionInProgress === 'client-' + client.id;
                        const isLegal = client.type === 'legal' || client.type === 'company';
                        const children = isLegal ? childrenByParent(client.id) : [];
                        const isExpanded = expandedParents.has(client.id);
                        return (
                          <div key={client.id}>
                            <Card className="border-amber-200 bg-amber-50/40">
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      {children.length > 0 ? (
                                        <button type="button" onClick={() => toggleExpanded(client.id)} className="shrink-0">
                                          {isExpanded ? <ChevronDown className="h-4 w-4 text-amber-700" /> : <ChevronRight className="h-4 w-4 text-amber-700" />}
                                        </button>
                                      ) : (
                                        isLegal ? <Building2 className="h-4 w-4 text-amber-700 shrink-0" /> : <User className="h-4 w-4 text-amber-700 shrink-0" />
                                      )}
                                      <h4 className="font-medium text-sm truncate">{client.name}</h4>
                                      <Badge variant="outline" className="text-[10px]">{isLegal ? 'Hüquqi şəxs' : 'Fiziki şəxs'}</Badge>
                                      {children.length > 0 && (
                                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">{children.length} bağlı hesab</Badge>
                                      )}
                                      <Badge variant="outline" className="text-[10px]">Arxiv</Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground space-y-0.5">
                                      {client.email && <div>📧 {client.email}</div>}
                                      {client.phone && <div>📞 {client.phone}</div>}
                                      {client.archived_at && <div>Arxivləşdirildi: {formatDateAz(client.archived_at)}</div>}
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-1.5 shrink-0">
                                    <Button size="sm" variant="outline" disabled={busy} onClick={() => restoreClient(client)} type="button">
                                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                                      Bərpa et
                                    </Button>
                                    <Button size="sm" variant="outline" disabled={busy} onClick={() => deleteClient(client)} type="button"
                                      className="text-red-600 border-red-200 hover:bg-red-50">
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      Sil
                                    </Button>
                                  </div>
                                </div>
                                <div className="mt-2 text-[10px] text-amber-700 flex items-start gap-1">
                                  <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                                  <span>Bərpa edildikdə bu müştərinin bütün arxivləşdirilmiş müqavilə və tapşırıqları{children.length > 0 ? ' (və bağlı hesabları)' : ''} da bərpa olunacaq</span>
                                </div>
                              </CardContent>
                            </Card>
                            {isExpanded && children.length > 0 && (
                              <div className="ml-6 mt-1.5 space-y-1.5 border-l-2 border-amber-200 pl-3">
                                {children.map((child: any) => {
                                  const childBusy = actionInProgress === 'client-' + child.id;
                                  return (
                                    <Card key={child.id} className="border-amber-100 bg-amber-50/20">
                                      <CardContent className="p-2.5">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                              <User className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                              <h5 className="font-medium text-xs truncate">{child.name}</h5>
                                              <Badge variant="outline" className="text-[9px]">Fərdi hesab</Badge>
                                            </div>
                                            <div className="text-[10px] text-muted-foreground space-y-0.5">
                                              {child.email && <div>📧 {child.email}</div>}
                                            </div>
                                          </div>
                                          <div className="flex flex-col gap-1 shrink-0">
                                            <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" disabled={childBusy} onClick={() => restoreClient(child)} type="button">
                                              {childBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                                              Bərpa et
                                            </Button>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
              )}

              {/* === MÜQAVİLƏLƏR (menecer: tam CRUD, müştəri: yalnız baxış) === */}
              {showContractsTab && (
              <TabsContent value="contracts" className="flex-1 mt-3 min-h-0">
                <ScrollArea className="h-full pr-2">
                  {filteredContracts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Müqavilə tapılmadı
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredContracts.map((contract: any) => {
                        const busy = actionInProgress === 'contract-' + contract.id;
                        return (
                          <Card key={contract.id} className="border-violet-200 bg-violet-50/40">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <FolderOpen className="h-4 w-4 text-violet-700 shrink-0" />
                                    <h4 className="font-medium text-sm truncate">{contract.title || 'Müqavilə #' + contract.id}</h4>
                                    {contract.contract_number && (
                                      <span className="text-[10px] font-mono text-muted-foreground">{contract.contract_number}</span>
                                    )}
                                    <Badge variant="outline" className="text-[10px]">Arxiv</Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground space-y-0.5">
                                    {contract.client?.name && <div>Müştəri: {contract.client.name}</div>}
                                    {contract.archived_at && <div>Arxivləşdirildi: {formatDateAz(contract.archived_at)}</div>}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1.5 shrink-0">
                                  {canRestore && (
                                    <Button size="sm" variant="outline" disabled={busy} onClick={() => restoreContract(contract)} type="button">
                                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                                      Bərpa et
                                    </Button>
                                  )}
                                  {canDelete && (
                                    <Button size="sm" variant="outline" disabled={busy} onClick={() => deleteContract(contract)} type="button"
                                      className="text-red-600 border-red-200 hover:bg-red-50">
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      Sil
                                    </Button>
                                  )}
                                  {!canRestore && !canDelete && (
                                    <Badge variant="outline" className="text-[10px] text-muted-foreground">Yalnız baxış</Badge>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
              )}

              {/* === TAPŞIRIQLAR === */}
              <TabsContent value="tasks" className="flex-1 mt-3 min-h-0">
                <ScrollArea className="h-full pr-2">
                  {filteredTasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Tapşırıq tapılmadı
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredTasks.map((task: any) => {
                        const busy = actionInProgress === 'task-' + task.id;
                        return (
                          <Card key={task.id} className="border-blue-200 bg-blue-50/40">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <FileText className="h-4 w-4 text-blue-700 shrink-0" />
                                    <h4 className="font-medium text-sm truncate">{task.title || 'Tapşırıq #' + task.id}</h4>
                                    {task.task_number && (
                                      <span className="text-[10px] font-mono text-muted-foreground">{task.task_number}</span>
                                    )}
                                    <Badge variant="outline" className="text-[10px]">Arxiv</Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground space-y-0.5">
                                    {task.contract?.title && <div>Müqavilə: {task.contract.title}</div>}
                                    {task.assignee?.name && <div>Vəkil: {task.assignee.name}</div>}
                                    {task.archived_at && <div>Arxivləşdirildi: {formatDateAz(task.archived_at)}</div>}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1.5 shrink-0">
                                  {canRestore && (
                                    <Button size="sm" variant="outline" disabled={busy} onClick={() => restoreTask(task)} type="button">
                                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                                      Bərpa et
                                    </Button>
                                  )}
                                  {canDelete && (
                                    <Button size="sm" variant="outline" disabled={busy} onClick={() => deleteTask(task)} type="button"
                                      className="text-red-600 border-red-200 hover:bg-red-50">
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      Sil
                                    </Button>
                                  )}
                                  {!canRestore && !canDelete && (
                                    <Badge variant="outline" className="text-[10px] text-muted-foreground">Yalnız baxış</Badge>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <div className="px-6 py-3 border-t shrink-0 flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Bağla</Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* BUG DÜZƏLİŞİ (2026-09): həmişəlik silmə təsdiqi — ClientDatabaseModal.tsx ilə eyni nümunə */}
    <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteConfirmText(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700"><AlertTriangle className="h-5 w-5" />Həmişəlik sil</DialogTitle>
            <DialogDescription className="space-y-2 pt-1">
              <span className="block"><strong>{deleteTargetLabel}</strong> verilənlər bazasından HƏMİŞƏLİK silinəcək. Bu əməliyyat GERİ QAYTARILA BİLMƏZ.</span>
              {deleteTarget?.kind === 'client' && (
                <>
                  <span className="block">Bununla birgə həmişəlik silinəcək:</span>
                  <span className="block">• Bu müştəriyə aid BÜTÜN müqavilələr</span>
                  <span className="block">• Bu müqavilələrə aid BÜTÜN tapşırıqlar</span>
                </>
              )}
              {deleteTarget?.kind === 'contract' && (
                <span className="block">Bununla birgə bu müqaviləyə aid BÜTÜN tapşırıqlar da həmişəlik silinəcək.</span>
              )}
              <span className="block pt-2">Təsdiq üçün aşağıya <strong>SIL</strong> yazın:</span>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="SIL"
            className="mt-1"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); }} disabled={deleting} type="button">Ləğv et</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting || deleteConfirmText.trim().toUpperCase() !== 'SIL'} type="button">
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Həmişəlik sil {deleteTargetNoun ? '(' + deleteTargetNoun + ')' : ''}
            </Button>
          </div>
        </DialogContent>
    </Dialog>
    </>
  );
}