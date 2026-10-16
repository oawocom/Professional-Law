"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { fetchApi } from "../../utils/apiHelper";
import { toast } from "sonner";
import { Shield, Plus, Trash2, CheckSquare, Square, User, Save, Pencil, Briefcase, Settings, Lock, Unlock, X, SlidersHorizontal, RotateCcw } from "lucide-react";

// İmtiyaz matrisi hər interfeys (menecer/vəkil/müştəri) üçün AYRI-AYRI
// tərtib olunub — burada YALNIZ həmin interfeysdə faktiki mövcud olan və
// backend tərəfindən real yoxlanılan hüquqlar var. Ölü/heç bir yerdə
// işlədilməyən açarlar (view_documents, delete_documents, manage_settings,
// manage_users) siyahıdan çıxarılıb ki, menecer yalnız real təsiri olan
// imtiyazları görsün.
var MANAGER_PERMISSIONS = [
  { group: "Müştərilər", perms: [
    { key: "view_clients", label: "Görmək" },
    { key: "edit_clients", label: "Redaktə" },
    { key: "delete_clients", label: "Silmək" },
  ]},
  { group: "Vəkillər", perms: [
    { key: "view_lawyers", label: "Görmək" },
    { key: "edit_lawyers", label: "Redaktə" },
    { key: "delete_lawyers", label: "Silmək" },
  ]},
  { group: "Müqavilələr", perms: [
    { key: "view_contracts", label: "Görmək" },
    { key: "edit_contracts", label: "Redaktə" },
    { key: "delete_contracts", label: "Silmək" },
  ]},
  { group: "Tapşırıqlar", perms: [
    { key: "view_tasks", label: "Görmək" },
    { key: "create_tasks", label: "Yaratmaq" },
    { key: "edit_tasks", label: "Redaktə" },
    { key: "delete_tasks", label: "Silmək" },
    { key: "change_status", label: "Status dəyişmək" },
    { key: "assign_tasks", label: "Vəkil təhkim etmək" },
  ]},
  { group: "Sənədlər", perms: [
    { key: "upload_documents", label: "Yükləmək" },
  ]},
  { group: "Maliyyə", perms: [
    { key: "view_amounts", label: "Məbləğləri görmək" },
    { key: "edit_amounts", label: "Məbləğləri redaktə" },
  ]},
  { group: "Hesabatlar", perms: [
    { key: "view_reports", label: "Görmək" },
    { key: "export_reports", label: "İxrac etmək" },
  ]},
  { group: "Sistem", perms: [
    { key: "manage_library", label: "Kitabxana" },
    { key: "manage_roles", label: "Rollar" },
    { key: "manage_automation_rules", label: "Avtomatlaşdırma qaydaları" },
  ]},
];

var LAWYER_PERMISSIONS = [
  { group: "Müştərilər", perms: [
    { key: "view_clients", label: "Görmək" },
  ]},
  { group: "Müqavilələr", perms: [
    { key: "view_contracts", label: "Görmək" },
  ]},
  { group: "Tapşırıqlar", perms: [
    { key: "view_tasks", label: "Görmək" },
    { key: "edit_tasks", label: "Redaktə" },
    { key: "change_status", label: "Status dəyişmək" },
  ]},
  { group: "Sənədlər", perms: [
    { key: "upload_documents", label: "Yükləmək" },
  ]},
  { group: "Maliyyə", perms: [
    { key: "view_amounts", label: "Məbləğləri görmək" },
    { key: "edit_amounts", label: "Nəticə məbləğini daxil etmək" },
  ]},
];

var CLIENT_PERMISSIONS = [
  { group: "Mənim hesabım", perms: [
    { key: "view_clients", label: "Profili görmək" },
    { key: "edit_clients", label: "Profili redaktə etmək" },
  ]},
  { group: "Vəkillər", perms: [
    { key: "view_lawyers", label: "Vəkil performansını görmək" },
  ]},
  { group: "Müqavilələr", perms: [
    { key: "view_contracts", label: "Görmək" },
  ]},
  { group: "Tapşırıqlar", perms: [
    { key: "view_tasks", label: "Görmək" },
    { key: "create_tasks", label: "Yeni tapşırıq yaratmaq" },
  ]},
  { group: "Sənədlər", perms: [
    { key: "upload_documents", label: "Yükləmək" },
  ]},
  { group: "Maliyyə", perms: [
    { key: "view_amounts", label: "Məbləğləri görmək" },
  ]},
];

var PERMISSION_GROUPS_BY_ROLE = {
  manager: MANAGER_PERMISSIONS,
  lawyer: LAWYER_PERMISSIONS,
  client: CLIENT_PERMISSIONS,
};

function permGroupsForRole(role) {
  return PERMISSION_GROUPS_BY_ROLE[role] || MANAGER_PERMISSIONS;
}

export function RoleManagementModal({ open, onOpenChange }) {
  var [roles, setRoles] = useState([]);
  var [users, setUsers] = useState([]);
  var [contracts, setContracts] = useState([]);
  var [loading, setLoading] = useState(false);
  var [tab, setTab] = useState("roles");
  // Role create/edit form (eyni forma hər ikisi üçün istifadə olunur)
  var [newRoleName, setNewRoleName] = useState("");
  var [newRoleBase, setNewRoleBase] = useState("client");
  var [newRoleDesc, setNewRoleDesc] = useState("");
  var [newPerms, setNewPerms] = useState({});
  var [editingRoleId, setEditingRoleId] = useState(null);
  var [saving, setSaving] = useState(false);
  // Fərdi (user-specific) icazə override paneli
  var [overrideUserId, setOverrideUserId] = useState(null);
  var [overrideDraft, setOverrideDraft] = useState({});
  var [savingOverride, setSavingOverride] = useState(false);

  var fetchRoles = function() {
    setLoading(true);
    Promise.all([
      fetchApi("/sub-roles").catch(function() { return []; }),
      fetchApi("/users").catch(function() { return []; }),
      fetchApi("/contracts").catch(function() { return []; }),
    ]).then(function(results) {
      setRoles(Array.isArray(results[0]) ? results[0] : []);
      setUsers(Array.isArray(results[1]) ? results[1] : []);
      setContracts(Array.isArray(results[2]) ? results[2] : []);
    }).finally(function() { setLoading(false); });
  };

  var seedDefaults = async function() {
    try {
      await fetchApi("/seed-defaults", { method: "POST" });
      toast.success("Defolt rollar yaradıldı");
      fetchRoles();
    } catch { toast.error("Xəta"); }
  };

  useEffect(function() { if (open) fetchRoles(); }, [open]);

  var togglePerm = function(key) {
    var copy = Object.assign({}, newPerms);
    copy[key] = !copy[key];
    setNewPerms(copy);
  };

  var resetRoleForm = function() {
    setEditingRoleId(null);
    setNewRoleName(""); setNewRoleDesc(""); setNewRoleBase("client"); setNewPerms({});
  };

  var startEditRole = function(role) {
    setEditingRoleId(role.id);
    setNewRoleName(role.name || "");
    setNewRoleDesc(role.description || "");
    setNewRoleBase(role.base_role || "client");
    setNewPerms(Object.assign({}, role.permissions || {}));
    setTab("create");
  };

  var handleSaveRole = async function() {
    if (!newRoleName.trim()) return;
    setSaving(true);
    try {
      if (editingRoleId) {
        await fetchApi("/sub-roles/" + editingRoleId, {
          method: "PUT",
          body: JSON.stringify({ base_role: newRoleBase, name: newRoleName.trim(), description: newRoleDesc.trim(), permissions: newPerms }),
        });
        toast.success("Rol yeniləndi");
      } else {
        await fetchApi("/sub-roles", {
          method: "POST",
          body: JSON.stringify({ base_role: newRoleBase, name: newRoleName.trim(), description: newRoleDesc.trim(), permissions: newPerms }),
        });
        toast.success("Rol yaradıldı");
      }
      resetRoleForm();
      setTab("roles");
      fetchRoles();
    } catch { toast.error("Xəta"); }
    finally { setSaving(false); }
  };

  // BUG DÜZƏLİŞİ (2026-09): silmə heç bir təsdiq olmadan dərhal icra olunurdu —
  // yanlışlıqla klik olarsa, hələ istifadəçilərə təyin edilmiş rol dərhal silinə bilərdi.
  var handleDeleteRole = async function(id, name) {
    if (!confirm((name ? '"' + name + '"' : 'Bu') + ' rolunu silmək istədiyinizə əminsiniz? Bu rola təyin edilmiş istifadəçilər üçün icazələr dəyişə bilər.')) return;
    try {
      await fetchApi("/sub-roles/" + id, { method: "DELETE" });
      toast.success("Rol silindi");
      if (editingRoleId === id) resetRoleForm();
      fetchRoles();
    } catch { toast.error("Xəta"); }
  };

  var handleAssignRole = async function(userId, subRoleId) {
    try {
      await fetchApi("/users/" + userId, {
        method: "PUT",
        body: JSON.stringify({ sub_role_id: subRoleId ? Number(subRoleId) : null }),
      });
      toast.success("Rol təyin edildi");
      fetchRoles();
    } catch { toast.error("Xəta"); }
  };

  // Manager istifadəçini konkret bir müqaviləyə bağlayır — bağlanan istifadəçi
  // YALNIZ o müqaviləni (və onun tapşırıqlarını) görə/üzərində işləyə bilir.
  var handleAssignContract = async function(userId, contractId) {
    try {
      await fetchApi("/users/" + userId, {
        method: "PUT",
        body: JSON.stringify({ restricted_contract_id: contractId ? Number(contractId) : null }),
      });
      toast.success(contractId ? "İstifadəçi müqaviləyə bağlandı" : "Müqavilə məhdudiyyəti götürüldü");
      fetchRoles();
    } catch { toast.error("Xəta"); }
  };

  // === Fərdi (user-specific) icazə override-ları ===
  // Rolun matrisindən asılı olmayaraq, məhz bu bir istifadəçi üçün ayrı-ayrı
  // icazələri məcburi aç/bağla edə bilirik — digər eyni rollu istifadəçilərə toxunmadan.
  var openOverrides = function(user) {
    setOverrideUserId(user.id);
    setOverrideDraft(Object.assign({}, user.permission_overrides || {}));
  };
  var closeOverrides = function() { setOverrideUserId(null); setOverrideDraft({}); };

  // 3 vəziyyət: undefined (rolun özündən miras) → true (məcburi aç) → false (məcburi bağla) → undefined
  var cycleOverride = function(key) {
    var copy = Object.assign({}, overrideDraft);
    if (!(key in copy)) copy[key] = true;
    else if (copy[key] === true) copy[key] = false;
    else delete copy[key];
    setOverrideDraft(copy);
  };

  var saveOverrides = async function() {
    setSavingOverride(true);
    try {
      await fetchApi("/users/" + overrideUserId, {
        method: "PUT",
        body: JSON.stringify({ permission_overrides: overrideDraft }),
      });
      toast.success("Fərdi icazələr yadda saxlanıldı");
      closeOverrides();
      fetchRoles();
    } catch { toast.error("Xəta"); }
    finally { setSavingOverride(false); }
  };

  var baseLabel = function(r) { return r === "manager" ? "Menecer" : r === "lawyer" ? "Vəkil" : "Müştəri"; };

  var contractLabel = function(ct) {
    if (!ct) return "";
    var num = ct.contract_number ? ct.contract_number + " — " : "";
    var client = ct.client_name || (ct.client && ct.client.name) || "";
    return num + ct.title + (client ? " (" + client + ")" : "");
  };

  var findContract = function(id) {
    return contracts.find(function(ct) { return ct.id === id; });
  };

  var findRole = function(id) {
    return roles.find(function(r) { return r.id === id; });
  };

  var overrideUser = users.find(function(u) { return u.id === overrideUserId; });
  var overrideUserRole = overrideUser && overrideUser.sub_role_id ? findRole(overrideUser.sub_role_id) : null;
  var overrideBasePerms = (overrideUserRole && overrideUserRole.permissions) || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Rolların idarəedilməsi</DialogTitle>
          <DialogDescription>Alt-rollar yaradın/redaktə edin, imtiyazları təyin edin, istifadəçilərə rol verin, konkret istifadəçi üçün fərdi icazə istisnaları qoyun və istəsəniz onları bir müqaviləyə bağlayın</DialogDescription>
        </DialogHeader>

        {overrideUserId ? (
          <div className="flex-1 overflow-y-auto mt-3 space-y-3 pr-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" />Fərdi icazələr — {overrideUser ? overrideUser.name : ""}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {overrideUserRole ? "Əsas rol: " + overrideUserRole.name : "Bu istifadəçiyə rol təyin olunmayıb (defolt olaraq məhdudiyyətsizdir)"}. Aşağıdakı düymələr yalnız BU istifadəçiyə təsir edir, digər eyni rollu istifadəçilərə toxunmur.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeOverrides}><X className="h-4 w-4" /></Button>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              {permGroupsForRole(overrideUser ? overrideUser.role : "manager").map(function(pg) {
                return (
                  <div key={pg.group}>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1">{pg.group}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {pg.perms.map(function(perm) {
                        var overrideVal = overrideDraft[perm.key];
                        var inheritedVal = !!overrideBasePerms[perm.key];
                        var state = overrideVal === true ? "on" : overrideVal === false ? "off" : "inherit";
                        var cls = state === "on" ? "bg-green-600" : state === "off" ? "bg-red-600" : (inheritedVal ? "border-green-400 text-green-700" : "");
                        var text = state === "on" ? "Məcburi AÇIQ" : state === "off" ? "Məcburi BAĞLI" : (inheritedVal ? "Miras: açıq" : "Miras: bağlı");
                        return (
                          <Badge key={perm.key} variant={state === "inherit" ? "outline" : "default"} className={"cursor-pointer text-[10px] " + cls} onClick={function() { cycleOverride(perm.key); }} title={text}>
                            {perm.label} · {text}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveOverrides} disabled={savingOverride}>
                <Save className="h-4 w-4 mr-1.5" />{savingOverride ? "Saxlanılır..." : "Fərdi icazələri yadda saxla"}
              </Button>
              <Button variant="outline" onClick={function() { setOverrideDraft({}); }}>
                <RotateCcw className="h-4 w-4 mr-1.5" />Hamısını mirasa qaytar
              </Button>
            </div>
          </div>
        ) : (
        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3 shrink-0">
            <TabsTrigger value="roles">Rollar ({roles.length})</TabsTrigger>
            <TabsTrigger value="users">İstifadəçilər ({users.length})</TabsTrigger>
            <TabsTrigger value="create">{editingRoleId ? "Rolu redaktə et" : "Yeni rol yarat"}</TabsTrigger>
          </TabsList>

          <TabsContent value="roles" className="flex-1 overflow-y-auto mt-3">
            <div className="space-y-2 pr-1">
              {roles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Hələ alt-rol yaradılmayıb</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={seedDefaults}>Defolt rolları yarat</Button>
                </div>
              ) : roles.map(function(role) {
                var perms = role.permissions || {};
                var permCount = Object.keys(perms).filter(function(k) { return perms[k]; }).length;
                return (
                  <Card key={role.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={function() { startEditRole(role); }}>
                          <div className={"w-9 h-9 rounded-lg flex items-center justify-center shrink-0 " + (role.base_role === "manager" ? "bg-slate-100" : role.base_role === "lawyer" ? "bg-amber-100" : "bg-blue-100")}>
                            {role.base_role === "manager" ? <Settings className="h-4 w-4 text-slate-600" /> : role.base_role === "lawyer" ? <Briefcase className="h-4 w-4 text-amber-600" /> : <User className="h-4 w-4 text-blue-600" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{role.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-[9px]">{baseLabel(role.base_role)}</Badge>
                              <span className="text-[10px] text-muted-foreground">{permCount} imtiyaz aktiv</span>
                              {role.is_default && <Badge className="text-[8px] bg-blue-100 text-blue-700 h-4">Defolt</Badge>}
                            </div>
                            {role.description && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{role.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={function() { startEditRole(role); }} title="Redaktə et">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={function() { handleDeleteRole(role.id, role.name); }} title="Sil">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="users" className="flex-1 overflow-y-auto mt-3">
            <div className="space-y-2 pr-1">
              {users.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">İstifadəçi yoxdur</p>
              ) : users.map(function(user) {
                var boundContract = user.restricted_contract_id ? findContract(user.restricted_contract_id) : null;
                var overrideCount = Object.keys(user.permission_overrides || {}).length;
                return (
                  <Card key={user.id}>
                    <CardContent className="p-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{user.name}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] text-muted-foreground">{user.email}</span>
                              <Badge variant="outline" className="text-[9px]">{baseLabel(user.role)}</Badge>
                              {user.display_name && <Badge className="text-[8px] bg-purple-100 text-purple-700 h-4">{user.display_name}</Badge>}
                              {boundContract ? (
                                <Badge className="text-[8px] bg-amber-100 text-amber-700 h-4 gap-0.5">
                                  <Lock className="h-2.5 w-2.5" />{contractLabel(boundContract)}
                                </Badge>
                              ) : user.restricted_contract_id ? (
                                <Badge className="text-[8px] bg-amber-100 text-amber-700 h-4 gap-0.5">
                                  <Lock className="h-2.5 w-2.5" />Müqavilə #{user.restricted_contract_id}
                                </Badge>
                              ) : null}
                              {overrideCount > 0 && (
                                <Badge className="text-[8px] bg-violet-100 text-violet-700 h-4 gap-0.5">
                                  <SlidersHorizontal className="h-2.5 w-2.5" />{overrideCount} fərdi icazə
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Select value={user.sub_role_id ? String(user.sub_role_id) : "none"} onValueChange={function(v) { handleAssignRole(user.id, v === "none" ? null : v); }}>
                          <SelectTrigger className="w-44 h-8 text-xs shrink-0"><SelectValue placeholder="Rol seçin" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Rol yoxdur</SelectItem>
                            {roles.filter(function(r) { return r.base_role === user.role; }).map(function(r) {
                              return <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>;
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2 pl-12">
                        {user.restricted_contract_id ? <Lock className="h-3 w-3 text-amber-600 shrink-0" /> : <Unlock className="h-3 w-3 text-muted-foreground shrink-0" />}
                        <Select value={user.restricted_contract_id ? String(user.restricted_contract_id) : "none"} onValueChange={function(v) { handleAssignContract(user.id, v === "none" ? null : v); }}>
                          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Müqaviləyə bağla" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Məhdudiyyət yoxdur (bütün müqavilələr)</SelectItem>
                            {contracts.map(function(ct) {
                              return <SelectItem key={ct.id} value={String(ct.id)}>{contractLabel(ct)}</SelectItem>;
                            })}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1 shrink-0" onClick={function() { openOverrides(user); }}>
                          <SlidersHorizontal className="h-3 w-3" />Fərdi icazələr
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="create" className="flex-1 overflow-y-auto mt-3">
            <div className="space-y-4 pr-1">
              {editingRoleId && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-blue-700">Mövcud rol redaktə olunur — dəyişikliklər bu rola bağlı BÜTÜN istifadəçilərə təsir edəcək.</p>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={function() { resetRoleForm(); }}>Ləğv et</Button>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs">Rol adı</Label>
                  <Input placeholder="Məs: Müştəri-Koordinator" value={newRoleName} onChange={function(e) { setNewRoleName(e.target.value); }} />
                </div>
                <div>
                  <Label className="text-xs">Əsas rol</Label>
                  <Select value={newRoleBase} onValueChange={function(v) { setNewRoleBase(v); setNewPerms({}); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Menecer</SelectItem>
                      <SelectItem value="lawyer">Vəkil</SelectItem>
                      <SelectItem value="client">Müştəri</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Təsvir</Label>
                <Input placeholder="Rolun təsviri" value={newRoleDesc} onChange={function(e) { setNewRoleDesc(e.target.value); }} />
              </div>

              <div className="border rounded-lg p-3 space-y-3">
                <Label className="text-xs font-semibold">İmtiyaz matrisi — {baseLabel(newRoleBase)} interfeysi</Label>
                {permGroupsForRole(newRoleBase).map(function(pg) {
                  return (
                    <div key={pg.group}>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">{pg.group}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {pg.perms.map(function(perm) {
                          var isActive = !!newPerms[perm.key];
                          return (
                            <Badge key={perm.key} variant={isActive ? "default" : "outline"} className={"cursor-pointer text-[10px] " + (isActive ? "bg-green-600" : "")} onClick={function() { togglePerm(perm.key); }}>
                              {isActive ? <CheckSquare className="h-3 w-3 mr-0.5" /> : <Square className="h-3 w-3 mr-0.5" />}
                              {perm.label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button className="w-full" onClick={handleSaveRole} disabled={!newRoleName.trim() || saving}>
                {editingRoleId ? <Save className="h-4 w-4 mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
                {saving ? "Saxlanılır..." : (editingRoleId ? "Rolu yadda saxla" : "Rol yarat")}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
