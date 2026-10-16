import { uploadFile, fetchApi } from '../../utils/apiHelper';
import { useState, useEffect, useMemo } from 'react';
import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { SuccessModal } from '../shared/SuccessModal';
import { Plus, Upload, FileText, AlertCircle, X, FolderOpen, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface ContractData {
  id: string;
  name: string;
  maxTasks: number;
  currentTasks: number;
  status: string;
  contractType: string;
  allowedTaskTypes: string[];
}

interface ApiTaskType {
  id: number;
  name: string;
  slug?: string;
  description: string;
  required_documents: string[] | null;
  is_active: boolean;
}

interface TaskCreationModalProps {
  trigger?: React.ReactNode;
  preselectedContractId?: string;
  selectedContract?: any;
  showContractInfo?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  contracts?: ContractData[];
  tenantId?: number | null;
  // BUG DÜZƏLİŞİ (2026-09, istifadəçi bildirişi): əvvəllər bu prop ManagerDashboard-
  // dan göndərilirdi, amma burada heç oxunmurdu — nəticədə tapşırıq uğurla
  // yaradılsa belə, dashboard-dakı siyahılar (müqavilə kvotası, tapşırıq sayı)
  // dərhal yenilənmirdi (yalnız 15 saniyəlik polling gözləməli idi). İndi istifadə
  // olunur (bax submitTask uğur budağı).
  onContractUpdate?: () => void;
}

interface AmountEntry {
  id: string;
  type: string;
  amount: string;
}

// parseAllowedCategories - allowed_categories backend-dən ya array, ya da
// JSON-encoded string kimi gələ bilər (jsonb sütun).
function parseAllowedCategories(v: any): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v) {
    try { var parsed = JSON.parse(v); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
}

// normalizeContract - "contracts" prop-u ManagerDashboard-dan XAM (snake_case)
// formada gəlir (task_quota, tasks_used, allowed_categories) — bu komponent isə
// həmişə camelCase (maxTasks/currentTasks/allowedTaskTypes) gözləyirdi, ona görə
// (maxTasks - currentTasks) = NaN olur, kvota filtri həmişə boş qalırdı və
// müqavilə siyahısı heç vaxt görünmürdü. `id` də mütləq string-ə çevrilir ki,
// Radix Select-in string dəyərləri ilə strict (===) müqayisə düzgün işləsin.
function normalizeContract(c: any): ContractData {
  return {
    id: String(c.id),
    name: c.name || c.title || ('Müqavilə #' + c.id),
    maxTasks: Number(c.maxTasks ?? c.task_quota ?? c.taskQuota ?? 0),
    currentTasks: Number(c.currentTasks ?? c.tasks_used ?? c.tasksUsed ?? 0),
    status: c.status || 'active',
    contractType: c.contractType || c.type || '',
    allowedTaskTypes: c.allowedTaskTypes || parseAllowedCategories(c.allowed_categories ?? c.allowedCategories),
  };
}

export function TaskCreationModal({ 
  trigger, 
  preselectedContractId,
  selectedContract,
  showContractInfo = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  contracts: rawContractsProp = [],
  tenantId,
  onContractUpdate
}: TaskCreationModalProps) {
  var contracts = useMemo(function() { return (rawContractsProp || []).map(normalizeContract); }, [rawContractsProp]);
  var normalizedPreselectedContractId = preselectedContractId !== undefined && preselectedContractId !== null ? String(preselectedContractId) : preselectedContractId;
  var [internalOpen, setInternalOpen] = useState(false);
  var open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  var setOpen = controlledOnOpenChange || setInternalOpen;

  var [successModalOpen, setSuccessModalOpen] = useState(false);

  var [formData, setFormData] = useState({
    name: '',
    priority: '',
    notes: '',
    deadline: '',
    taskType: '',
    contractId: normalizedPreselectedContractId || ''
  });

  // Task types from API
  var [taskTypes, setTaskTypes] = useState<ApiTaskType[]>([]);
  var [taskTypesLoading, setTaskTypesLoading] = useState(false);

  // Document uploads per required document
  var [uploadedFiles, setUploadedFiles] = useState<Record<string, File | null>>({});

  // Amounts
  var [amounts, setAmounts] = useState<AmountEntry[]>([]);

  // Fetch task types
  useEffect(function() {
    if (!open || !tenantId) return;
    setTaskTypesLoading(true);
    fetchApi('/task-types')
      .catch(function() { return []; })
      .then(function(data) {
        setTaskTypes(Array.isArray(data) ? data.filter(function(t: ApiTaskType) { return t.is_active; }) : []);
      })
      .catch(function() { setTaskTypes([]); })
      .finally(function() { setTaskTypesLoading(false); });
  }, [open, tenantId]);

  // Available contracts
  var availableContracts = contracts.filter(function(c) {
    return (c.status === 'active' || c.status === 'near-limit') && (c.maxTasks - c.currentTasks) > 0;
  });

  // Get allowed task types for selected contract
  var getContractTaskTypes = function(): ApiTaskType[] {
    var contract = contracts.find(function(c) { return c.id === formData.contractId; });
    if (!contract) return [];
    var allowed = contract.allowedTaskTypes || [];
    if (allowed.length === 0) return taskTypes;
    return taskTypes.filter(function(tt) {
      return allowed.includes(tt.name) || (tt.slug && allowed.includes(tt.slug));
    });
  };

  // Get required documents for selected task type
  var getRequiredDocuments = function(): string[] {
    if (!formData.taskType) return [];
    var taskType = taskTypes.find(function(tt) {
      return String(tt.id) === formData.taskType || tt.name === formData.taskType || (tt.slug && tt.slug === formData.taskType);
    });
    return taskType?.required_documents || [];
  };

  // Auto-select task type from contract's allowedTaskTypes
  useEffect(function() {
    if (normalizedPreselectedContractId) {
      setFormData(function(prev) { return { ...prev, contractId: normalizedPreselectedContractId }; });
    }
  }, [normalizedPreselectedContractId]);

  // When contract + taskTypes are ready, auto-set taskType
  useEffect(function() {
    if (!formData.contractId || taskTypes.length === 0) return;
    var contract = contracts.find(function(c) { return c.id === formData.contractId; });
    if (!contract) return;
    var allowed = contract.allowedTaskTypes || [];
    if (allowed.length > 0) {
      var matched = taskTypes.find(function(tt) {
        return allowed.includes(tt.name) || (tt.slug && allowed.includes(tt.slug));
      });
      if (matched) {
        setFormData(function(prev) { return { ...prev, taskType: String(matched.id) }; });
      }
    }
  }, [formData.contractId, taskTypes, contracts]);

  var handleTaskTypeChange = function(value: string) {
    setFormData(function(prev) { return { ...prev, taskType: value }; });
    setUploadedFiles({});
  };

  var handleFileChange = function(docName: string, file: File | null) {
    setUploadedFiles(function(prev) { return { ...prev, [docName]: file }; });
  };

  // BUG DÜZƏLİŞİ (2026-09, istifadəçi bildirişi: "bütün xanalar doldurulsa belə,
  // 'tapşırığı yarat' düyməsinə basdıqda tapşırıq yaranmır"): bu forma əvvəllər
  // doğrulamadan sonra tapşırığı BİRBAŞA yaratmaq əvəzinə, müştəri üçün nəzərdə
  // tutulmuş ("Müştəri dashboard sistemindən istifadə qaydaları") bir Qaydalar və
  // Şərtlər pəncərəsi açırdı və yalnız istifadəçi həmin pəncərəni axıra qədər
  // scroll edib bir çek-box işarələyib ayrıca "Təsdiq et və davam et" düyməsinə
  // basdıqdan SONRA faktiki sorğunu göndərirdi. Bu axın menecerin/admin-in ÖZ
  // daxili tapşırıq-yaratma alətinə aid deyil (müştəri-yönümlü mətn — "müştəri
  // öz öhdəliklərini yerinə yetirməlidir" və s. — buraya səhvən bağlanmışdı;
  // əsl müştəri tapşırıq formasında, `ClientTaskCreationModal.tsx`-də, bu şərt
  // pəncərəsi ümumiyyətlə İSTİFADƏ OLUNMUR). Nəticədə admin/menecer düyməyə
  // basanda (bu gizli, əlaqəsiz pəncərəni gözləmədiyi üçün) heç nə baş
  // vermədiyini düşünürdü. İndi doğrulamadan keçən sorğu birbaşa göndərilir.
  var handleSubmit = function(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.contractId) {
      toast.error('Zəhmət olmasa müqavilə seçin');
      return;
    }
    if (!formData.name || !formData.priority || !formData.deadline || !formData.taskType) {
      toast.error('Zəhmət olmasa bütün vacib sahələri doldurun');
      return;
    }

    // Quota check
    var foundContract = contracts.find(function(c) { return c.id === formData.contractId; });
    if (foundContract) {
      var remaining = foundContract.maxTasks - foundContract.currentTasks;
      if (remaining <= 0) {
        toast.error('Müqavilə kvotası dolub. Yeni tapşırıq əlavə edə bilməzsiniz');
        return;
      }
    }

    submitTask();
  };

  var submitTask = async function() {
    try {
      var taskTypeName = '';
      if (formData.taskType) {
        var tt = taskTypes.find(function(t) { return String(t.id) === formData.taskType || t.name === formData.taskType; });
        if (tt) taskTypeName = tt.name;
      }

      var contractId = formData.contractId ? parseInt(formData.contractId) : null;

      var encodedDocs: any[] = [];
      var dNames = Object.keys(uploadedFiles);
      for (var di = 0; di < dNames.length; di++) {
        var uf = uploadedFiles[dNames[di]];
        if (!uf) continue;
        try {
          var up = await uploadFile(uf, uf.name);
          encodedDocs.push({ name: dNames[di], description: dNames[di], url: up.url, file_type: uf.type, file_size: uf.size, uploaded_by: 'manager', uploaded_at: new Date().toISOString() });
        } catch (e) { console.error('File upload error:', e); }
      }

      var body: any = {
        title: formData.name,
        contract_id: contractId,
        category: taskTypeName,
        priority: formData.priority,
        status: 'new',
        document_checklist: encodedDocs.length > 0 ? JSON.stringify(encodedDocs) : undefined,
        description: formData.notes || '',
        deadline: formData.deadline ? formData.deadline + 'T00:00:00Z' : null,
      };

      // BUG DÜZƏLİŞİ (2026-09): "Məbləğ" bölməsi (yuxarıda, `amounts` state-i)
      // istifadəçidən dəyər toplayır və "Ümumi məbləğ" kimi cəmini göstərirdi,
      // AMMA bu heç vaxt sorğu body-sinə əlavə olunmurdu — nəticədə daxil
      // edilən HƏR məbləğ tapşırıq yaradılan kimi SƏSSİZCƏ İTİRDİLİRDİ (backend
      // Task modelində məhz bunun üçün nəzərdə tutulmuş `claim_amounts`/
      // `total_claim` sahələri var — bax `ManagerTaskCreationModal.tsx`-dəki
      // eyni funksiyanın DÜZGÜN implementasiyası, buradan köçürülüb).
      var validAmounts = amounts.filter(function(a) { return a.type && parseFloat(a.amount) > 0; })
        .map(function(a) { return { type: a.type, amount: parseFloat(a.amount) }; });
      if (validAmounts.length > 0) {
        body.claim_amounts = JSON.stringify(validAmounts);
        body.total_claim = validAmounts.reduce(function(s, a) { return s + a.amount; }, 0);
      }

      await fetchApi('/tasks', { method: 'POST', body: JSON.stringify(body) });

      setOpen(false);
      setSuccessModalOpen(true);
      if (onContractUpdate) onContractUpdate();
    } catch (err: any) {
      toast.error('Tapşırıq yaradıla bilmədi: ' + (err.message || 'Xəta'));
    }
  };

  var handleSuccessModalClose = function() {
    setSuccessModalOpen(false);
    setOpen(false);
    setFormData({ name: '', priority: '', notes: '', deadline: '', taskType: '', contractId: normalizedPreselectedContractId || '' });
    setAmounts([]);
    setUploadedFiles({});
  };

  var addAmountEntry = function() {
    setAmounts(function(prev) { return [...prev, { id: Date.now().toString(), type: '', amount: '' }]; });
  };

  var removeAmountEntry = function(id: string) {
    setAmounts(function(prev) { return prev.filter(function(e) { return e.id !== id; }); });
  };

  var updateAmountEntry = function(id: string, field: 'type' | 'amount', value: string) {
    setAmounts(function(prev) { return prev.map(function(e) { return e.id === id ? { ...e, [field]: value } : e; }); });
  };

  var getTotalAmount = function() {
    return amounts.reduce(function(sum, e) { return sum + (parseFloat(e.amount) || 0); }, 0).toFixed(2);
  };

  var contractTaskTypes = getContractTaskTypes();
  var requiredDocuments = getRequiredDocuments();

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0" data-modal="task-creation">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Yeni Tapşırıq Yarat</DialogTitle>
            <DialogDescription>
              Yeni hüquqi tapşırıq yaradın və lazımi sənədləri əlavə edin
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
            <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">

              {/* Contract info banner */}
              {showContractInfo && normalizedPreselectedContractId && (function() {
                var fc = contracts.find(function(c) { return c.id === normalizedPreselectedContractId; });
                if (!fc) return null;
                var rem = fc.maxTasks - fc.currentTasks;
                var pct = (fc.currentTasks / fc.maxTasks) * 100;
                return (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <FolderOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-blue-900 dark:text-blue-100">{fc.name}</h4>
                        <p className="text-xs text-blue-700 dark:text-blue-300">{rem} tapşırıq qalıb ({pct.toFixed(0)}% istifadə edilib)</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Contract select (if not preselected) */}
              {!normalizedPreselectedContractId && (
                <div className="space-y-2">
                  <Label>Müqavilə seç *</Label>
                  <Select 
                    value={formData.contractId} 
                    onValueChange={function(v) {
                      setFormData(function(prev) { return { ...prev, contractId: v, taskType: '' }; });
                      setUploadedFiles({});
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Müqaviləni seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableContracts.map(function(c) {
                        var rem = c.maxTasks - c.currentTasks;
                        return (
                          <SelectItem key={c.id} value={c.id} disabled={rem <= 0}>
                            {c.name} ({rem} tapşırıq qalıb)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Row 1: Cavabdeh adı + Prioritet */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taskName">Cavabdeh adı *</Label>
                  <Input
                    id="taskName"
                    value={formData.name}
                    onChange={function(e) { setFormData(function(prev) { return { ...prev, name: e.target.value }; }); }}
                    placeholder="Cavabdeh adını daxil edin"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prioritet *</Label>
                  <Select value={formData.priority} onValueChange={function(v) { setFormData(function(prev) { return { ...prev, priority: v }; }); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Prioriteti seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">Yüksək</SelectItem>
                      <SelectItem value="medium">Orta</SelectItem>
                      <SelectItem value="low">Aşağı</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Deadline */}
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline *</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={function(e) { setFormData(function(prev) { return { ...prev, deadline: e.target.value }; }); }}
                  required
                />
              </div>

              {/* Amounts */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Məbləğ</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addAmountEntry}>
                    <Plus className="h-4 w-4 mr-1" /> Məbləğ əlavə et
                  </Button>
                </div>
                {amounts.length > 0 && (
                  <div className="space-y-2">
                    {amounts.map(function(entry) {
                      return (
                        <div key={entry.id} className="flex gap-2 items-start">
                          <div className="flex-1">
                            <Select value={entry.type} onValueChange={function(v) { updateAmountEntry(entry.id, 'type', v); }}>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Növ seçin" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="principal-debt">İddia edilən əsas borc</SelectItem>
                                <SelectItem value="penalty-interest">İddia edilən cərimə/faiz borcu</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1">
                            <Input type="number" value={entry.amount} onChange={function(e) { updateAmountEntry(entry.id, 'amount', e.target.value); }} placeholder="0.00" min="0" step="0.01" className="h-9 text-sm" />
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={function() { removeAmountEntry(entry.id); }}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                    <div className="flex justify-between items-center pt-2 border-t text-sm">
                      <span className="font-medium">Ümumi məbləğ:</span>
                      <span className="font-bold">{getTotalAmount()} AZN</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Required Documents */}
              {formData.taskType && requiredDocuments.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-base">Tələb olunan sənədlər</Label>
                  </div>
                  <div className="space-y-3">
                    {requiredDocuments.map(function(docName) {
                      var file = uploadedFiles[docName] || null;
                      return (
                        <div key={docName} className="p-3 border rounded-lg space-y-2">
                          <Label className="text-sm font-medium">{docName}</Label>
                          {file ? (
                            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
                              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                              <span className="text-sm text-green-800 dark:text-green-200 truncate flex-1">{file.name}</span>
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={function() { handleFileChange(docName, null); }}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <label className="flex items-center gap-3 p-3 border-2 border-dashed border-muted-foreground/25 rounded-lg hover:border-muted-foreground/50 transition-colors cursor-pointer">
                              <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-sm text-muted-foreground flex-1">Sənədi yükləmək üçün klikləyin</span>
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                onChange={function(e) {
                                  var f = e.target.files?.[0] || null;
                                  handleFileChange(docName, f);
                                }}
                              />
                              <span className="text-xs text-primary font-medium shrink-0">Seç</span>
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {formData.taskType && requiredDocuments.length === 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-900 dark:text-amber-100">Bu iş növü üçün sənəd tələbi müəyyən edilməyib</p>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Qeyd</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={function(e) { setFormData(function(prev) { return { ...prev, notes: e.target.value }; }); }}
                  placeholder="Tapşırıq haqqında əlavə məlumat"
                  rows={3}
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={function() { setOpen(false); }}>
                  Ləğv et
                </Button>
                <Button type="submit">
                  Tapşırığı yarat
                </Button>
              </div>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <SuccessModal
        open={successModalOpen}
        onOpenChange={function(v) {
          setSuccessModalOpen(v);
          if (!v) handleSuccessModalClose();
        }}
        title="Tapşırığınız uğurla əlavə edildi"
        message="Tapşırığınız sistemə əlavə edildi və manager təsdiqi gözləyir"
        autoCloseDuration={3000}
      />
    </>
  );
}