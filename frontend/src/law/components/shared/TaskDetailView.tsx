'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { fetchApi, uploadFile } from '../../utils/apiHelper';
import { formatDate as sharedFormatDate, formatDateTime as sharedFormatDateTime } from '../../utils/dateFormat';
import { FileViewerModal } from './FileViewerModal';
import {
  COMPLETION_OPTIONS,
  getStatusLabel, getStatusColor
} from '../../utils/taskStatusConstants';
import { toast } from 'sonner';
import {
  FileText, Calendar, Clock, User, DollarSign, Edit3, Save, X,
  Upload, Download, Briefcase, MessageSquare, CheckCircle, AlertTriangle,
  Activity, ChevronRight, Send, MoreHorizontal, History, Archive, Loader2, Plus, Eye
} from 'lucide-react';

function fmtDate(d: any) {
  return sharedFormatDate(d, '-');
}
function fmtDT(d: any) {
  return sharedFormatDateTime(d, '-');
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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: any;
  userRole: 'manager' | 'lawyer' | 'client';
  onChat?: (task: any) => void;
  onStatusChange?: (task: any) => void;
  onRefresh?: () => void;
  /** Verilsə, modalın üstündə "Geri" düyməsi çıxır və bu callback çağırılır
   * (məsələn siyahı modalına geri qayıtmaq üçün) — bağlamadan fərqli olaraq. */
  onBack?: () => void;
}

export function TaskDetailView({ open, onOpenChange, task, userRole, onChat, onStatusChange, onRefresh, onBack }: Props) {
  var [editingField, setEditingField] = useState<string | null>(null);
  var [editValue, setEditValue]       = useState('');
  var [savingField, setSavingField]   = useState(false);
  var [newDocFiles, setNewDocFiles]   = useState<File[]>([]);
  var [newDocDesc, setNewDocDesc]     = useState('');
  var [addingDoc, setAddingDoc]       = useState(false);
  var [docCategories, setDocCategories] = useState<any[]>([]);
  var [newDocCategory, setNewDocCategory] = useState('');   // library item id
  var [newDocCustomName, setNewDocCustomName] = useState(''); // when "diger"

  // Status change (inline for manager)
  var [showStatusPanel, setShowStatusPanel]       = useState(false);
  var [selectedStatus, setSelectedStatus]         = useState('');
  var [completionResult, setCompletionResult]     = useState('');
  var [statusNote, setStatusNote]                 = useState('');
  var [statusDocFile, setStatusDocFile]           = useState<File | null>(null);
  var [statusDocDesc, setStatusDocDesc]           = useState('');
  var [savingStatus, setSavingStatus]             = useState(false);

  // Approval history
  var [approvals, setApprovals] = useState<any[]>([]);
  var [approvalsLoading, setApprovalsLoading] = useState(false);
  var [viewerDoc, setViewerDoc] = useState<any>(null);
  var [libraryStatuses, setLibraryStatuses] = useState<any[]>([]);

  // Fetch document categories from library
  useEffect(function() {
    if (!open) return;
    fetchApi('/library?type=document_category')
      .then(function(data: any) { setDocCategories(Array.isArray(data) ? data : []); })
      .catch(function() { setDocCategories([]); });
    // Statusları kitabxanadan yüklə
    fetchApi('/library?type=status')
      .then(function(data: any) { setLibraryStatuses(Array.isArray(data) ? data : []); })
      .catch(function() { setLibraryStatuses([]); });
  }, [open]);

  if (!task) return null;

  var t = task;
  var tId = t.id || t.ID;
  var title = g(t, 'title', 'Title') || ('#' + g(t, 'task_number', 'taskNumber'));
  var status = g(t, 'status', 'Status') || 'new';
  var priority = g(t, 'priority', 'Priority') || 'medium';
  var subject = g(t, 'subject', 'Subject');
  var clientRole = g(t, 'client_role', 'clientRole');
  var oppositeRole = g(t, 'opposite_role', 'oppositeRole');
  var oppositePartyName = g(t, 'opposite_party_name', 'oppositePartyName');
  var respondentName = g(t, 'respondent_name', 'respondentName');
  var description = g(t, 'description', 'Description') || g(t, 'notes', 'Notes');
  var category = g(t, 'category', 'Category');
  var clientName = g(t, 'clientName', 'client_name') || t.client?.name || '';
  var lawyerName = g(t, 'assignedLawyer', 'assigned_lawyer') || t.assignee?.name || '';
  var contractName = g(t, 'contractTitle', 'contract_title') || t.contract?.title || '';
  var clientDeadline = g(t, 'deadline', 'Deadline');
  var claimDeadline = g(t, 'claim_deadline', 'claimDeadline', 'manager_deadline', 'managerDeadline');
  var createdAt = g(t, 'created_at', 'createdAt');
  var completedAt = g(t, 'completed_at', 'completedAt');
  var claimAmounts = parseJSON(g(t, 'claim_amounts', 'claimAmounts'));
  var totalClaim = Number(g(t, 'total_claim', 'totalClaim')) || claimAmounts.reduce(function(s: number, c: any) { return s + (Number(c.amount) || 0); }, 0);
  var documents = parseJSON(g(t, 'document_checklist', 'documentChecklist'));

  var canEdit = userRole === 'manager' || userRole === 'lawyer';
  var isManager = userRole === 'manager';
  var isLawyer = userRole === 'lawyer';

  // ── Fetch approval history for this task
  var fetchApprovals = async function() {
    if (!tId) return;
    setApprovalsLoading(true);
    try {
      var data = await fetchApi('/approvals?entity_type=task');
      var all: any[] = Array.isArray(data) ? data : [];
      setApprovals(all.filter(function(a: any) {
        return String(a.task_id) === String(tId) || String(a.entity_id) === String(tId);
      }));
    } catch { setApprovals([]); }
    finally { setApprovalsLoading(false); }
  };

  // ── Field edit
  var saveField = async function() {
    if (!editingField || !tId) return;
    setSavingField(true);
    try {
      var valueToSave = editValue;
      // Convert claim_deadline: if it's dd.MM.yyyy format → ISO
      if (editingField === 'claim_deadline' && editValue) {
        var parts = editValue.split('.');
        if (parts.length === 3 && parts[2].length === 4) {
          // dd.MM.yyyy → yyyy-MM-ddT00:00:00Z
          valueToSave = parts[2] + '-' + parts[1].padStart(2,'0') + '-' + parts[0].padStart(2,'0') + 'T00:00:00Z';
        } else if (editValue.length === 10 && editValue.includes('-')) {
          // yyyy-MM-dd → add time
          valueToSave = editValue + 'T00:00:00Z';
        }
      }
      await fetchApi('/tasks/' + tId + '/field', {
        method: 'PUT',
        body: JSON.stringify({ field: editingField, value: valueToSave }),
      });
      toast.success('Yeniləndi');
      setEditingField(null);
      if (onRefresh) onRefresh();
    } catch { toast.error('Xəta baş verdi'); }
    finally { setSavingField(false); }
  };

  // ── Add document(s) to task (general) — bir və ya bir neçə fayl eyni anda
  var handleAddDoc = async function() {
    if (newDocFiles.length === 0 || !tId) return;
    setAddingDoc(true);
    try {
      var selectedCat = docCategories.find(function(c: any) { return String(c.id) === newDocCategory; });
      var isDigər = !selectedCat; // no category selected or "diger"
      var newDocs: any[] = [];
      for (var i = 0; i < newDocFiles.length; i++) {
        var f = newDocFiles[i];
        try {
          var up: any = await uploadFile(f);
          var displayName = isDigər
            ? ('Digər — ' + (newDocCustomName.trim() || f.name))
            : selectedCat.name;
          newDocs.push({
            name: displayName,
            description: isDigər ? (newDocCustomName.trim() || f.name) : selectedCat.name,
            url: up.url, file_type: f.type, file_size: f.size,
            uploaded_by: userRole, uploaded_at: new Date().toISOString(),
            is_later_addition: true,
            doc_category_id: selectedCat ? selectedCat.id : null,
          });
        } catch (_) {}
      }
      if (newDocs.length === 0) throw new Error('upload failed');
      await fetchApi('/tasks/' + tId, {
        method: 'PUT',
        body: JSON.stringify({ document_checklist: JSON.stringify(documents.concat(newDocs)) }),
      });
      toast.success(newDocs.length > 1 ? newDocs.length + ' sənəd əlavə edildi' : 'Sənəd əlavə edildi');
      setNewDocFiles([]); setNewDocDesc(''); setNewDocCategory(''); setNewDocCustomName('');
      if (onRefresh) onRefresh();
    } catch { toast.error('Xəta baş verdi'); }
    finally { setAddingDoc(false); }
  };

  // ── Manager direct status change
  var handleManagerStatusChange = async function() {
    if (!selectedStatus || !tId) return;
    setSavingStatus(true);
    try {
      // 1. Encode doc if any
      var attachments: any[] = [];
      if (statusDocFile) {
        var up: any = await uploadFile(statusDocFile);
        attachments.push({
          name: statusDocFile.name, description: statusDocDesc || statusDocFile.name,
          url: up.url, file_type: statusDocFile.type, file_size: statusDocFile.size,
          uploaded_by: 'manager', uploaded_at: new Date().toISOString()
        });
        // Also add to task document_checklist
        var newDocEntry = {
          name: statusDocFile.name,
          description: (statusDocDesc || '') + ' [Status: ' + getStatusLabel(selectedStatus) + ']',
          url: up.url, file_type: statusDocFile.type, file_size: statusDocFile.size,
          uploaded_by: 'manager', uploaded_at: new Date().toISOString(),
          is_later_addition: true, status_change: selectedStatus,
        };
        await fetchApi('/tasks/' + tId, {
          method: 'PUT',
          body: JSON.stringify({ document_checklist: JSON.stringify(documents.concat([newDocEntry])) }),
        });
      }

      // 2. Change status — backend bu PUT-dan avtomatik "status_change" tarixçə
      // qeydi yaradır (bax: handlers.go UpdateTask). Qeyd/sənəd əlavə kontekst kimi ötürülür.
      await fetchApi('/tasks/' + tId, {
        method: 'PUT',
        body: JSON.stringify({
          status: selectedStatus,
          history_reason: statusNote || 'Menecer tərəfindən birbaşa dəyişdirildi',
          history_attachments: attachments.length > 0 ? JSON.stringify(attachments) : undefined,
        }),
      });

      toast.success('Status dəyişdirildi: ' + getStatusLabel(selectedStatus));
      setShowStatusPanel(false);
      setSelectedStatus(''); setStatusNote(''); setStatusDocFile(null); setStatusDocDesc(''); setCompletionResult('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error('Xəta: ' + (err?.message || 'Status dəyişdirilə bilmədi'));
    } finally {
      setSavingStatus(false);
    }
  };

  // ── Tarixçə tabı: bütün loqlanmış hərəkətlər (status, təhkim, sənəd, redaktə,
  // arxivləşdirmə, şərh) saniyəyə qədər dəqiq vaxt möhürü ilə göstərilir.
  var statusHistory = approvals
    .slice()
    .sort(function(a: any, b: any) { return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); });

  var HISTORY_TYPE_META: any = {
    created:          { label: 'Tapşırıq yaradıldı',  icon: 'plus',    border: 'border-l-blue-500',   badge: 'bg-blue-100 text-blue-700' },
    status_change:    { label: 'Status dəyişikliyi',   icon: 'activity',border: 'border-l-green-500',  badge: 'bg-green-100 text-green-700' },
    reassigned:       { label: 'Təhkimat dəyişikliyi', icon: 'user',    border: 'border-l-indigo-500',  badge: 'bg-indigo-100 text-indigo-700' },
    document_added:   { label: 'Sənəd əlavə edildi',   icon: 'file',    border: 'border-l-violet-500',  badge: 'bg-violet-100 text-violet-700' },
    document_removed: { label: 'Sənəd silindi',        icon: 'file',    border: 'border-l-red-400',     badge: 'bg-red-100 text-red-700' },
    edited:           { label: 'Redaktə edildi',       icon: 'edit',    border: 'border-l-amber-400',   badge: 'bg-amber-100 text-amber-700' },
    archived:         { label: 'Arxiv əməliyyatı',     icon: 'archive', border: 'border-l-slate-400',   badge: 'bg-slate-100 text-slate-700' },
    comment_added:    { label: 'Şərh əlavə edildi',    icon: 'message', border: 'border-l-cyan-400',    badge: 'bg-cyan-100 text-cyan-700' },
  };

  // All docs that have status_change marker (from task doc_checklist)
  var statusRelatedDocs = documents.filter(function(d: any) { return d.status_change || d.is_later_addition; });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" data-modal="task-detail" onBack={onBack} backLabel="Siyahıya qayıt">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg">{title}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getStatusColor(status)}>{getStatusLabel(status)}</Badge>
                <Badge variant="outline" className={'text-xs ' + (priority === 'high' ? 'border-red-300 text-red-700' : priority === 'medium' ? 'border-yellow-300 text-yellow-700' : 'border-green-300 text-green-700')}>
                  {priority === 'high' ? 'Yüksək' : priority === 'medium' ? 'Orta' : 'Aşağı'}
                </Badge>
                {category && <Badge variant="outline" className="text-xs">{category}</Badge>}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              {onChat && (
                <Button variant="outline" size="sm" onClick={function() { onOpenChange(false); if (onChat) onChat(task); }}>
                  <MessageSquare className="h-4 w-4 mr-1" />Chat
                </Button>
              )}
              {/* Manager: inline status change button */}
              {isManager && !t.is_archived && !t.isArchived && (
                <Button size="sm" variant={showStatusPanel ? 'default' : 'outline'}
                  className={showStatusPanel ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
                  onClick={function() { setShowStatusPanel(function(s) { return !s; }); }}>
                  <Activity className="h-4 w-4 mr-1" />
                  {showStatusPanel ? 'Bağla' : 'Status dəyiş'}
                </Button>
              )}
              {/* Lawyer: delegate to parent */}
              {isLawyer && onStatusChange && (
                <Button size="sm" onClick={function() { onOpenChange(false); if (onStatusChange) onStatusChange(task); }}>
                  <Activity className="h-4 w-4 mr-1" />Status dəyiş
                </Button>
              )}
              {canEdit && !t.is_archived && !t.isArchived && (
                <Button variant="outline" size="sm" type="button"
                  className="text-amber-700 border-amber-300 hover:bg-amber-50"
                  onClick={async function() {
                    if (!confirm('Bu tapşırığı arxivləşdirmək istədiyinizə əminsiniz?')) return;
                    try {
                      await fetchApi('/tasks/' + tId + '/archive', { method: 'PUT', body: JSON.stringify({ is_archived: true }) });
                      toast.success('Tapşırıq arxivə göndərildi');
                      onOpenChange(false);
                      if (onRefresh) onRefresh();
                    } catch { toast.error('Arxivləşdirmə xətası'); }
                  }}>
                  <Archive className="h-4 w-4 mr-1" />Arxivləşdir
                </Button>
              )}
            </div>
          </div>
          <DialogDescription className="sr-only">Tapşırıq detalları</DialogDescription>
        </DialogHeader>

        {/* ── Inline Status Change Panel (manager only) ── */}
        {isManager && showStatusPanel && (
          <div className="mx-0 border border-indigo-200 rounded-xl bg-indigo-50/50 p-4 space-y-3 shrink-0">
            <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />Menecer: Birbaşa status dəyişikliyi
            </p>

            {/* Statuslar — hamısı konfiqurasiya kitabxanasından */}
            {libraryStatuses.length === 0 ? (
              <p className="text-xs text-slate-500 py-2 text-center bg-white rounded-lg border border-slate-200">
                Kitabxanada status tapılmadı. Konfiqurasiya kitabxanasında status əlavə edin.
              </p>
            ) : (
              <div className="space-y-1.5">
                {libraryStatuses.map(function(s: any) {
                  var sKey = s.code || s.name;
                  var isSel = selectedStatus === sKey;
                  var kids = s.children || [];
                  var hasKids = kids.length > 0;
                  return (
                    <div key={s.id} className={'rounded-lg border transition-all ' + (isSel ? 'border-indigo-500 bg-white' : 'border-slate-200 bg-white')}>
                      {/* Əsas status — basanda birbaşa seçilir */}
                      <button type="button"
                        onClick={function() { setSelectedStatus(sKey); setCompletionResult(''); }}
                        className={'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ' +
                          (isSel ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-50')}
                      >
                        <span className="flex items-center gap-2">
                          <CheckCircle className="h-3.5 w-3.5 shrink-0" />{s.name}
                        </span>
                        {hasKids && (
                          <span className={'text-[9px] px-1.5 py-0.5 rounded-full ' + (isSel ? 'bg-white/20' : 'bg-slate-100 text-slate-500')}>
                            {kids.length} alt-status
                          </span>
                        )}
                      </button>

                      {/* Alt-statuslar — əsas status seçiləndə açılır */}
                      {hasKids && isSel && (
                        <div className="px-3 pb-2 ml-4 space-y-1 border-l-2 border-indigo-200 pl-2">
                          <p className="text-[10px] text-slate-400 pt-1">Alt-status (ixtiyari):</p>
                          {kids.map(function(child: any) {
                            var cKey = child.code || child.name;
                            var isC = selectedStatus === cKey;
                            return (
                              <button type="button" key={child.id}
                                onClick={function() { setSelectedStatus(cKey); setCompletionResult(''); }}
                                className={'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs border transition-all ' +
                                  (isC ? 'bg-indigo-100 border-indigo-300 text-indigo-800' : 'bg-slate-50 text-slate-600 border-transparent hover:border-slate-200')}
                              >
                                <div className={'w-2.5 h-2.5 rounded-full border-2 shrink-0 ' + (isC ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300')} />
                                {child.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Note */}
            <div>
              <Label className="text-[10px] text-slate-500">Qeyd (ixtiyari)</Label>
              <textarea
                className="w-full border rounded-lg p-2 text-xs min-h-[36px] mt-0.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={statusNote}
                onChange={function(e) { setStatusNote(e.target.value); }}
                placeholder="Status dəyişikliyi ilə bağlı qeyd..."
              />
            </div>

            {/* Document upload with status change */}
            <div className="bg-white border border-dashed border-indigo-300 rounded-lg p-3 space-y-2">
              <Label className="text-[10px] text-indigo-600 font-medium flex items-center gap-1">
                <Upload className="h-3 w-3" />Sənəd əlavə et (status dəyişikliyi ilə birlikdə)
              </Label>
              <Input
                type="file"
                className="text-xs h-8 cursor-pointer"
                onChange={function(e) { setStatusDocFile(e.target.files ? e.target.files[0] : null); }}
              />
              {statusDocFile && (
                <Input
                  className="h-7 text-xs"
                  placeholder="Sənədin mahiyyəti"
                  value={statusDocDesc}
                  onChange={function(e) { setStatusDocDesc(e.target.value); }}
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                onClick={function() { setShowStatusPanel(false); setSelectedStatus(''); setStatusNote(''); setStatusDocFile(null); }}>
                Ləğv et
              </Button>
              <Button type="button" size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
                disabled={!selectedStatus || savingStatus}
                onClick={handleManagerStatusChange}>
                {savingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                Tətbiq et
              </Button>
            </div>
          </div>
        )}

        {/* ── TABS ── */}
        <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden min-h-0">
          <TabsList className="grid w-full grid-cols-4 shrink-0">
            <TabsTrigger value="general">Ümumi</TabsTrigger>
            <TabsTrigger value="documents">Sənədlər ({documents.length})</TabsTrigger>
            <TabsTrigger value="history" onClick={fetchApprovals}>
              Tarixçə
            </TabsTrigger>
            <TabsTrigger value="amounts">Müddət & Məbləğ</TabsTrigger>
          </TabsList>

          {/* TAB 1: Ümumi */}
          <TabsContent value="general" className="flex-1 overflow-y-auto mt-3 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-4 pr-1">
                <Card className="border-2 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold flex items-center gap-2"><Briefcase className="h-4 w-4" />İşin predmeti</Label>
                      {canEdit && editingField !== 'subject' && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={function() { setEditingField('subject'); setEditValue(subject); }}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    {editingField === 'subject' ? (
                      <div className="space-y-2">
                        <textarea className="w-full border rounded-lg p-2 text-sm min-h-[60px] resize-none" value={editValue} onChange={function(e) { setEditValue(e.target.value); }} />
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={function() { setEditingField(null); }}><X className="h-3 w-3 mr-1" />Ləğv</Button>
                          <Button size="sm" disabled={savingField} onClick={saveField}><Save className="h-3 w-3 mr-1" />{savingField ? '...' : 'Saxla'}</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm">{subject || <span className="text-muted-foreground italic">Hələ qeyd edilməyib</span>}</p>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-3">
                  <Card><CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">Müştərimiz</p>
                    <p className="text-sm font-medium">{clientName || '-'}</p>
                    {clientRole && <Badge variant="outline" className="text-[10px] mt-1">{clientRole}</Badge>}
                  </CardContent></Card>
                  <Card><CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">Qarşı tərəf</p>
                    <p className="text-sm font-medium">{oppositePartyName || respondentName || '-'}</p>
                    {oppositeRole && <Badge variant="outline" className="text-[10px] mt-1">{oppositeRole}</Badge>}
                  </CardContent></Card>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {contractName && <InfoBox label="Müqavilə" value={contractName} icon={FileText} />}
                  {lawyerName && <InfoBox label="Vəkil" value={lawyerName} icon={User} />}
                  {createdAt && <InfoBox label="Yaradılma tarixi" value={fmtDate(createdAt)} icon={Calendar} />}
                  {completedAt && <InfoBox label="Tamamlanma" value={fmtDate(completedAt)} icon={CheckCircle} />}
                </div>

                {description && typeof description === 'string' && !description.startsWith('{') && (
                  <Card><CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">Qeydlər</p>
                    <p className="text-sm whitespace-pre-wrap">{description}</p>
                  </CardContent></Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* TAB 2: Sənədlər */}
          <TabsContent value="documents" className="flex-1 overflow-y-auto mt-3 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-3 pr-1">
                {documents.length === 0 && !canEdit && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Sənəd yoxdur</p>
                  </div>
                )}
                {documents.map(function(doc: any, idx: number) {
                  var uploader = doc.uploaded_by === 'client' ? 'Müştəri' : doc.uploaded_by === 'manager' ? 'Menecer' : doc.uploaded_by === 'lawyer' ? 'Vəkil' : 'Naməlum';
                  var isStatusDoc = !!doc.status_change;
                  var isLater = doc.is_later_addition;
                  return (
                    <Card key={idx} className={isStatusDoc ? 'border-indigo-200 bg-indigo-50/30' : isLater ? 'border-amber-200 bg-amber-50/30' : ''}>
                      <CardContent className="p-3 flex items-start gap-3">
                        <FileText className={'h-5 w-5 shrink-0 mt-0.5 ' + (isStatusDoc ? 'text-indigo-600' : isLater ? 'text-amber-600' : 'text-blue-600')} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.name || doc.file_name || 'Sənəd ' + (idx + 1)}</p>
                          {doc.description && <p className="text-xs text-muted-foreground">{doc.description}</p>}
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><User className="h-3 w-3" />{uploader}</span>
                            {doc.uploaded_at && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDT(doc.uploaded_at)}</span>}
                            {doc.file_size && <span>{(doc.file_size / 1024).toFixed(0)} KB</span>}
                            {isStatusDoc && (
                              <Badge variant="outline" className="text-[8px] h-4 border-indigo-300 text-indigo-700">
                                Status: {getStatusLabel(doc.status_change)}
                              </Badge>
                            )}
                            {isLater && !isStatusDoc && <Badge variant="outline" className="text-[8px] h-4 border-amber-300 text-amber-700">Sonradan əlavə</Badge>}
                          </div>
                        </div>
                        {(doc.file_data || doc.url) && (
                          <button type="button" className="shrink-0 p-1 hover:bg-blue-50 rounded transition-colors" onClick={function() { setViewerDoc(doc); }} title="Bax">
                            <Eye className="h-4 w-4 text-blue-600" />
                          </button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {canEdit && (
                  <Card className="border-dashed">
                    <CardContent className="p-3 space-y-3">
                      <Label className="text-xs font-semibold flex items-center gap-1"><Upload className="h-3.5 w-3.5" />Sənəd əlavə et</Label>

                      {/* 1. Sənəd növü seçimi (library) */}
                      <div>
                        <Label className="text-[10px] text-muted-foreground mb-1 block">Sənəd növü</Label>
                        {docCategories.length > 0 ? (
                          <Select value={newDocCategory} onValueChange={setNewDocCategory}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sənəd növü seçin..." /></SelectTrigger>
                            <SelectContent>
                              {docCategories.map(function(cat: any) {
                                return <SelectItem key={cat.id} value={String(cat.id)} className="text-sm">{cat.name}</SelectItem>;
                              })}
                              <SelectItem value="diger" className="text-sm">Digər</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Sənəd növü yüklənir...</p>
                        )}
                      </div>

                      {/* 2. "Digər" seçiləndə ad daxil et */}
                      {newDocCategory === 'diger' && (
                        <div>
                          <Label className="text-[10px] text-muted-foreground mb-1 block">Sənədin adı</Label>
                          <Input
                            className="h-8 text-sm"
                            placeholder="Sənədin adını yazın..."
                            value={newDocCustomName}
                            onChange={function(e) { setNewDocCustomName(e.target.value); }}
                          />
                        </div>
                      )}

                      {/* 3. Fayl seç — bir neçə fayl eyni anda seçilə bilər */}
                      <div>
                        <Label className="text-[10px] text-muted-foreground mb-1 block">Fayl(lar)</Label>
                        <Input type="file" multiple className="text-sm cursor-pointer" onChange={function(e) { setNewDocFiles(e.target.files ? Array.from(e.target.files) : []); }} />
                        {newDocFiles.length > 1 && (
                          <p className="text-[10px] text-muted-foreground mt-1">{newDocFiles.length} fayl seçildi — hamısı eyni növ üçün əlavə olunacaq</p>
                        )}
                      </div>

                      {newDocFiles.length > 0 && (newDocCategory !== '' && (newDocCategory !== 'diger' || newDocCustomName.trim())) && (
                        <Button size="sm" className="w-full" disabled={addingDoc} onClick={handleAddDoc}>
                          {addingDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}Əlavə et
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* TAB 3: Tarixçə — status dəyişiklikləri + sənədlər */}
          <TabsContent value="history" className="flex-1 overflow-y-auto mt-3 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-3 pr-1">
                {approvalsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                  </div>
                ) : statusHistory.length === 0 && statusRelatedDocs.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <History className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Status dəyişikliyi tarixçəsi yoxdur</p>
                  </div>
                ) : (
                  <>
                    {/* Bütün tarixçə hərəkətləri */}
                    {statusHistory.map(function(a: any, idx: number) {
                      var attachments: any[] = parseJSON(a.attachments);
                      var isCreated = a.approval_type === 'created';
                      var meta = HISTORY_TYPE_META[a.approval_type] || { label: a.approval_type || 'Hərəkət', border: 'border-l-slate-300', badge: 'bg-slate-100 text-slate-700' };
                      var isApproved = a.status === 'approved';
                      var isPending  = a.status === 'pending';
                      var isRejected = a.status === 'rejected';
                      var statusBadge = isCreated ? 'bg-blue-100 text-blue-700' : isApproved ? 'bg-green-100 text-green-700' : isPending ? 'bg-amber-100 text-amber-700' : isRejected ? 'bg-red-100 text-red-700' : meta.badge;
                      var statusText  = isCreated ? 'Yaradıldı' : isApproved ? 'Təsdiqləndi' : isPending ? 'Gözləyir' : isRejected ? 'Rədd edildi' : (a.status === 'logged' ? 'Qeydə alındı' : a.status);
                      return (
                        <div key={a.id || idx} className={'border-l-4 ' + meta.border + ' bg-white rounded-r-xl p-3 shadow-sm space-y-2'}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <Activity className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                <span className="text-xs font-semibold text-slate-800">{meta.label}</span>
                                <span className={'text-[10px] px-1.5 py-0.5 rounded-full font-medium ' + statusBadge}>{statusText}</span>
                              </div>
                              {(a.previous_status || a.new_status) && (
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-600 ml-5">
                                  {a.previous_status && <span className="line-through text-slate-400">{getStatusLabel(a.previous_status)}</span>}
                                  {a.previous_status && a.new_status && <ChevronRight className="h-3 w-3 text-slate-400" />}
                                  {a.new_status && <span className="font-medium text-indigo-700">{getStatusLabel(a.new_status)}</span>}
                                </div>
                              )}
                              {a.reason && <p className="text-[10px] text-slate-500 ml-5 italic">"{a.reason}"</p>}
                              {a.requester_name && <p className="text-[10px] text-slate-400 ml-5">Tərəf: {a.requester_name}</p>}
                            </div>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">{fmtDT(a.created_at)}</span>
                          </div>

                          {/* Attached docs from this approval */}
                          {attachments.length > 0 && (
                            <div className="ml-5 space-y-1.5 border-t border-slate-100 pt-2">
                              <p className="text-[10px] text-slate-400 font-medium">Bu dəyişikliklə əlavə edilmiş sənədlər:</p>
                              {attachments.map(function(att: any, ai: number) {
                                return (
                                  <div key={ai} className="flex items-center gap-2 p-2 bg-indigo-50 rounded-lg">
                                    <FileText className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                    <span className="text-[11px] font-medium text-indigo-800 flex-1 truncate">{att.name || att.description || 'Sənəd'}</span>
                                    {att.description && att.description !== att.name && (
                                      <span className="text-[10px] text-slate-500">{att.description}</span>
                                    )}
                                    {(att.file_data || att.url) && (
                                      <button type="button" className="shrink-0 p-1 hover:bg-indigo-100 rounded transition-colors" onClick={function() { setViewerDoc(att); }} title="Bax">
                                        <Eye className="h-3.5 w-3.5 text-indigo-600" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Status-related docs from task checklist (lawyer uploads) */}
                    {statusRelatedDocs.filter(function(d: any) { return d.status_change; }).length > 0 && (
                      <div className="border-l-4 border-l-violet-400 bg-white rounded-r-xl p-3 shadow-sm space-y-1.5">
                        <p className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-violet-600" />Status ilə əlavə edilmiş sənədlər
                        </p>
                        {statusRelatedDocs.filter(function(d: any) { return d.status_change; }).map(function(doc: any, i: number) {
                          return (
                            <div key={i} className="flex items-center gap-2 p-2 bg-violet-50 rounded-lg">
                              <FileText className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-medium text-violet-800 truncate">{doc.name}</p>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                  {doc.uploaded_at && <span>{fmtDT(doc.uploaded_at)}</span>}
                                  <Badge variant="outline" className="text-[8px] h-3.5 border-violet-300 text-violet-700">
                                    {getStatusLabel(doc.status_change)}
                                  </Badge>
                                </div>
                              </div>
                              {(doc.file_data || doc.url) && (
                                <button type="button" className="shrink-0 p-1 hover:bg-violet-100 rounded transition-colors" onClick={function() { setViewerDoc(doc); }} title="Bax">
                                  <Eye className="h-3.5 w-3.5 text-violet-600" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* TAB 4: Müddətlər & Məbləğlər */}
          <TabsContent value="amounts" className="flex-1 overflow-y-auto mt-3 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-4 pr-1">
                <Card><CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" />Müddətlər</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-[10px] text-muted-foreground">Müştəri deadline-ı</p>
                      <p className="text-sm font-medium">{fmtDate(clientDeadline)}</p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground">İddia müddətinin sonu</p>
                        {canEdit && editingField !== 'claim_deadline' && (
                          <button type="button" className="text-amber-600" onClick={function() { setEditingField('claim_deadline'); setEditValue(claimDeadline); }}>
                            <Edit3 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      {editingField === 'claim_deadline' ? (
                        <div className="flex gap-1 mt-1">
                          <Input className="h-7 text-sm flex-1" value={editValue} onChange={function(e) { setEditValue(e.target.value); }} placeholder="gg.aa.iiii" />
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 px-2"><Calendar className="h-3 w-3" /></Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <CalendarComponent
                                mode="single"
                                selected={(function() {
                                  var v = editValue || '';
                                  var parts = v.split('.');
                                  if (parts.length === 3) {
                                    var d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                                    if (!isNaN(d.getTime())) return d;
                                  }
                                  var iso = new Date(v);
                                  return isNaN(iso.getTime()) ? undefined : iso;
                                })()}
                                onSelect={function(d: any) {
                                  if (!d) return;
                                  var txt = d.getDate().toString().padStart(2, '0') + '.' + (d.getMonth() + 1).toString().padStart(2, '0') + '.' + d.getFullYear();
                                  setEditValue(txt);
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <Button size="sm" className="h-7 px-2" onClick={saveField}><Save className="h-3 w-3" /></Button>
                          <Button variant="outline" size="sm" className="h-7 px-2" onClick={function() { setEditingField(null); }}><X className="h-3 w-3" /></Button>
                        </div>
                      ) : (
                        <p className="text-sm font-medium">{fmtDate(claimDeadline)}</p>
                      )}
                    </div>
                  </div>
                </CardContent></Card>

                <Card><CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4" />Məbləğlər</h3>
                  {claimAmounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Məbləğ qeyd edilməyib</p>
                  ) : (
                    <div className="space-y-1.5">
                      {claimAmounts.map(function(c: any, idx: number) {
                        return (
                          <div key={idx} className="flex justify-between items-center p-2 bg-muted/20 rounded">
                            <span className="text-sm">{c.label || c.type || 'Məbləğ ' + (idx + 1)}</span>
                            <span className="text-sm font-semibold text-amber-700">₼{Number(c.amount || 0).toLocaleString()}</span>
                          </div>
                        );
                      })}
                      <Separator />
                      <div className="flex justify-between items-center p-2">
                        <span className="text-sm font-semibold">Ümumi</span>
                        <span className="text-base font-bold text-amber-700">₼{totalClaim.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </CardContent></Card>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>

      <FileViewerModal doc={viewerDoc} open={!!viewerDoc} onClose={function() { setViewerDoc(null); }} />
    </Dialog>
  );
}

function InfoBox({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="p-3 bg-muted/20 rounded-lg flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}