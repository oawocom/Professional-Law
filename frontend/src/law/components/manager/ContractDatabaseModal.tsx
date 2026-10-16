'use client';
import { fetchApi } from '../../utils/apiHelper';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import {
  FolderOpen,
  Search,
  Plus,
  FileText,
  Save,
  Loader2,
  X,
  Calendar,
  DollarSign,
  User,
  Tag,
  Eye,
  AlertTriangle
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ContractCardData {
  id: string | number;
  title?: string;
  name?: string;
  status?: string;
  client_id?: string | number;
  clientId?: string | number;
  client_name?: string;
  clientName?: string;
  lawyer_name?: string;
  assignedLawyer?: string;
  contract_number?: string;
  contractNumber?: string;
  isArchived?: boolean;
  [key: string]: any;
}

interface ContractDatabaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contracts: ContractCardData[];
  clients: any[];
  lawyers: any[];
  onSelectContract?: (contract: ContractCardData) => void;
  onRefresh?: () => void;
}

// ─── Task categories ─────────────────────────────────────────────────────────

// ─── Status helpers ───────────────────────────────────────────────────────────

// Backend/hook-lar bəzən raw API cavabını (snake_case: is_archived) birbaşa
// ötürür, bəzən UI formasına (camelCase: isArchived) çevrilmiş obyekt gəlir —
// hər ikisini dəstəkləmək üçün hər iki sahəyə baxılır (bax: ClientDatabaseModal).
function isContractArchived(c: any): boolean {
  return !!(c && (c.isArchived || c.is_archived));
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'active': return 'Aktiv';
    case 'inactive': return 'Passiv';
    case 'draft': return 'Qaralama';
    case 'expired': return 'Bitib';
    case 'suspended': return 'Dayandırılıb';
    case 'completed': return 'Tamamlanıb';
    default: return status || '';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-700';
    case 'inactive': return 'bg-gray-100 text-gray-600';
    case 'draft': return 'bg-yellow-100 text-yellow-700';
    case 'expired': return 'bg-red-100 text-red-700';
    case 'suspended': return 'bg-orange-100 text-orange-700';
    case 'completed': return 'bg-blue-100 text-blue-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function g(obj: any, ...keys: string[]): any {
  if (!obj) return '';
  for (var k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return '';
}

// ─── Inline NewContractModal ──────────────────────────────────────────────────

interface NewContractModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  clients: any[];
  lawyers?: any[];
}

function addOneYear(dateStr: string): string {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() - 1); // müqavilə 1 il sonra bitən gündən 1 gün əvvəl bitir (365/366 gün)
  return d.toISOString().slice(0, 10);
}

function NewContractModal({ open, onClose, onSuccess, clients }: NewContractModalProps) {
  var [submitting, setSubmitting] = useState(false);
  var [categories, setCategories] = useState([]);
  var [selectedCategory, setSelectedCategory] = useState('');
  var [oneYear, setOneYear] = useState(true);
  var [form, setForm] = useState({
    title: '',
    client_id: '',
    start_date: '',
    end_date: '',
    task_quota: '100',
    static_lawyer_fee: '',
    value: '',
    auto_renew: false,
    description: '',
    notes: '',
  });

  useEffect(function() {
    if (!open) return;
    fetchApi('/library?type=task_category')
      .then(function(d: any) { setCategories(Array.isArray(d) ? d : []); })
      .catch(function() { setCategories([]); });
  }, [open]);

  var set = function(field: string, value: any) {
    setForm(function(prev) { return { ...prev, [field]: value }; });
  };

  var resetAndClose = function() {
    setForm({ title: '', client_id: '', status: 'active', start_date: '', end_date: '', task_quota: '100', static_lawyer_fee: '', value: '', auto_renew: false, description: '', notes: '' });
    setOneYear(true);
    onClose();
  };

  var handleSubmit = async function() {
    if (!form.title.trim()) { toast.error('Müqavilə adı daxil edin'); return; }
    if (!form.client_id) { toast.error('Müştəri seçin'); return; }
    if (form.start_date && form.end_date && new Date(form.start_date) > new Date(form.end_date)) {
      toast.error('Başlama tarixi bitmə tarixindən gec ola bilməz');
      return;
    }
    setSubmitting(true);
    try {
      var body: any = {
        title: form.title.trim(),
        client_id: Number(form.client_id),
        status: 'active',
        task_quota: form.task_quota ? Number(form.task_quota) : 100,
        auto_renew: form.auto_renew,
        description: form.description.trim(),
        notes: form.notes.trim(),
      };
      if (selectedCategory) body.category = selectedCategory;
      if (form.start_date) body.start_date = new Date(form.start_date).toISOString();
      if (form.end_date) body.end_date = new Date(form.end_date).toISOString();
      if (form.static_lawyer_fee) body.static_lawyer_fee = Number(form.static_lawyer_fee);
      if (form.value) body.value = Number(form.value);

      await fetchApi('/contracts', { method: 'POST', body: JSON.stringify(body) });
      toast.success('Müqavilə uğurla yaradıldı');
      resetAndClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'Müqavilə yaradılmadı');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={function(v) { if (!v) resetAndClose(); }}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] p-0 !flex !flex-col overflow-hidden">

        {/* Header — sabit */}
        <div className="px-6 pt-5 pb-4 border-b shrink-0 pr-12">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FolderOpen className="h-5 w-5 text-slate-600" />
            Yeni Müqavilə
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Yeni müqavilə yaratmaq üçün məlumatları doldurun</p>
        </div>

        {/* Scroll sahəsi */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
          <div className="space-y-5">

            {/* Əsas */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700 border-b pb-1">Əsas məlumatlar</p>
              <div className="space-y-1.5">
                <Label>Müqavilə adı <span className="text-red-500">*</span></Label>
                <Input placeholder="Müqavilə adını daxil edin" value={form.title} onChange={function(e) { set('title', e.target.value); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Müştəri <span className="text-red-500">*</span></Label>
                <Select value={form.client_id} onValueChange={function(v) { set('client_id', v); }}>
                  <SelectTrigger><SelectValue placeholder="Müştəri seçin" /></SelectTrigger>
                  <SelectContent>
                    {(clients || []).filter(function(c) { return !isContractArchived(c); }).map(function(c) {
                      var id = String(g(c, 'id'));
                      var name = g(c, 'name', 'company');
                      return <SelectItem key={id} value={id}>{name}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Kateqoriya</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger>
                    <SelectContent>
                      {categories.map(function(cat: any) {
                        return <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tapşırıq limiti</Label>
                  <Input type="number" min="1" placeholder="100" value={form.task_quota} onChange={function(e) { set('task_quota', e.target.value); }} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Təsvir</Label>
                <Textarea placeholder="Qısa məlumat" rows={2} value={form.description} onChange={function(e) { set('description', e.target.value); }} />
              </div>
            </div>

            {/* Tarix / Maliyyə */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700 border-b pb-1">Tarix və maliyyə</p>
              <div className="flex items-center gap-2">
                <Checkbox id="one_year" checked={oneYear} onCheckedChange={function(v) {
                  var checked = Boolean(v);
                  setOneYear(checked);
                  if (checked && form.start_date) set('end_date', addOneYear(form.start_date));
                }} />
                <Label htmlFor="one_year" className="cursor-pointer text-sm">1 illik müqavilə (bitmə tarixi avtomatik hesablansın)</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Başlama tarixi</Label>
                  <Input type="date" value={form.start_date} onChange={function(e) {
                    var v = e.target.value;
                    if (oneYear) {
                      setForm(function(prev) { return { ...prev, start_date: v, end_date: addOneYear(v) }; });
                    } else {
                      set('start_date', v);
                    }
                  }} />
                </div>
                <div className="space-y-1.5">
                  <Label>Bitmə tarixi {oneYear && <span className="text-[10px] text-muted-foreground">(avtomatik — dəyişmək üçün "1 illik" işarəsini götürün)</span>}</Label>
                  <Input type="date" value={form.end_date} disabled={oneYear} onChange={function(e) {
                    setOneYear(false);
                    set('end_date', e.target.value);
                  }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Müqavilə məbləği (₼)</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.value} onChange={function(e) { set('value', e.target.value); }} />
                </div>
                <div className="space-y-1.5">
                  <Label>Vəkil haqqı (₼)</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.static_lawyer_fee} onChange={function(e) { set('static_lawyer_fee', e.target.value); }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="auto_renew" checked={form.auto_renew} onCheckedChange={function(v) { set('auto_renew', Boolean(v)); }} />
                <Label htmlFor="auto_renew" className="cursor-pointer">Avtomatik yenilə</Label>
              </div>
            </div>

            {/* Qeydlər */}
            <div className="space-y-1.5 pb-2">
              <Label>Qeydlər</Label>
              <Textarea placeholder="Əlavə qeydlər..." rows={2} value={form.notes} onChange={function(e) { set('notes', e.target.value); }} />
            </div>

          </div>
        </div>

        {/* Footer — sabit, həmişə görünür */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0 bg-white">
          <Button type="button" variant="outline" onClick={resetAndClose} disabled={submitting}>
            <X className="h-4 w-4 mr-1.5" />Ləğv et
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Müqavilə yarat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Inline ContractDetailModal (ətraflı bax + redaktə) ──────────────────────

interface ContractDetailModalProps {
  contract: ContractCardData | null;
  open: boolean;
  onClose: () => void;
  clients: any[];
  onUpdated?: () => void;
}

function ContractDetailModal({ contract, open, onClose, clients, onUpdated }: ContractDetailModalProps) {
  var [editing, setEditing] = useState(false);
  var [saving, setSaving] = useState(false);
  var [oneYear, setOneYear] = useState(false);
  var [form, setForm] = useState<any>({});

  useEffect(function() {
    if (!contract) return;
    setForm({
      title: contract.title || contract.name || '',
      description: contract.description || '',
      start_date: contract.start_date ? String(contract.start_date).slice(0, 10) : (contract.startDate ? String(contract.startDate).slice(0, 10) : ''),
      end_date: contract.end_date ? String(contract.end_date).slice(0, 10) : (contract.endDate ? String(contract.endDate).slice(0, 10) : ''),
      value: contract.value != null ? String(contract.value) : '',
      static_lawyer_fee: contract.static_lawyer_fee != null ? String(contract.static_lawyer_fee) : (contract.staticLawyerFee != null ? String(contract.staticLawyerFee) : ''),
      task_quota: contract.task_quota != null ? String(contract.task_quota) : (contract.taskQuota != null ? String(contract.taskQuota) : ''),
      notes: contract.notes || '',
      status: contract.status || 'active',
    });
    setEditing(false);
    setOneYear(false);
  }, [contract && contract.id, open]);

  if (!contract) return null;

  var set = function(field: string, value: any) { setForm(function(prev: any) { return { ...prev, [field]: value }; }); };
  var clientName = String(contract.client_name || contract.clientName || '—');
  var contractNumber = String(contract.contract_number || contract.contractNumber || '');
  var tasksUsed = contract.tasks_used || contract.tasksUsed || 0;
  var taskQuota = contract.task_quota || contract.taskQuota || 100;

  var handleSave = async function() {
    if (!form.title.trim()) { toast.error('Müqavilə adı tələb olunur'); return; }
    if (form.start_date && form.end_date && new Date(form.start_date) > new Date(form.end_date)) {
      toast.error('Başlama tarixi bitmə tarixindən gec ola bilməz');
      return;
    }
    setSaving(true);
    try {
      var body: any = {
        title: form.title.trim(),
        description: form.description,
        notes: form.notes,
        status: form.status,
      };
      if (form.start_date) body.start_date = new Date(form.start_date).toISOString();
      if (form.end_date) body.end_date = new Date(form.end_date).toISOString();
      if (form.value !== '') body.value = Number(form.value);
      if (form.static_lawyer_fee !== '') body.static_lawyer_fee = Number(form.static_lawyer_fee);
      if (form.task_quota !== '') body.task_quota = Number(form.task_quota);
      await fetchApi('/contracts/' + contract.id, { method: 'PUT', body: JSON.stringify(body) });
      toast.success('Müqavilə yeniləndi');
      setEditing(false);
      if (onUpdated) onUpdated();
    } catch (err: any) {
      var msg = err?.message || '';
      try { var p = JSON.parse(msg); if (p.error) msg = p.error; } catch { /* */ }
      toast.error(msg || 'Müqavilə yenilənmədi');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={function(v) { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] p-0 !flex !flex-col overflow-hidden" data-modal="contract-detail">
        <div className="px-6 pt-5 pb-4 border-b shrink-0 flex items-start justify-between gap-3">
          <div>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FolderOpen className="h-5 w-5 text-slate-600" />
              {editing ? 'Müqaviləni redaktə et' : (contract.title || contract.name || 'Müqavilə')}
            </DialogTitle>
            <DialogDescription>
              {contractNumber ? contractNumber + ' · ' : ''}{clientName}
            </DialogDescription>
          </div>
          {!editing && (
            <Button size="sm" variant="outline" onClick={function() { setEditing(true); }} type="button">
              Redaktə et
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
          {!editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="Status" value={getStatusLabel(contract.status || 'active')} />
                <InfoField label="Müştəri" value={clientName} />
                <InfoField label="Başlama tarixi" value={form.start_date ? new Date(form.start_date).toLocaleDateString('az-AZ') : '—'} />
                <InfoField label="Bitmə tarixi" value={form.end_date ? new Date(form.end_date).toLocaleDateString('az-AZ') : '—'} />
                <InfoField label="Müqavilə məbləği" value={form.value ? '₼' + Number(form.value).toLocaleString() : '—'} />
                <InfoField label="Vəkil haqqı" value={form.static_lawyer_fee ? '₼' + Number(form.static_lawyer_fee).toLocaleString() : '—'} />
                <InfoField label="Tapşırıq limiti" value={tasksUsed + ' / ' + taskQuota} />
              </div>
              {form.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Təsvir</p>
                  <p className="text-sm whitespace-pre-wrap">{form.description}</p>
                </div>
              )}
              {form.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Qeydlər</p>
                  <p className="text-sm whitespace-pre-wrap">{form.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Müqavilə adı *</Label>
                <Input value={form.title} onChange={function(e) { set('title', e.target.value); }} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="edit_one_year" checked={oneYear} onCheckedChange={function(v) {
                  var checked = Boolean(v);
                  setOneYear(checked);
                  if (checked && form.start_date) set('end_date', addOneYear(form.start_date));
                }} />
                <Label htmlFor="edit_one_year" className="cursor-pointer text-sm">1 illik (bitmə tarixi avtomatik hesablansın)</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Başlama tarixi</Label>
                  <Input type="date" value={form.start_date} onChange={function(e) {
                    var v = e.target.value;
                    if (oneYear) setForm(function(prev: any) { return { ...prev, start_date: v, end_date: addOneYear(v) }; });
                    else set('start_date', v);
                  }} />
                </div>
                <div className="space-y-1.5">
                  <Label>Bitmə tarixi</Label>
                  <Input type="date" value={form.end_date} disabled={oneYear} onChange={function(e) { setOneYear(false); set('end_date', e.target.value); }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Müqavilə məbləği (₼)</Label>
                  <Input type="number" min="0" step="0.01" value={form.value} onChange={function(e) { set('value', e.target.value); }} />
                </div>
                <div className="space-y-1.5">
                  <Label>Vəkil haqqı (₼)</Label>
                  <Input type="number" min="0" step="0.01" value={form.static_lawyer_fee} onChange={function(e) { set('static_lawyer_fee', e.target.value); }} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tapşırıq limiti</Label>
                <Input type="number" min="1" value={form.task_quota} onChange={function(e) { set('task_quota', e.target.value); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Təsvir</Label>
                <Textarea rows={2} value={form.description} onChange={function(e) { set('description', e.target.value); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Qeydlər</Label>
                <Textarea rows={2} value={form.notes} onChange={function(e) { set('notes', e.target.value); }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0 bg-white">
          {editing ? (
            <>
              <Button type="button" variant="outline" onClick={function() { setEditing(false); }} disabled={saving}>Ləğv et</Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                Yadda saxla
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={onClose}>Bağla</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

// ─── Main: ContractDatabaseModal ─────────────────────────────────────────────

export function ContractDatabaseModal({
  open,
  onOpenChange,
  contracts,
  clients,
  lawyers,
  onSelectContract,
  onRefresh
}: ContractDatabaseModalProps) {
  var [searchTerm, setSearchTerm] = useState('');
  var [statusFilter, setStatusFilter] = useState('all');
  var [newContractOpen, setNewContractOpen] = useState(false);
  var [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  var [dirty, setDirty] = useState(false);
  var [detailContract, setDetailContract] = useState<ContractCardData | null>(null);
  var [detailOpen, setDetailOpen] = useState(false);
  // BUG DÜZƏLİŞİ (2026-09): əvvəllər silmə yalnız brauzerin sadə `window.confirm()`
  // pəncərəsi ilə (mətnsiz, kaskad təsiri göstərmədən) təsdiqlənirdi — bu, həmqoşası
  // ClientDatabaseModal.tsx-dəki "yaz və təsdiqlə" pəncərəsindən daha zəif UX idi.
  // İndi eyni, daha təhlükəsiz nümunəyə keçirilib.
  var [deleteTarget, setDeleteTarget] = useState<ContractCardData | null>(null);
  var [deleteConfirmText, setDeleteConfirmText] = useState('');
  var [deleting, setDeleting] = useState(false);

  var visibleContracts = (contracts || []).filter(function(c) {
    return !deletedIds.has(String(c.id));
  });

  var filteredContracts = visibleContracts.filter(function(contract) {
    var term = searchTerm.toLowerCase();
    var contractTitle = String(contract.title || contract.name || '');
    var clientName = String(contract.client_name || contract.clientName || '');
    var lawyerName = String(contract.lawyer_name || contract.assignedLawyer || '');
    var contractNumber = String(contract.contract_number || contract.contractNumber || '');

    var matchesSearch = !term ||
      contractTitle.toLowerCase().includes(term) ||
      clientName.toLowerCase().includes(term) ||
      lawyerName.toLowerCase().includes(term) ||
      contractNumber.toLowerCase().includes(term);

    // aktiv = arxivlənməmiş, passiv = arxivlənmiş, all = hamısı
    var matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && !isContractArchived(contract)) ||
      (statusFilter === 'passive' && isContractArchived(contract));
    return matchesSearch && matchesStatus;
  });

  var statusCounts = {
    all: visibleContracts.length,
    active: visibleContracts.filter(function(c) { return !isContractArchived(c); }).length,
    passive: visibleContracts.filter(function(c) { return isContractArchived(c); }).length,
  };

  var handleDelete = function(contract: ContractCardData) {
    setDeleteTarget(contract);
    setDeleteConfirmText('');
  };

  var confirmDelete = async function() {
    if (!deleteTarget) return;
    var contractTitle = String(deleteTarget.title || deleteTarget.name || 'Bu');
    setDeleting(true);
    try {
      await fetchApi('/contracts/' + deleteTarget.id, { method: 'DELETE' });
      setDeletedIds(function(prev) {
        var next = new Set(prev);
        next.add(String(deleteTarget.id));
        return next;
      });
      setDirty(true);
      toast.success(contractTitle + ' müqaviləsi silindi');
      setDeleteTarget(null);
      setDeleteConfirmText('');
    } catch (err) {
      toast.error('Müqavilə silinmədi');
    } finally {
      setDeleting(false);
    }
  };

  var handleClose = function(isOpen: boolean) {
    if (!isOpen && dirty) {
      setDeletedIds(new Set());
      setDirty(false);
      if (onRefresh) onRefresh();
    }
    onOpenChange(isOpen);
  };

  var handleContractCreated = function() {
    setDirty(true);
    if (onRefresh) onRefresh();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] h-[90vh] overflow-hidden !flex !flex-col" data-modal="contract-database">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Müqavilə Bazası
            </DialogTitle>
            <DialogDescription>Müqavilələri idarə edin, axtarın və yeni müqavilə yaradın</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 flex-1 min-h-0">
            {/* Search + Filter + Add */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Müqavilə, müştəri və ya vəkil axtar..."
                  value={searchTerm}
                  onChange={function(e) { setSearchTerm(e.target.value); }}
                  className="pl-8"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44 shrink-0">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Hamısı ({statusCounts.all})</SelectItem>
                  <SelectItem value="active">Aktiv ({statusCounts.active})</SelectItem>
                  <SelectItem value="passive">Passiv ({statusCounts.passive})</SelectItem>
                </SelectContent>
              </Select>

              <Button className="shrink-0" onClick={function() { setNewContractOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Yeni Müqavilə
              </Button>
            </div>

            <div className="text-sm text-muted-foreground shrink-0">
              {filteredContracts.length} / {visibleContracts.length} müqavilə
            </div>

            {/* Contract List */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="flex flex-col gap-3 pr-4 pb-2">
                {filteredContracts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    {searchTerm || statusFilter !== 'all' ? (
                      <p>Axtarışa uyğun müqavilə tapılmadı</p>
                    ) : (
                      <div>
                        <p>Hələ heç bir müqavilə yoxdur</p>
                        <Button className="mt-4" onClick={function() { setNewContractOpen(true); }}>
                          <Plus className="h-4 w-4 mr-2" />İlk müqaviləni yarat
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  filteredContracts.map(function(contract) {
                    var title = String(contract.title || contract.name || 'Müqavilə');
                    var clientName = String(contract.client_name || contract.clientName || '—');
                    var contractNumber = String(contract.contract_number || contract.contractNumber || '');
                    var status = contract.status || 'active';
                    return (
                      <div
                        key={String(contract.id)}
                        className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
                        onClick={onSelectContract ? function() { onSelectContract(contract); } : undefined}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <FolderOpen className="h-4 w-4 text-slate-500 shrink-0" />
                              <p className="font-medium text-gray-900 truncate">{title}</p>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />{clientName}
                              </span>
                              {contractNumber && (
                                <span className="flex items-center gap-1">
                                  <Tag className="h-3 w-3" />{contractNumber}
                                </span>
                              )}
                              {contract.lawyer_name || contract.assignedLawyer ? (
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />{contract.lawyer_name || contract.assignedLawyer}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isContractArchived(contract) && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-600">
                                Passiv
                              </span>
                            )}
                            <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + getStatusColor(status)}>
                              {getStatusLabel(status)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                              onClick={function(e) { e.stopPropagation(); setDetailContract(contract); setDetailOpen(true); }}
                              title="Ətraflı bax"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                              onClick={function(e) { e.stopPropagation(); handleDelete(contract); }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <NewContractModal
        open={newContractOpen}
        onClose={function() { setNewContractOpen(false); }}
        onSuccess={handleContractCreated}
        clients={clients}
        lawyers={lawyers}
      />

      <ContractDetailModal
        contract={detailContract}
        open={detailOpen}
        onClose={function() { setDetailOpen(false); }}
        clients={clients}
        onUpdated={function() { setDirty(true); if (onRefresh) onRefresh(); setDetailOpen(false); }}
      />

      {/* BUG DÜZƏLİŞİ (2026-09): silmə xəbərdarlığı — ClientDatabaseModal.tsx ilə eyni nümunə */}
      <Dialog open={!!deleteTarget} onOpenChange={function(o) { if (!o) { setDeleteTarget(null); setDeleteConfirmText(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700"><AlertTriangle className="h-5 w-5" />Müqaviləni sil</DialogTitle>
            <DialogDescription className="space-y-2 pt-1">
              <span className="block"><strong>{String(deleteTarget?.title || deleteTarget?.name || '')}</strong> verilənlər bazasından HƏMİŞƏLİK silinəcək. Bu əməliyyat GERİ QAYTARILA BİLMƏZ.</span>
              <span className="block">Bununla birgə həmişəlik silinəcək:</span>
              <span className="block">• Bu müqaviləyə aid BÜTÜN tapşırıqlar və mesajlar</span>
              <span className="block pt-2">Təsdiq üçün aşağıya <strong>SIL</strong> yazın:</span>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={function(e) { setDeleteConfirmText(e.target.value); }}
            placeholder="SIL"
            className="mt-1"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={function() { setDeleteTarget(null); setDeleteConfirmText(''); }} disabled={deleting}>Ləğv et</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting || deleteConfirmText.trim().toUpperCase() !== 'SIL'}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Həmişəlik sil
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}