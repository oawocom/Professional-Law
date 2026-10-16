'use client';
import { useState, useEffect } from 'react';
import { LogOut, User, Mail, Phone, Building2, MapPin, Calendar, Edit2, Save, X, Briefcase, Archive, Menu } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { NotificationDropdown } from '../shared/NotificationDropdown';
import { PasswordChangeModal } from '../shared/PasswordChangeModal';
import { fetchApi } from '../../utils/apiHelper';
import { formatDate as sharedFormatDate } from '../../utils/dateFormat';
import { toast } from 'sonner';

interface DashboardHeaderProps {
  tenantId?: number | null;
  archivedCount?: number;
  onOpenSettings?: () => void;
  onOpenArchive?: () => void;
  onOpenReports?: () => void;
  notifications?: any[];
  onViewTask?: (taskId: string) => void;
  onViewAllNotifications?: () => void;
}

export function DashboardHeader({ tenantId, onOpenArchive, onViewTask, onViewAllNotifications }: DashboardHeaderProps) {
  var [profileOpen, setProfileOpen] = useState(false);
  var [editing, setEditing] = useState(false);
  var [clientData, setClientData] = useState<any>(null);
  var [editForm, setEditForm] = useState<any>({});
  var [saving, setSaving] = useState(false);
  var [codeChangeOpen, setCodeChangeOpen] = useState(false);

  // Get user from localStorage
  var user: any = null;
  try { user = JSON.parse(localStorage.getItem('law_user') || 'null'); } catch {}
  var userName = user?.name || 'Müştəri';
  var userEmail = user?.email || '';
  var userRole = user?.role || 'client';
  var clientId = user?.client_id || user?.clientId || null;
  var initials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  // Fetch client details when profile opens
  useEffect(function() {
    if (!profileOpen || !clientId) return;
    fetchApi('/clients/' + clientId)
      .then(function(data: any) {
        setClientData(data);
        setEditForm({
          phone: data.phone || '',
          address: data.address || '',
          contact_person: data.contact_person || '',
        });
      })
      .catch(function() {});
  }, [profileOpen, clientId]);

  var handleSave = async function() {
    if (!clientId) return;
    setSaving(true);
    try {
      await fetchApi('/clients/' + clientId, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      setClientData({ ...clientData, ...editForm });
      setEditing(false);
      toast.success('Məlumatlar yeniləndi');
    } catch (err: any) {
      toast.error('Xəta baş verdi');
    } finally {
      setSaving(false);
    }
  };

  var handleLogout = function() {
    localStorage.removeItem('law_token');
    localStorage.removeItem('law_user');
    window.location.href = '/login';
  };

  var cd = clientData || {};
  var companyName = cd.company_name || cd.companyName || '';
  var clientType = cd.type || 'individual';
  var phone = cd.phone || '';
  var address = cd.address || '';
  var taxNumber = cd.tax_number || cd.taxNumber || '';
  var contactPerson = cd.contact_person || cd.contactPerson || '';
  var createdAt = cd.created_at || cd.createdAt || '';

  return (
    <>
      {/* Header — QEYD (2026-09, ana səhifə modernləşdirməsi): əvvəllər parlaq mavi
          qradiyent idi; indi digər iki interfeyslə (menecer, vəkil) eyni təmiz/neytral
          üslub, müştəri rolu isə avatarın mavi halqası və "Müştəri" etiketinin rəngi
          ilə fərqləndirilir — sistemlər arası vizual ardıcıllıq üçün. */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 justify-between">
          {/* Sol tərəf: profil (yuxarı-sol) */}
          <button className="flex items-center gap-2 shrink-0 rounded-xl pl-1 pr-2 sm:pr-3 py-1 hover:bg-slate-100 transition-colors" onClick={function() { setProfileOpen(true); }} title="Profilim">
            <Avatar className="h-9 w-9 shadow-sm ring-2 ring-blue-400/60">
              <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white text-sm">{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden sm:block text-left leading-tight">
              <p className="text-sm font-semibold text-slate-800 max-w-[160px] truncate">{userName}</p>
              <p className="text-[11px] text-blue-600 font-medium">Müştəri</p>
            </div>
          </button>

          {/* Sağ tərəf: əməliyyatlar + menyu */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {onOpenArchive && (
              <Button variant="outline" size="sm" className="gap-1.5 border-slate-200" onClick={onOpenArchive}>
                <Archive className="h-4 w-4" /><span className="hidden sm:inline">Arxiv</span>
              </Button>
            )}
            <Separator orientation="vertical" className="h-6 bg-slate-200 hidden sm:block" />
            <NotificationDropdown tenantId={tenantId} userId={clientId} userType="client" onViewTask={onViewTask} onViewAllNotifications={onViewAllNotifications} />
            <Separator orientation="vertical" className="h-6 bg-slate-200 hidden sm:block" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="border-slate-200" title="Menyu">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={function() { setProfileOpen(true); }}>
                  <User className="mr-2 h-4 w-4" />Profilim
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />Çıxış
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Profile Modal */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> Mənim Profilim
            </DialogTitle>
            <DialogDescription>Şəxsi məlumatlarınız və hesab parametrləri</DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-4 pr-2">
              {/* User card */}
              <Card className="border-2 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="text-xl bg-blue-100 text-blue-700">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{userName}</h3>
                      <p className="text-sm text-muted-foreground">{userEmail}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={cd.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {cd.status === 'active' ? 'Aktiv' : cd.status || 'Aktiv'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {clientType === 'company' ? 'Şirkət' : 'Fiziki şəxs'}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={function() { setEditing(!editing); }}>
                      {editing ? <><X className="h-4 w-4 mr-1" />Ləğv</> : <><Edit2 className="h-4 w-4 mr-1" />Redaktə</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Contact info */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <h4 className="text-sm font-semibold">Əlaqə məlumatları</h4>

                  {editing ? (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Telefon</Label>
                        <Input value={editForm.phone || ''} onChange={function(e) { setEditForm({ ...editForm, phone: e.target.value }); }} placeholder="Telefon nömrəsi" />
                      </div>
                      <div>
                        <Label className="text-xs">Ünvan</Label>
                        <Input value={editForm.address || ''} onChange={function(e) { setEditForm({ ...editForm, address: e.target.value }); }} placeholder="Ünvan" />
                      </div>
                      <div>
                        <Label className="text-xs">Əlaqə şəxsi</Label>
                        <Input value={editForm.contact_person || ''} onChange={function(e) { setEditForm({ ...editForm, contact_person: e.target.value }); }} placeholder="Əlaqə şəxsi" />
                      </div>
                      <Button onClick={handleSave} disabled={saving} className="w-full">
                        <Save className="h-4 w-4 mr-2" />{saving ? 'Saxlanılır...' : 'Yadda saxla'}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <InfoRow icon={Mail} label="E-poçt" value={userEmail} />
                      <InfoRow icon={Phone} label="Telefon" value={phone || '-'} />
                      {companyName && <InfoRow icon={Building2} label="Şirkət" value={companyName} />}
                      {address && <InfoRow icon={MapPin} label="Ünvan" value={address} />}
                      {taxNumber && <InfoRow icon={Briefcase} label="VÖEN" value={taxNumber} />}
                      {contactPerson && <InfoRow icon={User} label="Əlaqə şəxsi" value={contactPerson} />}
                      {createdAt && <InfoRow icon={Calendar} label="Qeydiyyat" value={fmtDate(createdAt)} />}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Security */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h4 className="text-sm font-semibold">Təhlükəsizlik</h4>
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Giriş kodunu dəyiş</p>
                      <p className="text-xs text-muted-foreground">Hesabınızın təhlükəsizliyi üçün giriş kodunuzu dəyişin</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={function() { setCodeChangeOpen(true); }}>
                      Dəyiş
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <PasswordChangeModal open={codeChangeOpen} onOpenChange={setCodeChangeOpen} mode="code" />
    </>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div><p className="text-[10px] text-muted-foreground">{label}</p><p className="text-sm font-medium">{value}</p></div>
    </div>
  );
}

function fmtDate(d: any): string {
  return sharedFormatDate(d, '-');
}