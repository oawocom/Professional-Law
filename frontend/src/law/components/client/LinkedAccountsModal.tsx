'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { fetchApi } from '../../utils/apiHelper';
import { toast } from 'sonner';
import { Users, User, Save, X, SlidersHorizontal, Mail, Phone, Loader2 } from 'lucide-react';

// Hüquqi şəxsin öz bağlı Fərdi hesabları üçün rol/icazə idarəetmə mərkəzi —
// menecerin "Rolların idarəedilməsi" pəncərəsindəki "Fərdi icazələr" panelinin
// eyni forması, YALNIZ bu Hüquqi şəxsin özünə bağlı hesablar üzərində işləyir.
var CLIENT_PERMISSIONS = [
  { group: 'Mənim hesabım', perms: [
    { key: 'view_clients', label: 'Profili görmək' },
    { key: 'edit_clients', label: 'Profili redaktə etmək' },
  ]},
  { group: 'Vəkillər', perms: [
    { key: 'view_lawyers', label: 'Vəkil performansını görmək' },
  ]},
  { group: 'Müqavilələr', perms: [
    { key: 'view_contracts', label: 'Görmək' },
  ]},
  { group: 'Tapşırıqlar', perms: [
    { key: 'view_tasks', label: 'Görmək' },
    { key: 'create_tasks', label: 'Yeni tapşırıq yaratmaq' },
  ]},
  { group: 'Sənədlər', perms: [
    { key: 'upload_documents', label: 'Yükləmək' },
  ]},
  { group: 'Maliyyə', perms: [
    { key: 'view_amounts', label: 'Məbləğləri görmək' },
  ]},
];

interface LinkedAccountsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkedAccountsModal({ open, onOpenChange }: LinkedAccountsModalProps) {
  var [items, setItems] = useState<any[]>([]);
  var [loading, setLoading] = useState(false);

  var [overrideId, setOverrideId] = useState<number | null>(null);
  var [overrideDraft, setOverrideDraft] = useState<any>({});
  var [savingOverride, setSavingOverride] = useState(false);

  var fetchItems = function() {
    setLoading(true);
    fetchApi('/my-linked-clients').then(function(data: any) {
      setItems(Array.isArray(data) ? data : []);
    }).catch(function() { setItems([]); }).finally(function() { setLoading(false); });
  };

  useEffect(function() { if (open) fetchItems(); }, [open]);

  var openOverrides = function(item: any) {
    setOverrideId(item.id);
    setOverrideDraft(Object.assign({}, (item.user && item.user.permission_overrides) || {}));
  };
  var closeOverrides = function() { setOverrideId(null); setOverrideDraft({}); };

  var cycleOverride = function(key: string) {
    var copy = Object.assign({}, overrideDraft);
    if (!(key in copy)) copy[key] = true;
    else if (copy[key] === true) copy[key] = false;
    else delete copy[key];
    setOverrideDraft(copy);
  };

  var saveOverrides = async function() {
    if (!overrideId) return;
    setSavingOverride(true);
    try {
      await fetchApi('/my-linked-clients/' + overrideId + '/permissions', {
        method: 'PUT',
        body: JSON.stringify({ permission_overrides: overrideDraft }),
      });
      toast.success('Fərdi icazələr yadda saxlanıldı');
      closeOverrides();
      fetchItems();
    } catch (err: any) {
      toast.error('Xəta: ' + (err && err.message ? err.message : 'Yadda saxlanmadı'));
    } finally {
      setSavingOverride(false);
    }
  };

  var overrideItem = items.find(function(i: any) { return i.id === overrideId; });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Bağlı hesabların idarəedilməsi</DialogTitle>
          <DialogDescription>Hüquqi şəxsə bağlı Fərdi hesabları görün və hər biri üçün fərdi icazələr təyin edin</DialogDescription>
        </DialogHeader>

        {overrideId ? (
          <div className="flex-1 min-h-0 overflow-y-auto mt-3 space-y-3 pr-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" />Fərdi icazələr — {overrideItem ? overrideItem.name : ''}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Bu düymələr yalnız bu hesaba təsir edir, digər bağlı hesablara toxunmur.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeOverrides}><X className="h-4 w-4" /></Button>
            </div>
            <div className="border rounded-lg p-3 space-y-3">
              {CLIENT_PERMISSIONS.map(function(pg) {
                return (
                  <div key={pg.group}>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1">{pg.group}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {pg.perms.map(function(perm) {
                        var val = overrideDraft[perm.key];
                        var state = val === true ? 'on' : val === false ? 'off' : 'inherit';
                        var cls = state === 'on' ? 'bg-green-600' : state === 'off' ? 'bg-red-600' : '';
                        var text = state === 'on' ? 'Açıq' : state === 'off' ? 'Bağlı' : 'Defolt';
                        return (
                          <Badge key={perm.key} variant={state === 'inherit' ? 'outline' : 'default'} className={'cursor-pointer text-[10px] ' + cls} onClick={function() { cycleOverride(perm.key); }}>
                            {perm.label} · {text}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <Button className="w-full" onClick={saveOverrides} disabled={savingOverride}>
              {savingOverride && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-1.5" />Fərdi icazələri yadda saxla
            </Button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto mt-3 space-y-2 pr-1">
            <p className="text-[11px] text-muted-foreground">
              Yeni bağlı hesab yaratmaq üçün menecerlə əlaqə saxlayın — bu əməliyyat yalnız menecer panelindən icra olunur.
            </p>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Yüklənir...</p>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Hələ bağlı Fərdi hesab yoxdur</p>
              </div>
            ) : items.map(function(item: any) {
              var overrideCount = item.user ? Object.keys(item.user.permission_overrides || {}).length : 0;
              return (
                <Card key={item.id}>
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          {item.email && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" />{item.email}</span>}
                          {item.phone && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{item.phone}</span>}
                          {item.is_archived && <Badge className="text-[8px] bg-gray-200 text-gray-700 h-4">Deaktiv</Badge>}
                          {overrideCount > 0 && <Badge className="text-[8px] bg-violet-100 text-violet-700 h-4 gap-0.5"><SlidersHorizontal className="h-2.5 w-2.5" />{overrideCount} fərdi icazə</Badge>}
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1 shrink-0" onClick={function() { openOverrides(item); }} disabled={!item.user}>
                      <SlidersHorizontal className="h-3 w-3" />İcazələr
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
