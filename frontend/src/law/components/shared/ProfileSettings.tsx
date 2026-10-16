import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { PhoneInput } from './PhoneInput';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Switch } from '../ui/switch';
import { User, Mail, Phone, MapPin, Bell, Shield, Eye, Loader2, Monitor, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { PasswordChangeModal } from './PasswordChangeModal';
import { fetchApi, uploadFile, fetchFileBlob } from '../../utils/apiHelper';
import { formatDateTime as sharedFormatDateTime } from '../../utils/dateFormat';

interface ProfileSettingsProps {
  trigger?: React.ReactNode;
  /** Verilsə (idarə olunan rejim), daxili trigger göstərilmir — modal yalnız
   * `open`/`onOpenChange` vasitəsilə açılıb-bağlanır. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function getStoredUser(): any {
  try { return JSON.parse(localStorage.getItem('law_user') || 'null'); } catch { return null; }
}

function fmtDateTime(d: any): string {
  return sharedFormatDateTime(d, '—');
}

function detectDevice(): string {
  try {
    var ua = navigator.userAgent || '';
    var browser = 'Naməlum brauzer';
    if (ua.indexOf('Edg') !== -1) browser = 'Microsoft Edge';
    else if (ua.indexOf('Chrome') !== -1) browser = 'Google Chrome';
    else if (ua.indexOf('Firefox') !== -1) browser = 'Mozilla Firefox';
    else if (ua.indexOf('Safari') !== -1) browser = 'Safari';
    var os = 'Naməlum sistem';
    if (ua.indexOf('Windows') !== -1) os = 'Windows';
    else if (ua.indexOf('Mac') !== -1) os = 'macOS';
    else if (ua.indexOf('Linux') !== -1) os = 'Linux';
    else if (ua.indexOf('Android') !== -1) os = 'Android';
    else if (ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1) os = 'iOS';
    return browser + ' · ' + os;
  } catch { return 'Naməlum cihaz'; }
}

export function ProfileSettings({ trigger, open: controlledOpen, onOpenChange }: ProfileSettingsProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? !!controlledOpen : internalOpen;
  const setOpen = (v: boolean) => { if (isControlled) { if (onOpenChange) onOpenChange(v); } else { setInternalOpen(v); } };

  const storedUser = getStoredUser();

  const [profileData, setProfileData] = useState({
    name: storedUser?.name || 'İstifadəçi',
    email: storedUser?.email || '',
    phone: storedUser?.phone || '',
    address: storedUser?.address || '',
    bio: storedUser?.bio || '',
    company: storedUser?.company_name || '',
  });
  const [avatarUrl, setAvatarUrl] = useState<string>(storedUser?.avatar || '');
  const [avatarBlobUrl, setAvatarBlobUrl] = useState<string>('');
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [lastLogin, setLastLogin] = useState<any>(storedUser?.last_login || null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Modal hər açılanda serverdən TƏZƏ məlumat çəkilir — köhnə versiyada yalnız
  // login zamanı bir dəfə localStorage-ə yazılan `law_user` istifadə olunurdu,
  // ona görə dəyişikliklər "hardcode" kimi hiss olunurdu (heç vaxt yenilənmirdi).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingProfile(true);
    fetchApi('/auth/me')
      .then((fresh: any) => {
        if (cancelled || !fresh) return;
        setProfileData({
          name: fresh.name || '',
          email: fresh.email || '',
          phone: fresh.phone || '',
          address: fresh.address || '',
          bio: fresh.bio || '',
          company: fresh.company_name || '',
        });
        setAvatarUrl(fresh.avatar || '');
        setLastLogin(fresh.last_login || fresh.LastLogin || null);
        try {
          var lu = JSON.parse(localStorage.getItem('law_user') || 'null') || {};
          localStorage.setItem('law_user', JSON.stringify(Object.assign({}, lu, fresh)));
        } catch {}
      })
      .catch(() => { /* server əlçatan deyilsə, localStorage-dəki köhnə məlumatla davam et */ })
      .finally(() => { if (!cancelled) setLoadingProfile(false); });
    return () => { cancelled = true; };
  }, [open]);

  // Server-də saxlanılan avatar sənədləri auth tələb etdiyindən (Bearer
  // header), sadə <img src="..."> işləmir — bloba çevirib göstəririk.
  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    if (avatarUrl) {
      fetchFileBlob(avatarUrl)
        .then((blobUrl) => { if (!cancelled) { objectUrl = blobUrl; setAvatarBlobUrl(blobUrl); } })
        .catch(() => { if (!cancelled) setAvatarBlobUrl(''); });
    } else {
      setAvatarBlobUrl('');
    }
    return () => { cancelled = true; if (objectUrl) { try { URL.revokeObjectURL(objectUrl); } catch {} } };
  }, [avatarUrl]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handlePickAvatar = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };
  const handleAvatarChange = async (e: any) => {
    var file = e.target.files && e.target.files[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    if (!file.type || file.type.indexOf('image/') !== 0) {
      toast.error('Zəhmət olmasa şəkil faylı seçin (JPG, PNG və ya GIF)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Şəkil 2MB-dan kiçik olmalıdır');
      return;
    }
    setUploadingAvatar(true);
    try {
      var uploaded = await uploadFile(file, file.name);
      var url = uploaded && uploaded.url;
      if (!url) throw new Error('Server fayl URL-i qaytarmadı');
      // Şəkil serverə yükləndikdən dərhal sonra profilə bağlayırıq ki, səhifə
      // yenilənsə də (F5) itməsin — "Dəyişiklikləri saxla" düyməsini gözləmədən.
      var updated = await fetchApi('/auth/me', {
        method: 'PUT',
        body: JSON.stringify({ name: profileData.name.trim() || 'İstifadəçi', phone: profileData.phone || '', avatar: url }),
      });
      setAvatarUrl(url);
      try {
        var lu = JSON.parse(localStorage.getItem('law_user') || 'null') || {};
        localStorage.setItem('law_user', JSON.stringify(Object.assign({}, lu, updated)));
      } catch {}
      toast.success('Profil şəkli yeniləndi');
    } catch (err: any) {
      toast.error('Xəta: ' + (err && err.message ? err.message : 'Şəkil yüklənmədi'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Bildiriş/təhlükəsizlik seçimləri — backend-də ayrıca sahə olmadığından
  // (SMS/Push provayderi qoşulmayıb) hər istifadəçi üçün brauzerdə yadda saxlanılır,
  // ona görə açılan-bağlanan "ölü düymə" effekti yaratmır.
  const notifKey = 'law_notif_prefs_' + (storedUser?.email || 'anon');
  const secKey = 'law_security_prefs_' + (storedUser?.email || 'anon');
  const loadPrefs = function(key: string, fallback: any) {
    try { return Object.assign({}, fallback, JSON.parse(localStorage.getItem(key) || '{}')); } catch { return fallback; }
  };

  const [notifications, setNotifications] = useState(() => loadPrefs(notifKey, {
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    taskUpdates: true,
    lawyerMessages: true
  }));

  const updateNotifications = function(patch: any) {
    var next = Object.assign({}, notifications, patch);
    setNotifications(next);
    try { localStorage.setItem(notifKey, JSON.stringify(next)); } catch {}
  };

  const [security, setSecurity] = useState(() => loadPrefs(secKey, {
    twoFactorAuth: false,
    loginNotifications: true
  }));

  const updateSecurity = function(patch: any) {
    var next = Object.assign({}, security, patch);
    setSecurity(next);
    try { localStorage.setItem(secKey, JSON.stringify(next)); } catch {}
  };

  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);

  const handleSave = async () => {
    if (!profileData.name.trim()) { toast.error('Ad Soyad boş ola bilməz'); return; }
    setSaving(true);
    try {
      var updated = await fetchApi('/auth/me', {
        method: 'PUT',
        body: JSON.stringify({
          name: profileData.name.trim(),
          phone: profileData.phone || '',
          address: profileData.address || '',
          bio: profileData.bio || '',
          company_name: profileData.company || '',
          avatar: avatarUrl || '',
        }),
      });
      // localStorage-dəki law_user-i yenilə ki, header/başqa yerlərdə də əks olunsun
      try {
        var lu = JSON.parse(localStorage.getItem('law_user') || 'null') || {};
        localStorage.setItem('law_user', JSON.stringify(Object.assign({}, lu, updated)));
      } catch {}
      toast.success('Profil məlumatları uğurla yeniləndi');
      setOpen(false);
    } catch (err: any) {
      toast.error('Xəta: ' + (err && err.message ? err.message : 'Profil yenilənmədi'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async function() {
    if (!deletePassword.trim()) { toast.error('Təsdiq üçün cari şifrənizi/kodunuzu daxil edin'); return; }
    setDeleting(true);
    try {
      await fetchApi('/auth/me', { method: 'DELETE', body: JSON.stringify({ password: deletePassword }) });
      toast.success('Hesabınız deaktiv edildi. Çıxış edilir...');
      try { localStorage.removeItem('law_token'); localStorage.removeItem('law_user'); } catch {}
      setTimeout(function() { window.location.href = '/login'; }, 1200);
    } catch (err: any) {
      toast.error('Xəta: ' + (err && err.message ? err.message : 'Hesab silinmədi'));
    } finally {
      setDeleting(false);
    }
  };

  var initials = (profileData.name || 'İ').split(' ').map(function(n) { return n[0]; }).join('').toUpperCase().slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* İdarə olunan rejimdə (open/onOpenChange xaricdən verilib) daxili trigger göstərilmir —
          əks halda səhifədə istənməyən "sərbəst" bir görüntü yaranır. */}
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || (
            <div className="flex items-center gap-3 cursor-pointer">
              <Avatar className="h-10 w-10">
                {avatarBlobUrl ? <img src={avatarBlobUrl} alt="Profil şəkli" className="h-full w-full object-cover rounded-full" /> : <AvatarFallback>{initials}</AvatarFallback>}
              </Avatar>
              <div>
                <h1 className="font-medium">{profileData.name}</h1>
                <p className="text-sm text-muted-foreground">{profileData.email}</p>
              </div>
            </div>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="overflow-y-auto max-h-[90vh]" data-modal="profile-settings">
        <DialogHeader>
          <DialogTitle>Profil Tənzimləmələri</DialogTitle>
          <DialogDescription>
            Şəxsi məlumatlarınızı, bildiriş tənzimləmələrinizi və təhlükəsizlik seçimlərinizi idarə edin
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="notifications">Bildirişlər</TabsTrigger>
            <TabsTrigger value="security">Təhlükəsizlik</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                {avatarBlobUrl ? <img src={avatarBlobUrl} alt="Profil şəkli" className="h-full w-full object-cover rounded-full" /> : <AvatarFallback className="text-xl">{initials}</AvatarFallback>}
              </Avatar>
              <div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                <Button variant="outline" size="sm" onClick={handlePickAvatar} disabled={uploadingAvatar}>
                  {uploadingAvatar && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                  {uploadingAvatar ? 'Yüklənir...' : 'Şəkil yüklə'}
                </Button>
                <p className="text-sm text-muted-foreground mt-1">
                  JPG, PNG və ya GIF formatında (maks. 2MB)
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">
                  <User className="h-4 w-4 inline mr-2" />
                  Ad Soyad
                </Label>
                <Input
                  id="name"
                  value={profileData.name}
                  disabled={loadingProfile}
                  onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Şirkət</Label>
                <Input
                  id="company"
                  value={profileData.company}
                  disabled={loadingProfile}
                  onChange={(e) => setProfileData({...profileData, company: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  <Mail className="h-4 w-4 inline mr-2" />
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  disabled
                  readOnly
                  className="opacity-70 cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">E-mail ünvanı təhlükəsizlik səbəbindən buradan dəyişdirilmir</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">
                  <Phone className="h-4 w-4 inline mr-2" />
                  Telefon
                </Label>
                <PhoneInput
                  value={profileData.phone}
                  onChange={(v) => setProfileData({...profileData, phone: v})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">
                <MapPin className="h-4 w-4 inline mr-2" />
                Ünvan
              </Label>
              <Input
                id="address"
                value={profileData.address}
                disabled={loadingProfile}
                onChange={(e) => setProfileData({...profileData, address: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bioqrafiya</Label>
              <Textarea
                id="bio"
                value={profileData.bio}
                disabled={loadingProfile}
                onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                rows={3}
              />
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    E-mail bildirişləri
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    E-mail vasitəsilə bildirişlər alın
                  </p>
                </div>
                <Switch
                  checked={notifications.emailNotifications}
                  onCheckedChange={(checked) => updateNotifications({ emailNotifications: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    SMS bildirişləri
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    SMS vasitəsilə bildirişlər alın
                  </p>
                </div>
                <Switch
                  checked={notifications.smsNotifications}
                  onCheckedChange={(checked) => updateNotifications({ smsNotifications: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Push bildirişləri
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Brauzerdə bildirişlər alın
                  </p>
                </div>
                <Switch
                  checked={notifications.pushNotifications}
                  onCheckedChange={(checked) => updateNotifications({ pushNotifications: checked })}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Tapşırıq yeniləmələri</Label>
                  <p className="text-sm text-muted-foreground">
                    Tapşırıq statusu dəyişiklikləri
                  </p>
                </div>
                <Switch
                  checked={notifications.taskUpdates}
                  onCheckedChange={(checked) => updateNotifications({ taskUpdates: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Vəkil mesajları</Label>
                  <p className="text-sm text-muted-foreground">
                    Vəkillərdən gələn mesajlar
                  </p>
                </div>
                <Switch
                  checked={notifications.lawyerMessages}
                  onCheckedChange={(checked) => updateNotifications({ lawyerMessages: checked })}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    İki faktorlu doğrulama
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Hesabınıza əlavə təhlükəsizlik qatı əlavə edin
                  </p>
                </div>
                <Switch
                  checked={security.twoFactorAuth}
                  onCheckedChange={(checked) => updateSecurity({ twoFactorAuth: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Giriş bildirişləri
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Hesabınıza giriş ediləndə bildiriş alın
                  </p>
                </div>
                <Switch
                  checked={security.loginNotifications}
                  onCheckedChange={(checked) => updateSecurity({ loginNotifications: checked })}
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <Button variant="outline" className="w-full" onClick={() => setPasswordChangeOpen(true)}>
                  Şifrəni dəyişdir
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setSessionsOpen(true)}>
                  Aktiv seansları gör
                </Button>
                <Button variant="destructive" className="w-full" onClick={() => setDeleteOpen(true)}>
                  Hesabı sil
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Ləğv et
          </Button>
          <Button onClick={handleSave} disabled={saving || loadingProfile}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Dəyişiklikləri saxla
          </Button>
        </div>
      </DialogContent>

      <PasswordChangeModal open={passwordChangeOpen} onOpenChange={setPasswordChangeOpen} mode="password" />

      {/* Aktiv seans məlumatı — real JWT-stateless arxitektura üzündən çoxlu
          cihaz siyahısı deyil, hazırkı brauzer sessiyası + son giriş tarixi göstərilir. */}
      <Dialog open={sessionsOpen} onOpenChange={setSessionsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Monitor className="h-5 w-5" />Aktiv seans</DialogTitle>
            <DialogDescription>Hesabınızla bağlı hazırkı giriş məlumatları</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-green-50 border-green-200">
              <Monitor className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Bu cihaz — hazırkı seans</p>
                <p className="text-xs text-muted-foreground">{detectDevice()}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Əvvəlki giriş</p>
                <p className="text-xs text-muted-foreground">{fmtDateTime(lastLogin)}</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Hazırda sistem yalnız hazırkı brauzer seansını izləyir. Başqa cihazlardakı seansları uzaqdan bağlamaq istəyirsinizsə, şifrənizi/kodunuzu dəyişməyiniz kifayətdir — bu, əvvəlki bütün girişləri etibarsız edir.
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setSessionsOpen(false)}>Bağla</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hesabı sil — özünü deaktiv etmə, şifrə/kod təsdiqi ilə */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) setDeletePassword(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-5 w-5" />Hesabı sil</DialogTitle>
            <DialogDescription>Bu əməliyyat hesabınızı deaktiv edir və sistemdən çıxış edəcəksiniz. Davam etmək üçün cari şifrənizi/kodunuzu daxil edin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Cari şifrə / giriş kodu</Label>
              <Input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Təsdiq üçün daxil edin" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Ləğv et</Button>
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleting || !deletePassword.trim()}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Hesabı sil
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
