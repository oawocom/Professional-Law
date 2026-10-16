import { fetchApi, getApiBase, getLawToken, uploadFile } from '../../utils/apiHelper';
import { useState, useMemo } from 'react';
import { getStatusLabel, getStatusColor, getStatusGroup, STATUS_GROUPS } from '../../utils/taskStatusConstants';
import { formatDate as sharedFormatDate, formatDateTime as sharedFormatDateTime } from '../../utils/dateFormat';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  FileText, 
  User, 
  Calendar,
  MessageSquare,
  Send,
  UserCheck,
  Users,
  MessageCircle,
  ArrowRight,
  ArrowLeft,
  Edit,
  RefreshCw,
  Download,
  FileIcon,
  Eye,
  Inbox,
  DollarSign,
  X
} from 'lucide-react';
import { Separator } from '../ui/separator';
import { toast } from 'sonner';
import { ClientSubmittedDataModal } from './ClientSubmittedDataModal';



interface ApprovalRequest {
  id: string;
  type: string;
  clientName?: string;
  clientId?: string;
  lawyerName?: string;
  lawyerId?: string;
  taskTitle?: string;
  title?: string;
  description?: string;
  requestedAt?: string;
  urgency?: 'high' | 'medium' | 'low';
  priority?: string;
  details?: any;
  status: 'pending' | 'approved' | 'rejected';
  // Note approval fields
  from?: string;
  fromRole?: string;
  to?: string;
  toRole?: string;
  direction?: string;
  message?: string;
  // Status change fields
  previousStatus?: string;
  newStatus?: string;
  statusNote?: string;
  attachedDocuments?: any[];
  changedAt?: string;
  // Task fields
  deadline?: string;
  createdAt?: string;
  client?: string;
  lawyer?: string;
}

interface ApprovalManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approvalRequests: ApprovalRequest[];
  lawyers?: any[];
  tasks?: any[];
  clients?: any[];
  taskTypes?: any[];
  onRefresh?: () => void;
  tenantId?: number | null;
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="text-center py-16 space-y-3">
      <Icon className="h-12 w-12 text-muted-foreground mx-auto opacity-40" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

export function ApprovalManagementModal({ 
  open, 
  onOpenChange, 
  approvalRequests,
  lawyers: propLawyers,
  tasks: propTasks,
  onRefresh,
  tenantId
}: ApprovalManagementModalProps) {
  var [selectedItem, setSelectedItem] = useState<any>(null);
  var [previewDoc, setPreviewDoc] = useState<any>(null);
  var [responseMessage, setResponseMessage] = useState('');
  var [activeTab, setActiveTab] = useState('new-tasks');
  var [notesDirection, setNotesDirection] = useState('all');
  var [actionInProgress, setActionInProgress] = useState<{type: string, task: any} | null>(null);
  var [actionReason, setActionReason] = useState('');
  var [selectedLawyer, setSelectedLawyer] = useState('');
  var [clientDataModalOpen, setClientDataModalOpen] = useState(false);
  var [selectedTaskForData, setSelectedTaskForData] = useState<any>(null);
  var [claimDeadline, setClaimDeadline] = useState<Date | undefined>();
  var [claimDeadlineText, setClaimDeadlineText] = useState('');
  // Claim amounts
  var [claimAmounts, setClaimAmounts] = useState<{type: string; label: string; amount: number}[]>([
    { type: 'principal', label: 'Əsas borc', amount: 0 }
  ]);
  // Party roles
  var [clientSubjectType, setClientSubjectType] = useState('iddiaçı');
  var [clientSubjectCustom, setClientSubjectCustom] = useState('');
  var [oppositePartyType, setOppositePartyType] = useState('cavabdeh');
  var [oppositePartyCustom, setOppositePartyCustom] = useState('');
  var [oppositePartyName, setOppositePartyName] = useState('');
  // Documents
  var [uploadedDocs, setUploadedDocs] = useState<{file: File; name: string; id: number}[]>([]);

  var lawyers = propLawyers || [];

  // Real tasks with status "new" — these are tasks created by clients awaiting manager review
  var newTasksFromDB = useMemo(function() {
    return (propTasks || []).filter(function(t: any) {
      var status = t.status || t.Status || '';
      return status === 'new' || status === 'pending';
    });
  }, [propTasks]);

  // Categorize approvals by type
  var categorized = useMemo(function() {
    var newTasks: any[] = [];
    var notes: any[] = [];
    var statusChanges: any[] = [];

    (approvalRequests || []).forEach(function(req) {
      // API returns approval_type, not type
      var type = req.type || req.approval_type || req.approvalType || '';
      if (type === 'note_approval' || type === 'note') {
        notes.push(req);
      } else if (type === 'status_change' || type === 'status') {
        statusChanges.push(req);
      } else {
        newTasks.push(req);
      }
    });

    return { newTasks: newTasks, notes: notes, statusChanges: statusChanges };
  }, [approvalRequests]);

  // Filter notes by direction
  var filteredNotes = categorized.notes.filter(function(note) {
    if (notesDirection === 'all') return true;
    return note.direction === notesDirection;
  });

  var handleApprovalAction = async function(item: any, action: 'approve' | 'reject') {
    try {
      await fetchApi('/approvals/' + item.id, {
        method: 'PUT',
        body: JSON.stringify({
          status: action === 'approve' ? 'approved' : 'rejected',
          decision: responseMessage || undefined
        })
      });

      var actionText = action === 'approve' ? 'təsdiqləndi' : 'rədd edildi';
      if (item.type === 'note_approval' || item.type === 'note') {
        toast.success('Qeyd ' + actionText);
      } else {
        toast.success('"' + (item.taskTitle || item.title || '') + '" ' + actionText);
      }

      setResponseMessage('');
      setSelectedItem(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Approval action error:', err);
      // Server sorğusu uğursuz oldusa istifadəçiyə HƏQİQƏTƏN nə baş verdiyini
      // bildiririk — əvvəllər burada "uğurlu" toast göstərilirdi, halbuki
      // təsdiq/rədd əməliyyatı əslində icra olunmamışdı (verilənlər bazasında
      // status "pending" olaraq qalırdı, amma menecer əməliyyatın uğurlu
      // olduğunu düşünürdü).
      var msg = err instanceof Error ? err.message : 'Naməlum xəta';
      toast.error('Əməliyyat uğursuz oldu: ' + msg);
    }
  };

  var handleTaskAction = function(task: any, action: string) {
    if (action === 'approve' || action === 'assign-lawyer') {
      setActionInProgress({ type: 'assign-lawyer', task: task });
      setSelectedLawyer('');
    } else {
      setActionInProgress({ type: action, task: task });
      setActionReason('');
    }
  };

  var handleStatusAction = function(statusChange: any, action: 'approve' | 'reject') {
    if (action === 'approve') {
      // Parse requested data
      var reqData = statusChange.requestedData || statusChange.requested_data;
      var parsed = typeof reqData === 'string' ? JSON.parse(reqData || '{}') : (reqData || {});
      var newStatus = parsed.new_status || statusChange.new_status || statusChange.newStatus;
      var taskId = statusChange.entityId || statusChange.entity_id || statusChange.task_id || statusChange.taskId;

      // 1. Approve the approval record
      handleApprovalAction(statusChange, 'approve');

      // 2. Update the actual task status
      if (newStatus && taskId) {
        fetchApi('/tasks/' + taskId, {
          method: 'PUT',
          body: JSON.stringify({
            status: newStatus,
            current_step: parsed.step_index || 0,
          })
        }).then(function() {
          toast.success('Tapşırıq statusu "' + getStatusLabel(newStatus) + '" olaraq dəyişdirildi');
        }).catch(function(e) { console.error('Task status update:', e); });
      }
    } else {
      setActionInProgress({ type: 'reject-status', task: statusChange });
      setActionReason('');
    }
  };

  var handleSubmitAction = async function() {
    if (!actionInProgress) return;

    var { type, task } = actionInProgress;
    var taskId = task.id || task.ID;

    try {
      if (type === 'reject' || type === 'return') {
        // For real DB tasks: update status to rejected
        if (taskId) {
          await fetchApi('/tasks/' + taskId, {
            method: 'PUT',
            body: JSON.stringify({
              status: 'rejected',
              rejection_reason: actionReason || undefined
            })
          });
          toast.success('"' + (task.title || task.taskTitle || '') + '" tapshiriqi redd edildi');
        }
        // For approval records
        if (task.approval_id || task.approvalId) {
          await fetchApi('/approvals/' + (task.approval_id || task.approvalId), {
            method: 'PUT',
            body: JSON.stringify({
              status: 'rejected',
              decision: actionReason || undefined
            })
          }).catch(function() {});
        }
      } else if (type === 'assign-lawyer') {
        var lawyer = lawyers.find(function(l) { return String(l.id) === selectedLawyer; });
        if (lawyer && taskId) {
          // Fayllari file storage-a yukle (base64 evezine URL saxlanilir)
          var encodedDocs: any[] = [];
          for (var i = 0; i < uploadedDocs.length; i++) {
            var doc = uploadedDocs[i];
            try {
              var up = await uploadFile(doc.file, doc.name);
              encodedDocs.push({ name: doc.name, url: up.url, file_type: doc.file.type, file_size: doc.file.size });
            } catch(e) { console.error('File upload error:', e); }
          }

          // Build claim amounts
          var validClaims = claimAmounts.filter(function(c) { return c.amount > 0 && c.label.trim(); });
          var totalClaimAmount = validClaims.reduce(function(s, c) { return s + c.amount; }, 0);

          // UPDATE existing task
          await fetchApi('/tasks/' + taskId, {
            method: 'PUT',
            body: JSON.stringify({
              assigned_to: Number(selectedLawyer),
              status: 'tehkim_olundu',
              claim_deadline: claimDeadline ? claimDeadline.toISOString() : undefined,
              claim_amounts: validClaims.length > 0 ? JSON.stringify(validClaims) : undefined,
              total_claim: totalClaimAmount > 0 ? totalClaimAmount : undefined,
              notes: JSON.stringify({
                client_subject: clientSubjectType === 'digər' ? clientSubjectCustom : clientSubjectType,
                opposite_party: oppositePartyType === 'digər' ? oppositePartyCustom : oppositePartyType,
                opposite_party_name: oppositePartyName,
                manager_documents: encodedDocs,
              }),
            })
          });
          toast.success('"' + (task.title || task.taskTitle || '') + '" tapşırığı ' + (lawyer.name || '') + ' vəkilinə təhkim edildi');
          if (claimDeadline) {
            var formattedDate = sharedFormatDate(claimDeadline);
            toast.info('Iddia muddetinin son gunu: ' + formattedDate);
          }
        } else if (!taskId) {
          toast.error('Tapshiriq ID tapilmadi');
        } else {
          toast.error('Vekil secilmeyib');
        }
      } else if (type === 'reject-status') {
        // Status change rejection via approvals
        if (task.id) {
          await fetchApi('/approvals/' + task.id, {
            method: 'PUT',
            body: JSON.stringify({
              status: 'rejected',
              decision: actionReason || undefined
            })
          });
          toast.success('"' + (task.taskTitle || task.title || '') + '" status deyishikliyi redd edildi');
        }
      }
    } catch (err) {
      console.error('Submit action error:', err);
      toast.error('Emeliyyat zamani xeta bash verdi');
    }

    setActionInProgress(null);
    setActionReason('');
    setSelectedLawyer('');
    setClaimDeadline(undefined);
    setClaimDeadlineText('');
    if (onRefresh) onRefresh();
  };

  var getUrgencyColor = function(urgency: string) {
    switch (urgency) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  var getDirectionIcon = function(direction: string) {
    switch (direction) {
      case 'lawyer-to-client': return <ArrowRight className="h-3 w-3 text-green-600" />;
      case 'client-to-lawyer': return <ArrowLeft className="h-3 w-3 text-blue-600" />;
      default: return null;
    }
  };

  var getDirectionText = function(direction: string) {
    switch (direction) {
      case 'lawyer-to-client': return 'Vəkildən Müştəriyə';
      case 'client-to-lawyer': return 'Müştəridən Vəkilə';
      default: return 'Naməlum istiqamət';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] flex flex-col overflow-hidden" data-modal="approval-management">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Təsdiq Tələbləri İdarəetməsi
          </DialogTitle>
          <DialogDescription>
            Tapşırıqları, qeydləri və status dəyişikliklərini nəzərdən keçirin
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="new-tasks" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Yeni Tapşırıqlar ({newTasksFromDB.length})
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Qeydlər ({filteredNotes.length})
            </TabsTrigger>
            <TabsTrigger value="status-changes" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Status ({categorized.statusChanges.filter(function(c) { return c.status === 'pending'; }).length})
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden mt-6">
            {/* Yeni tapşırıqlar Tab - shows tasks with status "new" from DB */}
            <TabsContent value="new-tasks" className="h-full mt-0">
              <div className="space-y-4 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Yeni Yaradılan Tapşırıqlar</h3>
                  <p className="text-sm text-muted-foreground">Müştərilər tərəfindən yaradılmış, vəkil gözləyən tapşırıqlar</p>
                </div>
                
                <ScrollArea className="flex-1 h-[500px]">
                  <div className="space-y-4 pr-4">
                    {newTasksFromDB.length === 0 ? (
                      <EmptyState icon={Inbox} message="Gözləyən yeni tapşırıq yoxdur" />
                    ) : (
                      newTasksFromDB.map(function(task: any) {
                        var taskId = task.id || task.ID;
                        var title = task.title || task.Title || 'Adsız tapşırıq';
                        var description = task.description || task.Description || '';
                        var priority = task.priority || task.Priority || 'normal';
                        var deadline = task.deadline || task.Deadline;
                        var category = task.category || task.Category || '';
                        var clientName = task.client?.name || task.client_name || task.clientName || '';
                        var contractTitle = task.contract?.title || task.contract_title || task.contractTitle || '';
                        var createdAt = task.created_at || task.createdAt || task.CreatedAt;
                        var respondentName = task.respondent_name || task.respondentName || '';
                        var totalClaim = task.total_claim || task.totalClaim || task.claim_amount || 0;

                        // Parse claim amounts
                        var claimAmounts: any[] = [];
                        try {
                          var rawClaims = task.claim_amounts || task.claimAmounts;
                          if (typeof rawClaims === 'string') claimAmounts = JSON.parse(rawClaims);
                          else if (Array.isArray(rawClaims)) claimAmounts = rawClaims;
                        } catch(e) {}

                        // Parse document checklist
                        var docChecklist: any[] = [];
                        try {
                          var rawDocs = task.document_checklist || task.documentChecklist;
                          if (typeof rawDocs === 'string') docChecklist = JSON.parse(rawDocs);
                          else if (Array.isArray(rawDocs)) docChecklist = rawDocs;
                        } catch(e) {}

                        var uploadedDocsCount = docChecklist.filter(function(d: any) { return d.uploaded; }).length;

                        return (
                          <Card key={taskId} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                  <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-3">
                                      <h4 className="font-medium">{title}</h4>
                                      <Badge className={
                                        priority === 'high' || priority === 'urgent' ? 'bg-red-100 text-red-800' :
                                        priority === 'normal' || priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-green-100 text-green-800'
                                      }>
                                        {priority === 'high' || priority === 'urgent' ? 'Yüksək' : 
                                         priority === 'normal' || priority === 'medium' ? 'Orta' : 'Aşağı'}
                                      </Badge>
                                      {category && (
                                        <Badge variant="outline" className="text-xs">{category}</Badge>
                                      )}
                                    </div>
                                    {description && (
                                      <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
                                    )}
                                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                      {clientName && (
                                        <span className="flex items-center gap-1">
                                          <User className="h-3 w-3" />Müştəri: {clientName}
                                        </span>
                                      )}
                                      {contractTitle && (
                                        <span className="flex items-center gap-1">
                                          <FileText className="h-3 w-3" />Müqavilə: {contractTitle}
                                        </span>
                                      )}
                                      {respondentName && (
                                        <span className="flex items-center gap-1">
                                          <User className="h-3 w-3" />Cavabdeh: {respondentName}
                                        </span>
                                      )}
                                      {deadline && (
                                        <span className="flex items-center gap-1">
                                          <Calendar className="h-3 w-3" />Son tarix: {new Date(deadline).toLocaleDateString('az-AZ')}
                                        </span>
                                      )}
                                      {createdAt && (
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />Yaradıldı: {new Date(createdAt).toLocaleDateString('az-AZ')}
                                        </span>
                                      )}
                                      {Number(totalClaim) > 0 && (
                                        <span className="flex items-center gap-1 text-amber-600 font-medium">
                                          ₼{Number(totalClaim).toLocaleString()}
                                        </span>
                                      )}
                                    </div>

                                    {/* Claim amounts breakdown */}
                                    {claimAmounts.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 mt-1">
                                        {claimAmounts.filter(function(c: any) { return c.amount > 0; }).map(function(c: any, i: number) {
                                          return (
                                            <Badge key={i} variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                                              {c.label || c.type}: ₼{Number(c.amount).toLocaleString()}
                                            </Badge>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Document checklist */}
                                    {docChecklist.length > 0 && (
                                      <div className="mt-2 p-2 bg-slate-50 rounded-lg border">
                                        <div className="flex items-center gap-2 mb-1.5">
                                          <FileText className="h-3.5 w-3.5 text-blue-600" />
                                          <span className="text-xs font-medium">Sənədlər ({uploadedDocsCount}/{docChecklist.length})</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                          {docChecklist.map(function(doc: any, i: number) {
                                            // BUG DÜZƏLİŞİ (2026-09): bu nişanlar əvvəllər sırf statik idi — heç bir
                                            // klik funksiyası yox idi, halbuki komponentdə artıq tam qurulmuş, amma
                                            // heç yerdən çağırılmayan "Sənəd önizləməsi" dialoqu (`previewDoc`/
                                            // `setPreviewDoc`) mövcud idi. İndi yüklənmiş (url-i olan) sənədlər
                                            // klikləndikdə həmin önizləmə dialoqunu açır.
                                            var clickable = !!(doc.uploaded && doc.url);
                                            return (
                                              <Badge
                                                key={i}
                                                variant="outline"
                                                className={'text-[10px] ' + (doc.uploaded ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200') + (clickable ? ' cursor-pointer hover:opacity-80' : '')}
                                                onClick={clickable ? function() { setPreviewDoc(doc); } : undefined}
                                                title={clickable ? 'Sənədə bax' : undefined}
                                              >
                                                {doc.uploaded ? '✓' : '✗'} {doc.name}
                                              </Badge>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-2 ml-4 shrink-0">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={function() {
                                        setSelectedTaskForData(task);
                                        setClientDataModalOpen(true);
                                      }}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="destructive" 
                                      size="sm" 
                                      onClick={function() { handleTaskAction(task, 'reject'); }}
                                    >
                                      <XCircle className="h-4 w-4 mr-1" />
                                      Rədd Et
                                    </Button>
                                    <Button 
                                      variant="default" 
                                      size="sm" 
                                      className="bg-blue-600 hover:bg-blue-700 text-white"
                                      onClick={function() { handleTaskAction(task, 'assign-lawyer'); }}
                                    >
                                      <UserCheck className="h-4 w-4 mr-1" />
                                      İcraçıya Göndər
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Qeydlər Tab */}
            <TabsContent value="notes" className="h-full mt-0">
              <div className="space-y-4 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Label>İstiqamət:</Label>
                    <Select value={notesDirection} onValueChange={setNotesDirection}>
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Bütün istiqamətlər</SelectItem>
                        <SelectItem value="lawyer-to-client">
                          <div className="flex items-center gap-2">
                            <ArrowRight className="h-3 w-3 text-green-600" />
                            Vəkildən Müştəriyə
                          </div>
                        </SelectItem>
                        <SelectItem value="client-to-lawyer">
                          <div className="flex items-center gap-2">
                            <ArrowLeft className="h-3 w-3 text-blue-600" />
                            Müştəridən Vəkilə
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Badge variant="outline">
                    {filteredNotes.length} qeyd
                  </Badge>
                </div>

                {filteredNotes.length === 0 ? (
                  <EmptyState icon={MessageCircle} message="Gözləyən qeyd təsdiqi yoxdur" />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                    <div>
                      <h3 className="font-medium mb-4">Təsdiq Gözləyən Qeydlər</h3>
                      <ScrollArea className="h-[500px]">
                        <div className="space-y-3 pr-4">
                          {filteredNotes.map(function(note) {
                            return (
                              <Card 
                                key={note.id}
                                className={'cursor-pointer transition-all hover:shadow-md ' +
                                  (selectedItem?.id === note.id ? 'ring-2 ring-primary' : '')}
                                onClick={function() { setSelectedItem(note); }}
                              >
                                <CardContent className="p-4">
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <MessageCircle className="h-4 w-4 text-cyan-600" />
                                        <Badge variant="outline">Qeyd Təsdiqi</Badge>
                                        {note.direction && getDirectionIcon(note.direction)}
                                      </div>
                                      {note.urgency && (
                                        <Badge className={getUrgencyColor(note.urgency)}>
                                          {note.urgency === 'high' ? 'Təcili' :
                                           note.urgency === 'medium' ? 'Orta' : 'Aşağı'}
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 text-xs">
                                        <Avatar className="h-6 w-6">
                                          <AvatarFallback className="text-xs">
                                            {note.from ? note.from.split(' ').map(function(n: string) { return n[0]; }).join('') : '?'}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium">{note.from || 'Naməlum'}</span>
                                        {note.fromRole && <Badge variant="secondary" className="text-xs">{note.fromRole}</Badge>}
                                        {note.direction && getDirectionIcon(note.direction)}
                                        <Avatar className="h-6 w-6">
                                          <AvatarFallback className="text-xs">
                                            {note.to ? note.to.split(' ').map(function(n: string) { return n[0]; }).join('') : '?'}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium">{note.to || 'Naməlum'}</span>
                                        {note.toRole && <Badge variant="secondary" className="text-xs">{note.toRole}</Badge>}
                                      </div>
                                      
                                      <div className="bg-muted/50 p-3 rounded-lg">
                                        <h4 className="text-xs font-medium text-muted-foreground mb-1">{note.taskTitle || note.title || ''}</h4>
                                        <p className="text-sm">{note.message || note.description || ''}</p>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                      <span>{note.direction ? getDirectionText(note.direction) : ''}</span>
                                      <span>{note.requestedAt || ''}</span>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>

                    {/* Note Details */}
                    <div>
                      {selectedItem && (selectedItem.type === 'note_approval' || selectedItem.type === 'note') ? (
                        <div className="space-y-6">
                          <div>
                            <h3 className="font-medium mb-4">Qeyd Detalları</h3>
                            <Card>
                              <CardContent className="p-4 space-y-3">
                                {selectedItem.direction && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">İstiqamət:</span>
                                    <div className="flex items-center gap-2">
                                      {getDirectionIcon(selectedItem.direction)}
                                      <span className="text-sm font-medium">{getDirectionText(selectedItem.direction)}</span>
                                    </div>
                                  </div>
                                )}
                                
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">Göndərən:</span>
                                  <span className="text-sm font-medium">{selectedItem.from || 'Naməlum'} {selectedItem.fromRole ? '(' + selectedItem.fromRole + ')' : ''}</span>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">Alacaq:</span>
                                  <span className="text-sm font-medium">{selectedItem.to || 'Naməlum'} {selectedItem.toRole ? '(' + selectedItem.toRole + ')' : ''}</span>
                                </div>
                                
                                {(selectedItem.taskTitle || selectedItem.title) && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Tapşırıq:</span>
                                    <span className="text-sm">{selectedItem.taskTitle || selectedItem.title}</span>
                                  </div>
                                )}
                                
                                <div>
                                  <span className="text-sm text-muted-foreground">Mesaj məzmunu:</span>
                                  <div className="bg-muted/50 p-3 rounded-lg mt-2">
                                    <p className="text-sm">{selectedItem.message || selectedItem.description || ''}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          <div>
                            <Label htmlFor="response">Manager Qeyd (məcburi deyil)</Label>
                            <Textarea
                              id="response"
                              value={responseMessage}
                              onChange={function(e) { setResponseMessage(e.target.value); }}
                              placeholder="Əlavə qeyd..."
                              className="mt-2"
                              rows={3}
                            />
                          </div>

                          <div className="flex gap-3">
                            <Button
                              variant="outline"
                              onClick={function() { handleApprovalAction(selectedItem, 'reject'); }}
                              className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Rədd et
                            </Button>
                            <Button
                              onClick={function() { handleApprovalAction(selectedItem, 'approve'); }}
                              className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Təsdiq et və Göndər
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground mt-20">
                          <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Qeydi nəzərdən keçirmək üçün seçin</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Status Dəyişiklikləri Tab */}
            <TabsContent value="status-changes" className="h-full mt-0">
              <div className="space-y-4 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Status Dəyişiklikləri</h3>
                  <Badge variant="outline">
                    {categorized.statusChanges.filter(function(c) { return c.status === 'pending'; }).length} gözləyən
                  </Badge>
                </div>
                
                <ScrollArea className="flex-1 h-[500px]">
                  <div className="space-y-4 pr-4">
                    {categorized.statusChanges.filter(function(c) { return c.status === 'pending'; }).length === 0 ? (
                      <EmptyState icon={RefreshCw} message="Gözləyən status dəyişikliyi yoxdur" />
                    ) : (
                      categorized.statusChanges.filter(function(c) { return c.status === 'pending'; }).map(function(change) {
                        var reqData = change.requestedData || change.requested_data;
                        var parsed = typeof reqData === 'string' ? (function() { try { return JSON.parse(reqData); } catch(e) { return {}; } })() : (reqData || {});
                        var prevStatus = change.previousStatus || change.previous_status || parsed.previous_status || '';
                        var newStatus = change.newStatus || change.new_status || parsed.new_status || '';
                        var reason = change.reason || parsed.reason || '';
                        var taskTitle = parsed.task_title || change.taskTitle || change.title || '';
                        var completionType = parsed.completion_type || '';
                        var specialNote = parsed.special_note || '';
                        var requestedAt = change.requestedAt || change.requested_at || change.createdAt || change.created_at || '';

                        return (
                          <Card key={change.id} className="border-l-4 border-l-purple-500">
                            <CardContent className="p-4">
                              <div className="space-y-3">
                                {/* Header */}
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="font-medium flex items-center gap-2">
                                      <RefreshCw className="h-4 w-4 text-purple-600" />
                                      {taskTitle || 'Tapşırıq'}
                                    </h4>
                                    {requestedAt && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {sharedFormatDateTime(requestedAt)}
                                      </p>
                                    )}
                                  </div>
                                  <Badge className="bg-purple-100 text-purple-800">Status sorğusu</Badge>
                                </div>

                                {/* Status change visualization */}
                                <div className="bg-purple-50 rounded-lg p-3">
                                  <div className="flex items-center gap-3">
                                    {prevStatus && (
                                      <Badge variant="outline" className={'text-xs ' + getStatusColor(prevStatus)}>
                                        {getStatusLabel(prevStatus)}
                                      </Badge>
                                    )}
                                    <ArrowRight className="h-4 w-4 text-purple-600 shrink-0" />
                                    <Badge className={'text-xs font-semibold ' + getStatusColor(newStatus)}>
                                      {getStatusLabel(newStatus)}
                                    </Badge>
                                  </div>

                                  {/* Completion details */}
                                  {completionType && (
                                    <div className="mt-2 pt-2 border-t border-purple-200">
                                      <p className="text-xs text-purple-700">
                                        <strong>Nəticə:</strong> {
                                          completionType === 'iddia_temin_edildi' ? 'İddia təmin edildi' :
                                          completionType === 'iddia_redd_edildi' ? 'İddia rədd edildi' :
                                          completionType === 'iddia_qismen_temin' ? 'İddia qismən təmin edildi' :
                                          completionType === 'diger_xususi_hal' ? 'Digər (xüsusi hal)' :
                                          completionType
                                        }
                                      </p>
                                      {specialNote && (
                                        <p className="text-xs text-purple-600 mt-1 italic">"{specialNote}"</p>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Lawyer note */}
                                {reason && (
                                  <div className="bg-muted/50 p-3 rounded-lg">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Vəkil qeydi:</p>
                                    <p className="text-sm">{reason}</p>
                                  </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3 pt-2 border-t">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={function() { handleStatusAction(change, 'reject'); }}
                                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Rədd Et
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={function() { handleStatusAction(change, 'approve'); }}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Təsdiq Et
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex items-center justify-end pt-4 border-t">
          <Button variant="outline" onClick={function() { onOpenChange(false); }}>
            Bağla
          </Button>
        </div>
      </DialogContent>

      {/* Action Reason Modal */}
      {actionInProgress && (actionInProgress.type === 'reject' || actionInProgress.type === 'return' || actionInProgress.type === 'reject-status') && (
        <Dialog open={true} onOpenChange={function() { setActionInProgress(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {actionInProgress.type === 'reject' ? 'Tapşırığı Rədd Et' : 
                 actionInProgress.type === 'return' ? 'Tapşırığı Geri Göndər' : 
                 'Status Dəyişikliyini Rədd Et'}
              </DialogTitle>
              <DialogDescription>
                &quot;{actionInProgress.task.title || actionInProgress.task.taskTitle || ''}&quot; üçün səbəb yazın
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="reason">Səbəb</Label>
                <Textarea
                  id="reason"
                  value={actionReason}
                  onChange={function(e) { setActionReason(e.target.value); }}
                  placeholder={
                    actionInProgress.type === 'reject' 
                      ? 'Rədd etmənin səbəbini yazın...' 
                      : actionInProgress.type === 'return'
                      ? 'Geri göndərmənin səbəbini yazın...'
                      : 'Status dəyişikliyini rədd etmənin səbəbini yazın...'
                  }
                  rows={4}
                  className="mt-2"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={function() { setActionInProgress(null); }}>
                  İmtina
                </Button>
                <Button 
                  onClick={handleSubmitAction}
                  className={
                    actionInProgress.type === 'reject' 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : actionInProgress.type === 'return'
                      ? 'bg-yellow-600 hover:bg-yellow-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }
                >
                  <Send className="h-4 w-4 mr-2" />
                  Göndər
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Lawyer Assignment Modal */}
      {actionInProgress && actionInProgress.type === 'assign-lawyer' && (
        <Dialog open={true} onOpenChange={function() {
          setActionInProgress(null);
          setClaimDeadline(undefined);
          setClaimDeadlineText('');
          setClaimAmounts([{ type: 'principal', label: 'Əsas borc', amount: 0 }]);
          setClientSubjectType('iddiaçı');
          setClientSubjectCustom('');
          setOppositePartyType('cavabdeh');
          setOppositePartyCustom('');
          setOppositePartyName('');
          setUploadedDocs([]);
        }}>
          <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Vəkil Təhkim Et</DialogTitle>
              <DialogDescription>
                &quot;{actionInProgress.task.title || actionInProgress.task.taskTitle || ''}&quot; tapşırığı üçün vəkil seçin
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Client deadline info */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <Label className="text-sm font-medium text-blue-900">Müştəri tərəfindən verilən son tarix</Label>
                </div>
                <p className="text-sm text-blue-800">
                  {actionInProgress.task.deadline
                    ? sharedFormatDate(actionInProgress.task.deadline)
                    : 'Müəyyən edilməyib'}
                </p>
              </div>

              {/* Claim deadline */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  İddia müddətinin son günü
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="gg.aa.iiii"
                    value={claimDeadlineText}
                    onChange={function(e) {
                      setClaimDeadlineText(e.target.value);
                      var parts = e.target.value.split('.');
                      if (parts.length === 3) {
                        var day = parseInt(parts[0]);
                        var month = parseInt(parts[1]) - 1;
                        var year = parseInt(parts[2]);
                        if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 2000) {
                          var date = new Date(year, month, day);
                          if (!isNaN(date.getTime())) {
                            setClaimDeadline(date);
                          }
                        }
                      }
                    }}
                    className="flex-1"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-10 p-0">
                        <Calendar className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <CalendarComponent
                        mode="single"
                        selected={claimDeadline}
                        onSelect={function(date) {
                          setClaimDeadline(date);
                          if (date) {
                            var d = date.getDate().toString().padStart(2, '0');
                            var m = (date.getMonth() + 1).toString().padStart(2, '0');
                            var y = date.getFullYear();
                            setClaimDeadlineText(d + '.' + m + '.' + y);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {claimDeadline && (
                  <p className="text-xs text-green-600 mt-1">
                    Seçilən tarix: {sharedFormatDate(claimDeadline)}
                  </p>
                )}
              </div>

              {/* Claim Amounts */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2"><DollarSign className="h-4 w-4" />İddia məbləğləri</Label>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={function() {
                    setClaimAmounts([...claimAmounts, { type: 'other', label: '', amount: 0 }]);
                  }}>+ Əlavə et</Button>
                </div>
                {claimAmounts.map(function(claim, idx) {
                  return (
                    <div key={idx} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Input
                          placeholder="Məbləğ növü (məs: Əsas borc, Cərimə...)"
                          value={claim.label}
                          onChange={function(e) {
                            var updated = [...claimAmounts];
                            updated[idx] = { ...updated[idx], label: e.target.value };
                            setClaimAmounts(updated);
                          }}
                          className="text-sm"
                        />
                      </div>
                      <div className="w-32">
                        <Input
                          type="number"
                          placeholder="0"
                          value={claim.amount || ''}
                          onChange={function(e) {
                            var updated = [...claimAmounts];
                            updated[idx] = { ...updated[idx], amount: Number(e.target.value) || 0 };
                            setClaimAmounts(updated);
                          }}
                          className="text-sm"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground pb-2">AZN</span>
                      {claimAmounts.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={function() {
                          setClaimAmounts(claimAmounts.filter(function(_, i) { return i !== idx; }));
                        }}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
                {claimAmounts.some(function(c) { return c.amount > 0; }) && (
                  <div className="flex justify-end text-sm font-semibold text-amber-700">
                    Ümumi: ₼{claimAmounts.reduce(function(s, c) { return s + (c.amount || 0); }, 0).toLocaleString()}
                  </div>
                )}
              </div>

              <Separator />

              {/* Party Roles */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2"><User className="h-4 w-4" />Tərəflərin subyektliliyi</Label>

                {/* Our client */}
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                  <p className="text-xs font-medium text-blue-800">Bizim müştərimizin subyektliliyi</p>
                  <div className="flex flex-wrap gap-2">
                    {['iddiaçı', 'cavabdeh', 'ərizəçi', 'maraqlı şəxs', 'digər'].map(function(opt) {
                      return (
                        <Badge
                          key={opt}
                          variant={clientSubjectType === opt ? 'default' : 'outline'}
                          className={'cursor-pointer text-xs ' + (clientSubjectType === opt ? 'bg-blue-600' : 'hover:bg-blue-100')}
                          onClick={function() { setClientSubjectType(opt); }}
                        >{opt.charAt(0).toUpperCase() + opt.slice(1)}</Badge>
                      );
                    })}
                  </div>
                  {clientSubjectType === 'digər' && (
                    <Input placeholder="Subyektin adını qeyd edin" value={clientSubjectCustom} onChange={function(e) { setClientSubjectCustom(e.target.value); }} className="text-sm" />
                  )}
                </div>

                {/* Opposite party */}
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-2">
                  <p className="text-xs font-medium text-amber-800">Qarşı tərəf</p>
                  <div className="flex flex-wrap gap-2">
                    {['iddiaçı', 'cavabdeh', 'ərizəçi', 'maraqlı şəxs', 'xüsusi icraat', 'digər'].map(function(opt) {
                      return (
                        <Badge
                          key={opt}
                          variant={oppositePartyType === opt ? 'default' : 'outline'}
                          className={'cursor-pointer text-xs ' + (oppositePartyType === opt ? 'bg-amber-600' : 'hover:bg-amber-100')}
                          onClick={function() { setOppositePartyType(opt); }}
                        >{opt.charAt(0).toUpperCase() + opt.slice(1)}</Badge>
                      );
                    })}
                  </div>
                  {oppositePartyType === 'digər' && (
                    <Input placeholder="Subyektlilik növünü qeyd edin" value={oppositePartyCustom} onChange={function(e) { setOppositePartyCustom(e.target.value); }} className="text-sm" />
                  )}
                  <Input placeholder="Qarşı tərəfin adını qeyd edin" value={oppositePartyName} onChange={function(e) { setOppositePartyName(e.target.value); }} className="text-sm" />
                </div>
              </div>

              <Separator />

              {/* Documents */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2"><FileText className="h-4 w-4" />Sənədlər</Label>
                {uploadedDocs.map(function(doc, idx) {
                  return (
                    <div key={doc.id} className="flex items-center gap-2 p-2 border rounded-lg bg-green-50 border-green-200">
                      <FileText className="h-4 w-4 text-green-600 shrink-0" />
                      <Input
                        value={doc.name}
                        onChange={function(e) {
                          var updated = [...uploadedDocs];
                          updated[idx] = { ...updated[idx], name: e.target.value };
                          setUploadedDocs(updated);
                        }}
                        className="text-sm h-8 flex-1"
                      />
                      <span className="text-[10px] text-muted-foreground shrink-0">{(doc.file.size / 1024).toFixed(0)} KB</span>
                      <Button variant="ghost" size="sm" className="h-7 text-red-500 px-2" onClick={function() {
                        setUploadedDocs(uploadedDocs.filter(function(_, i) { return i !== idx; }));
                      }}>✕</Button>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
                    onChange={function(e) {
                      var files = e.target.files ? Array.from(e.target.files) : [];
                      if (files.length > 0) {
                        var added = files.map(function(file: any, i: number) {
                          return { file: file, name: file.name, id: Date.now() + i };
                        });
                        setUploadedDocs([...uploadedDocs, ...added]);
                        e.target.value = '';
                      }
                    }}
                    className="text-sm cursor-pointer"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Fayl əlavə etdikdən sonra adını redaktə edə bilərsiniz. Bir neçə faylı eyni anda seçib birlikdə əlavə edə bilərsiniz.</p>
              </div>

              <Separator />

              {/* Lawyer selection - real lawyers */}
              <div>
                <Label>Mövcud Vəkillər</Label>
                <div className="grid gap-3 mt-2 max-h-80 overflow-y-auto">
                  {lawyers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Vəkil tapılmadı</p>
                  ) : (
                    lawyers.map(function(lawyer) {
                      return (
                        <Card 
                          key={lawyer.id}
                          className={'cursor-pointer transition-all hover:shadow-md ' +
                            (selectedLawyer === String(lawyer.id) ? 'ring-2 ring-green-500 bg-green-50' : '')}
                          onClick={function() { setSelectedLawyer(String(lawyer.id)); }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarFallback>
                                    {(lawyer.name || '').split(' ').map(function(n: string) { return n[0]; }).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <h4 className="font-medium">{lawyer.name}</h4>
                                  <p className="text-sm text-muted-foreground">{lawyer.specialization || ''}</p>
                                  <div className="flex items-center gap-4 mt-1">
                                    {lawyer.experience && <span className="text-xs text-muted-foreground">Təcrübə: {lawyer.experience}</span>}
                                    <span className="text-xs text-muted-foreground">Aktiv: {lawyer.activeTasks || 0} tapşırıq</span>
                                  </div>
                                </div>
                              </div>
                              {selectedLawyer === String(lawyer.id) && (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={function() {
                  setActionInProgress(null);
                  setClaimDeadline(undefined);
                  setClaimDeadlineText('');
                  setClaimAmounts([{ type: 'principal', label: 'Əsas borc', amount: 0 }]);
                  setClientSubjectType('iddiaçı');
                  setClientSubjectCustom('');
                  setOppositePartyType('cavabdeh');
                  setOppositePartyCustom('');
          setOppositePartyName('');
                  setUploadedDocs([]);
                }}>
                  İmtina
                </Button>
                <Button 
                  onClick={handleSubmitAction}
                  disabled={!selectedLawyer}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Təhkim Et
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Client Submitted Data Modal */}
      <ClientSubmittedDataModal
        open={clientDataModalOpen}
        onOpenChange={setClientDataModalOpen}
        task={selectedTaskForData}
        tenantId={tenantId}
      />
      {/* Document Preview Dialog */}
      {previewDoc && (
        <Dialog open={!!previewDoc} onOpenChange={function() { setPreviewDoc(null); }}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{previewDoc.name || 'Sənəd'}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-auto">
              {(function() {
                var url = previewDoc.url || '';
                var ext = (url.split('.').pop() || '').toLowerCase().split('?')[0];
                if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) {
                  return <img src={url} alt={previewDoc.name} style={{ maxHeight: '70vh', margin: '0 auto', display: 'block' }} />;
                } else if (ext === 'pdf') {
                  return <iframe src={url} style={{ width: '100%', minHeight: '500px', border: 'none' }} title={previewDoc.name} />;
                } else {
                  return (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">Bu fayl növü üçün önizləmə mövcud deyil.</p>
                      <Button onClick={function() { window.open(url, '_blank'); }}>
                        <Download className="h-4 w-4 mr-2" />
                        Yüklə
                      </Button>
                    </div>
                  );
                }
              })()}
            </div>
          </DialogContent>
        </Dialog>
      )}

    </Dialog>
  );
}