"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { fetchApi } from "../../utils/apiHelper";
import { toast } from "sonner";
import { Book, Plus, Edit3, Trash2, Save, X, ChevronRight, ChevronDown, Tag, FolderTree } from "lucide-react";

var LIBRARY_TYPES = [
  { key: "status", label: "Statuslar", desc: "Kitabxanada saxlanan statuslar vəkilin 'Digər statuslar' bölümündə görünür" },
  { key: "document_category", label: "Sənəd növləri", desc: "Sənəd kateqoriyalarını idarə edin — tapşırıq yaradanda siyahıya düşür" },
  { key: "court_type", label: "Məhkəmə növləri", desc: "Məhkəmə instansiyalarını idarə edin" },
  { key: "party_role", label: "Tərəf rolları", desc: "Tərəf rolları — tapşırıqda tərəf seçimini idarə edir" },
  { key: "task_category", label: "Kateqoriyalar", desc: "Tapşırıq və müqavilə kateqoriyalarını idarə edin" },
];

// Defolt datalar — backend işləməsə belə frontend birbaşa bunları yaradır
var DEFAULT_ITEMS = {
  status: [
    { name: "Təhkim gözləyir", code: "tehkim_gozleyir" },
    { name: "Vəkil təhkim edildi", code: "tehkim_olundu" },
    { name: "Məhkəməyə göndərildi", code: "mehkemeye_gonderildi" },
    { name: "Pretenziya göndərildi", code: "pretenziya_gonderildi" },
    { name: "Məhkəmə icraata qəbul etdi", code: "mehkeme_qebul_etdi" },
    { name: "Apellyasiya şikayəti göndərildi", code: "apellyasiya_gonderildi" },
    { name: "Kassasiya şikayəti göndərildi", code: "kassasiya_gonderildi" },
    { name: "İcra məqamına göndərildi", code: "icra_meqamina_gonderildi" },
    { name: "İş yekunlaşdı", code: "is_yekunlasdi" },
  ],
  document_category: [
    { name: "İddia ərizəsi", code: "iddia_erizesi" },
    { name: "Müqavilə surəti", code: "muqavile_sureti" },
    { name: "Şəxsiyyət vəsiqəsi", code: "sexsiyyet_vesiqesi" },
    { name: "Etibarnamə", code: "etibarname" },
    { name: "Dövlət rüsumu qəbzi", code: "dovlet_rusumu" },
    { name: "Ekspertiza rəyi", code: "ekspertiza_reyi" },
    { name: "Məhkəmə qərarı", code: "mehkeme_qerari" },
    { name: "Çıxarış və arayışlar", code: "cixaris_arayis" },
  ],
  court_type: [
    { name: "Birinci instansiya məhkəməsi", code: "birinci_instansiya" },
    { name: "Apellyasiya məhkəməsi", code: "apellyasiya" },
    { name: "Kassasiya məhkəməsi", code: "kassasiya" },
    { name: "Ali Məhkəmə", code: "ali_mehkeme" },
    { name: "Konstitusiya Məhkəməsi", code: "konstitusiya" },
  ],
  party_role: [
    { name: "İddiaçı", code: "iddiaci" },
    { name: "Cavabdeh", code: "cavabdeh" },
    { name: "Ərizəçi", code: "erizeci" },
    { name: "Maraqlı şəxs", code: "maraqli_sexs" },
    { name: "Üçüncü şəxs", code: "ucuncu_sexs" },
    { name: "III şəxs", code: "ucuncu_sexs_iii" },
  ],
  task_category: [
    { name: "Lizinq", code: "lizinq" },
    { name: "Bank", code: "bank" },
    { name: "Əmək mübahisəsi", code: "emek_mubahisesi" },
    { name: "Əmlak", code: "emlak" },
    { name: "Vergi", code: "vergi" },
    { name: "Gömrük", code: "gomruk" },
    { name: "Cinayət", code: "cinayet" },
    { name: "İnzibati", code: "inzibati" },
    { name: "Ailə", code: "aile" },
    { name: "Digər", code: "diger" },
  ],
};

export function LibraryModal({ open, onOpenChange, initialTab = "status" }) {
  var [items, setItems] = useState([]);
  var [loading, setLoading] = useState(false);
  var [seeding, setSeeding] = useState(false);
  var [selectedType, setSelectedType] = useState(initialTab);
  var [editItem, setEditItem] = useState(null);
  var [newName, setNewName] = useState("");
  var [newCode, setNewCode] = useState("");
  var [expanded, setExpanded] = useState({});
  var [addingChild, setAddingChild] = useState(null);
  var [childName, setChildName] = useState("");

  var fetchItems = function() {
    setLoading(true);
    return fetchApi("/library?type=" + selectedType)
      .then(function(data) { setItems(Array.isArray(data) ? data : []); })
      .catch(function() { setItems([]); })
      .finally(function() { setLoading(false); });
  };

  useEffect(function() {
    if (open && initialTab) setSelectedType(initialTab);
  }, [open, initialTab]);

  useEffect(function() { if (open) fetchItems(); }, [open, selectedType]);

  // Defoltları bərpa et — əvvəlcə backend seed, alınmasa frontend bir-bir yazır
  var seedDefaults = async function() {
    setSeeding(true);
    var ok = false;

    // 1) Backend seed-i sına (bütün tipləri birdən yaradır)
    try {
      await fetchApi("/seed-defaults", { method: "POST" });
      ok = true;
    } catch (e) {
      ok = false;
    }

    // 2) Backend alınmadısa — hazırkı tipin defoltlarını birbaşa frontend-dən yarat
    if (!ok) {
      var defaults = DEFAULT_ITEMS[selectedType] || [];
      var created = 0;
      for (var i = 0; i < defaults.length; i++) {
        try {
          await fetchApi("/library", {
            method: "POST",
            body: JSON.stringify({
              type: selectedType,
              name: defaults[i].name,
              code: defaults[i].code,
            }),
          });
          created++;
        } catch (err) {
          // bu element artıq var ola bilər — keç
        }
      }
      if (created > 0) ok = true;
    }

    if (ok) {
      toast.success("Defolt elementlər yaradıldı");
    } else {
      toast.error("Defoltlar yaradıla bilmədi — backend bağlantısını yoxlayın");
    }

    await fetchItems();
    setSeeding(false);
  };

  var handleCreate = async function() {
    if (!newName.trim()) return;
    try {
      await fetchApi("/library", {
        method: "POST",
        body: JSON.stringify({ type: selectedType, name: newName.trim(), code: newCode.trim() || newName.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^\w]/g, "") }),
      });
      setNewName(""); setNewCode("");
      toast.success("Element yaradıldı");
      fetchItems();
    } catch { toast.error("Xəta"); }
  };

  var handleCreateChild = async function(parentId) {
    if (!childName.trim()) return;
    try {
      await fetchApi("/library", {
        method: "POST",
        body: JSON.stringify({ type: selectedType, name: childName.trim(), parent_id: parentId, code: childName.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^\w]/g, "") }),
      });
      setChildName(""); setAddingChild(null);
      toast.success("Alt element yaradıldı");
      fetchItems();
    } catch { toast.error("Xəta"); }
  };

  var handleUpdate = async function(id, name) {
    try {
      await fetchApi("/library/" + id, { method: "PUT", body: JSON.stringify({ name: name }) });
      setEditItem(null);
      toast.success("Yeniləndi");
      fetchItems();
    } catch { toast.error("Xəta"); }
  };

  // BUG DÜZƏLİŞİ (2026-09): silmə heç bir təsdiq olmadan dərhal icra olunurdu —
  // bu elementlər mövcud tapşırıq/müqavilələr tərəfindən istinad edilə bilər.
  var handleDelete = async function(id, name) {
    if (!confirm((name ? '"' + name + '"' : 'Bu') + ' elementini silmək istədiyinizə əminsiniz? Bu element mövcud qeydlərdə istifadə olunursa, nəticə xəta ola bilər.')) return;
    try {
      await fetchApi("/library/" + id, { method: "DELETE" });
      toast.success("Silindi");
      fetchItems();
    } catch { toast.error("Xəta"); }
  };

  var toggleExpand = function(id) {
    var copy = Object.assign({}, expanded);
    copy[id] = !copy[id];
    setExpanded(copy);
  };

  var renderItem = function(item, depth) {
    var isExp = expanded[item.id];
    var hasChildren = item.children && item.children.length > 0;
    var isEditing = editItem && editItem.id === item.id;
    var isStatusType = selectedType === "status";
    return (
      <div key={item.id} style={{ marginLeft: depth * 20 }}>
        <div className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/50 group">
          {hasChildren ? (
            <button onClick={function() { toggleExpand(item.id); }} className="shrink-0">
              {isExp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : <Tag className="h-4 w-4 text-muted-foreground shrink-0" />}
          {isEditing ? (
            <div className="flex-1 flex gap-1">
              <Input className="h-7 text-sm flex-1" value={editItem.name} onChange={function(e) { setEditItem(Object.assign({}, editItem, { name: e.target.value })); }} />
              <Button size="sm" className="h-7 px-2" onClick={function() { handleUpdate(editItem.id, editItem.name); }}><Save className="h-3 w-3" /></Button>
              <Button variant="outline" size="sm" className="h-7 px-2" onClick={function() { setEditItem(null); }}><X className="h-3 w-3" /></Button>
            </div>
          ) : (
            <span className="flex-1 text-sm font-medium">{item.name}</span>
          )}
          {item.code && <Badge variant="outline" className="text-[9px] shrink-0">{item.code}</Badge>}
          {isStatusType && depth === 0 && <Badge variant="outline" className="text-[9px] shrink-0 border-indigo-200 text-indigo-600">Vəkil panelində görünür</Badge>}
          <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity shrink-0">
            <button className="p-1 rounded hover:bg-blue-100" onClick={function() { setAddingChild(item.id); setChildName(""); }} title="Alt element əlavə et"><Plus className="h-3 w-3 text-blue-600" /></button>
            <button className="p-1 rounded hover:bg-amber-100" onClick={function() { setEditItem({ id: item.id, name: item.name }); }} title="Redaktə et"><Edit3 className="h-3 w-3 text-amber-600" /></button>
            <button className="p-1 rounded hover:bg-red-100" onClick={function() { handleDelete(item.id, item.name); }} title="Sil"><Trash2 className="h-3 w-3 text-red-500" /></button>
          </div>
        </div>
        {addingChild === item.id && (
          <div className="flex gap-1 my-1" style={{ marginLeft: (depth + 1) * 20 }}>
            <Input className="h-7 text-sm flex-1" placeholder="Alt element adı" value={childName} onChange={function(e) { setChildName(e.target.value); }} />
            <Button size="sm" className="h-7 text-xs" onClick={function() { handleCreateChild(item.id); }}>Əlavə et</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={function() { setAddingChild(null); }}>Ləğv</Button>
          </div>
        )}
        {isExp && hasChildren && (<div>{item.children.map(function(child) { return renderItem(child, depth + 1); })}</div>)}
      </div>
    );
  };

  var currentType = LIBRARY_TYPES.find(function(t) { return t.key === selectedType; });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 !flex !flex-col overflow-hidden">
        <div className="px-6 pt-5 pb-3 border-b shrink-0 pr-12">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Book className="h-5 w-5 text-blue-600" />Konfiqurasiya kitabxanası</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Sistem parametrlərini, statusları, sənəd növlərini və kateqoriyaları idarə edin</p>
        </div>

        <div className="flex gap-1.5 flex-wrap shrink-0 px-6 pt-3">
          {LIBRARY_TYPES.map(function(lt) {
            return (
              <button key={lt.key} className={"px-3 py-1.5 rounded-full text-xs font-medium transition-all " + (selectedType === lt.key ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80")} onClick={function() { setSelectedType(lt.key); }}>
                {lt.label}
              </button>
            );
          })}
        </div>

        {currentType && <p className="text-xs text-muted-foreground shrink-0 px-6">{currentType.desc}</p>}

        <div className="flex gap-2 shrink-0 px-6">
          <Input className="flex-1 h-9" placeholder="Yeni element adı" value={newName} onChange={function(e) { setNewName(e.target.value); }} />
          <Input className="w-28 h-9" placeholder="Kod" value={newCode} onChange={function(e) { setNewCode(e.target.value); }} />
          <Button className="h-9" onClick={handleCreate} disabled={!newName.trim()}><Plus className="h-4 w-4 mr-1" />Əlavə et</Button>
          <Button variant="outline" className="h-9" onClick={seedDefaults} disabled={seeding}>{seeding ? "Yüklənir..." : "Defoltlar"}</Button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 border rounded-lg p-2 mx-6 mb-4">
          {loading ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Yüklənir...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderTree className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Bu kateqoriyada element yoxdur</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={seedDefaults} disabled={seeding}>{seeding ? "Yüklənir..." : "Defolt elementləri yarat"}</Button>
            </div>
          ) : (
            items.map(function(item) { return renderItem(item, 0); })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}