"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { fetchApi } from "../../utils/apiHelper";
import { toast } from "sonner";
import { Zap, Plus, Trash2, Edit3, X, Save, Info, PlayCircle } from "lucide-react";

// ==================== AVTOMATLAŞDIRMA QAYDALARI (Automation Rules) ====================
//
// QEYD (2026-09, istifadəçi tapşırığı: "müasir task management sistemlərindəki
// kimi daxili avtomatlaşdırma qaydaları — trigger/şərt/əməliyyat"). Bu modal
// YALNIZ menecer panelindən açılır (backend "manage_automation_rules" icazəsi
// ilə qorunur — bax RoleManagementModal.tsx "Sistem" qrupu). Qaydaların
// FAKTİKİ icrası backend-də olur (bax backend/internal/professionallaw/automation.go);
// bu komponent sadəcə CRUD UI-dır.
//
// v1-də dəstəklənən tetikləyicilər REQUEST-DRIVEN hadisələrdir (vaxt-əsaslı,
// məs. "3 gün qalmış" tetikləyicilər bu dövrdə YOXDUR — backend-də heç bir
// fon proses/cron mövcud olmadığı üçün, bax QA hesabatı).

var TRIGGER_TYPES = [
  {
    key: "task_status_changed",
    label: "Tapşırıq statusu dəyişəndə",
    filterLabel: "Yalnız bu statusa keçricıəndə (boş = hər dəyişiklikdə)",
    filterKey: "to_status",
    filterPlaceholder: "məs. completed, tehkim_olundu",
    vars: ["task_title", "task_number", "from_status", "to_status", "priority", "contract_title"],
  },
  {
    key: "task_created",
    label: "Yeni tapşırıq yaradılanda",
    filterLabel: "Yalnız bu prioritetdə (boş = hər tapşırıqda)",
    filterKey: "priority",
    filterPlaceholder: "məs. high, normal, low",
    vars: ["task_title", "task_number", "status", "priority", "contract_title"],
  },
  {
    key: "contract_created",
    label: "Yeni müqavilə yaradılanda",
    filterLabel: null,
    filterKey: null,
    filterPlaceholder: "",
    vars: ["contract_title", "contract_number", "client_name"],
  },
  {
    key: "approval_decided",
    label: "Təsdiq sorğusu qərara alınanda",
    filterLabel: "Yalnız bu qərarda (boş = həm təsdiq, həm rədd)",
    filterKey: "decision",
    filterPlaceholder: "approved və ya rejected",
    vars: ["decision", "entity_type"],
  },
];

var RECIPIENTS = [
  { key: "managers", label: "Bütün menecerlər", hint: "Hər tetikləyici növü üçün işləyir" },
  { key: "assigned_lawyer", label: "Təhkim olunmuş vəkil", hint: "Yalnız tapşırıqla bağlı tetikləyicilərdə mövcuddur" },
  { key: "client", label: "Müştəri", hint: "Yalnız müştərisi məlum olan tapşırıq/müqavilə hadisələrində mövcuddur" },
];

function triggerMeta(key: string) {
  return TRIGGER_TYPES.find(function (t) { return t.key === key; }) || TRIGGER_TYPES[0];
}

function emptyForm() {
  return {
    id: null as number | null,
    name: "",
    description: "",
    trigger_type: TRIGGER_TYPES[0].key,
    filter_value: "",
    recipient: "managers",
    title: "",
    message: "",
  };
}

// QEYD: backend `datatypes.JSON` sahələri (trigger_config/action_config)
// API cavabında AYRICA sətir kimi deyil, birbaşa JSON obyekti kimi gəlir
// (RoleManagementModal.tsx-dəki `role.permissions` ilə EYNİ davranış) —
// ona görə burada JSON.parse ÇAĞIRILMIR, obyekt olduğu kimi istifadə olunur.
function ruleToForm(rule: any) {
  var tc: any = (rule.trigger_config && typeof rule.trigger_config === "object") ? rule.trigger_config : {};
  var ac: any = (rule.action_config && typeof rule.action_config === "object") ? rule.action_config : {};
  var meta = triggerMeta(rule.trigger_type);
  return {
    id: rule.id,
    name: rule.name || "",
    description: rule.description || "",
    trigger_type: rule.trigger_type || TRIGGER_TYPES[0].key,
    filter_value: meta.filterKey ? (tc[meta.filterKey] || "") : "",
    recipient: ac.recipient || "managers",
    title: ac.title || "",
    message: ac.message || "",
  };
}

// QEYD: eyni səbəbdən (yuxarı baxın) trigger_config/action_config burada
// PLAIN OBYEKT kimi göndərilir — sorğunun bütövü `fetchApi` daxilində BİR
// dəfə JSON.stringify olunur; bunları burada ƏLAVƏ stringify etsəydik,
// backend-ə iki dəfə encode olunmuş (escape edilmiş) mətn gedərdi və
// `datatypes.JSON`/`map[string]string`-ə uğursuz unmarshal olardı — filtr/
// əməliyyat konfiqurasiyası SƏSSİZCƏ işləməzdi.
function formToPayload(form: any) {
  var meta = triggerMeta(form.trigger_type);
  var triggerConfig: any = {};
  if (meta.filterKey && form.filter_value && form.filter_value.trim()) {
    triggerConfig[meta.filterKey] = form.filter_value.trim();
  }
  return {
    name: form.name.trim(),
    description: form.description,
    trigger_type: form.trigger_type,
    trigger_config: triggerConfig,
    action_config: {
      recipient: form.recipient,
      title: form.title,
      message: form.message,
    },
  };
}

interface AutomationRulesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutomationRulesModal({ open, onOpenChange }: AutomationRulesModalProps) {
  var [rules, setRules] = useState<any[]>([]);
  var [loading, setLoading] = useState(false);
  var [saving, setSaving] = useState(false);
  var [showForm, setShowForm] = useState(false);
  var [form, setForm] = useState(emptyForm());

  var fetchRules = function () {
    setLoading(true);
    return fetchApi("/automation-rules")
      .then(function (data) { setRules(Array.isArray(data) ? data : []); })
      .catch(function () { setRules([]); })
      .finally(function () { setLoading(false); });
  };

  useEffect(function () { if (open) fetchRules(); }, [open]);

  var startCreate = function () {
    setForm(emptyForm());
    setShowForm(true);
  };

  var startEdit = function (rule: any) {
    setForm(ruleToForm(rule));
    setShowForm(true);
  };

  var cancelForm = function () {
    setShowForm(false);
    setForm(emptyForm());
  };

  var handleSave = async function () {
    if (!form.name.trim()) {
      toast.error("Qaydanın adı tələb olunur");
      return;
    }
    if (!form.title.trim() && !form.message.trim()) {
      toast.error("Bildirişin başlığı və ya mətni doldurulmalıdır");
      return;
    }
    setSaving(true);
    try {
      var payload = formToPayload(form);
      if (form.id) {
        await fetchApi("/automation-rules/" + form.id, { method: "PUT", body: JSON.stringify(payload) });
        toast.success("Qayda yeniləndi");
      } else {
        await fetchApi("/automation-rules", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Qayda yaradıldı");
      }
      cancelForm();
      fetchRules();
    } catch (err: any) {
      toast.error("Xəta: " + (err?.message || "yadda saxlanmadı"));
    } finally {
      setSaving(false);
    }
  };

  var handleToggleActive = async function (rule: any) {
    try {
      await fetchApi("/automation-rules/" + rule.id, {
        method: "PUT",
        body: JSON.stringify({ is_active: !rule.is_active }),
      });
      fetchRules();
    } catch {
      toast.error("Xəta");
    }
  };

  // Silmə əməliyyatı geri qaytarılmır — LibraryModal/ContractManagementModal-dakı
  // eyni qayda: həmişə təsdiq istənilir.
  var handleDelete = async function (rule: any) {
    if (!confirm('"' + rule.name + '" qaydasını silmək istədiyinizə əminsiniz?')) return;
    try {
      await fetchApi("/automation-rules/" + rule.id, { method: "DELETE" });
      toast.success("Qayda silindi");
      fetchRules();
    } catch {
      toast.error("Xəta");
    }
  };

  var meta = triggerMeta(form.trigger_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 !flex !flex-col overflow-hidden">
        <div className="px-6 pt-5 pb-3 border-b shrink-0 pr-12">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Zap className="h-5 w-5 text-amber-500" />Avtomatlaşdırma qaydaları
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Müəyyən hadisə baş verəndə avtomatik bildiriş göndərin — məs. "tapşırıq statusu tamamlandıya dəyişəndə menecerlərə bildir".
          </p>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
          {showForm ? (
            <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{form.id ? "Qaydanı redaktə et" : "Yeni qayda"}</h3>
                <button onClick={cancelForm} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Ad</label>
                <Input className="mt-1" placeholder="məs. Tamamlanan tapşırıqları bildir" value={form.name}
                  onChange={function (e) { setForm(Object.assign({}, form, { name: e.target.value })); }} />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Təsvir (opsional)</label>
                <Input className="mt-1" placeholder="Bu qaydanın nə üçün olduğunu qeyd edin" value={form.description}
                  onChange={function (e) { setForm(Object.assign({}, form, { description: e.target.value })); }} />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Tetikləyici (nə vaxt işə düşsün)</label>
                <Select value={form.trigger_type} onValueChange={function (v) { setForm(Object.assign({}, form, { trigger_type: v, filter_value: "" })); }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map(function (t) { return <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>; })}
                  </SelectContent>
                </Select>
              </div>

              {meta.filterKey && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{meta.filterLabel}</label>
                  <Input className="mt-1" placeholder={meta.filterPlaceholder} value={form.filter_value}
                    onChange={function (e) { setForm(Object.assign({}, form, { filter_value: e.target.value })); }} />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground">Kimə bildiriş getsin</label>
                <Select value={form.recipient} onValueChange={function (v) { setForm(Object.assign({}, form, { recipient: v })); }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECIPIENTS.map(function (r) { return <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>; })}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">{RECIPIENTS.find(function (r) { return r.key === form.recipient; })?.hint}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Bildirişin başlığı</label>
                <Input className="mt-1" placeholder="məs. {{task_title}} tamamlandı" value={form.title}
                  onChange={function (e) { setForm(Object.assign({}, form, { title: e.target.value })); }} />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Bildirişin mətni</label>
                <Textarea className="mt-1" rows={2} placeholder="məs. {{task_title}} tapşırığı {{to_status}} statusuna keçdi" value={form.message}
                  onChange={function (e: any) { setForm(Object.assign({}, form, { message: e.target.value })); }} />
              </div>

              <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-white border rounded-md p-2">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Mövcud dəyişənlər: {meta.vars.map(function (v) { return "{{" + v + "}}"; }).join(", ")} — başlıq/mətndə istifadə edə bilərsiniz.</span>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={cancelForm}>Ləğv et</Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" />{saving ? "Yadda saxlanır..." : "Yadda saxla"}
                </Button>
              </div>
            </div>
          ) : (
            <Button className="w-full mb-3" onClick={startCreate}><Plus className="h-4 w-4 mr-1" />Yeni qayda</Button>
          )}

          <div className="mt-4 space-y-2">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Yüklənir...</p>
            ) : rules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Hələ heç bir avtomatlaşdırma qaydası yoxdur</p>
              </div>
            ) : (
              rules.map(function (rule) {
                var m = triggerMeta(rule.trigger_type);
                return (
                  <div key={rule.id} className="flex items-start gap-3 border rounded-lg p-3 hover:bg-muted/30">
                    <Switch checked={!!rule.is_active} onCheckedChange={function () { handleToggleActive(rule); }} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{rule.name}</span>
                        <Badge variant="outline" className="text-[9px]">{m.label}</Badge>
                        {!rule.is_active && <Badge variant="outline" className="text-[9px] text-slate-400">Deaktiv</Badge>}
                      </div>
                      {rule.description && <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>}
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                        <PlayCircle className="h-3 w-3" />
                        {rule.run_count > 0
                          ? (rule.run_count + " dəfə icra olunub" + (rule.last_run_at ? (" · son: " + new Date(rule.last_run_at).toLocaleString('az-AZ')) : ""))
                          : "Hələ icra olunmayıb"}
                      </div>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <button className="p-1.5 rounded hover:bg-amber-100" onClick={function () { startEdit(rule); }} title="Redaktə et"><Edit3 className="h-3.5 w-3.5 text-amber-600" /></button>
                      <button className="p-1.5 rounded hover:bg-red-100" onClick={function () { handleDelete(rule); }} title="Sil"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
