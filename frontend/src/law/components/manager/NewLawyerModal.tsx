"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { toast } from "sonner";
import {
  UserPlus, Save, Loader2, Key, Copy, CheckCircle, RefreshCw, Briefcase,
} from "lucide-react";
import { PhoneInput } from "../shared/PhoneInput";

var API_BASE = '/api';

interface NewLawyerModalProps {
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  onLawyerCreated?: (lawyer: any) => void;
  onSuccess?: (title: string, message: string) => void;
  tenantId?: any;
}

var SPECIALIZATIONS = [
  "Mülki hüquq", "Əmək hüququ", "Ailə hüququ", "Cinayət hüququ",
  "Kommersiya hüququ", "İnzibati hüquq", "Vergi hüququ", "Gömrük hüququ",
  "Torpaq hüququ", "Əqli mülkiyyət", "Sığorta hüququ", "Digər",
];

function generateInitialCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

// Direct API call (the office comes from the address)
async function createLawyerApi(tenantId: any, body: any): Promise<any> {
  var token = '';
  try { token = localStorage.getItem('law_token') || ''; } catch(e) {}

  var base = token ? API_BASE + '/sf' : API_BASE;
  var url = base + '/lawyers';

  var headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  var res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    var errText = await res.text().catch(function() { return 'API Error'; });
    throw new Error(errText || 'API Error: ' + res.status);
  }
  return res.json();
}

export function NewLawyerModal({ open, onClose, onOpenChange, onLawyerCreated, onSuccess, tenantId }: NewLawyerModalProps) {
  var [name, setName] = useState("");
  var [email, setEmail] = useState("");
  var [phone, setPhone] = useState("");
  var [specializations, setSpecializations] = useState<string[]>([]);
  var [experience, setExperience] = useState("");
  var [licenseNumber, setLicenseNumber] = useState("");
  var [initialCode, setInitialCode] = useState(generateInitialCode());

  var [saving, setSaving] = useState(false);
  var [showCredentials, setShowCredentials] = useState(false);
  var [createdName, setCreatedName] = useState("");
  var [createdEmail, setCreatedEmail] = useState("");
  var [createdCode, setCreatedCode] = useState("");
  var [emailCopied, setEmailCopied] = useState(false);
  var [codeCopied, setCodeCopied] = useState(false);
  var [bothCopied, setBothCopied] = useState(false);

  var handleClose = function() {
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
    setShowCredentials(false);
  };

  var resetForm = function() {
    setName(""); setEmail(""); setPhone(""); setSpecializations([]);
    setExperience(""); setLicenseNumber(""); setInitialCode(generateInitialCode());
    setShowCredentials(false);
    setEmailCopied(false); setCodeCopied(false); setBothCopied(false);
  };

  var toggleSpecialization = function(s: string) {
    setSpecializations(function(prev) {
      return prev.includes(s) ? prev.filter(function(x) { return x !== s; }) : prev.concat([s]);
    });
  };

  var handleSubmit = async function() {
    if (!name.trim() || !email.trim()) { toast.error("Ad və e-poçt tələb olunur"); return; }
    if (!initialCode.trim() || initialCode.trim().length < 4) {
      toast.error("İlkin kod ən azı 4 simvol olmalıdır"); return;
    }
    setSaving(true);
    try {
      var body = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        specializations: specializations,
        experience: experience ? parseInt(experience) : 0,
        license_number: licenseNumber.trim(),
        status: "active",
        password: initialCode.trim(),
      };
      var result = await createLawyerApi(tenantId, body);

      setCreatedName(name.trim());
      setCreatedEmail(email.trim());
      setCreatedCode(initialCode.trim());
      setShowCredentials(true);

      if (onLawyerCreated) onLawyerCreated(result);
    } catch (err: any) {
      console.error('Create lawyer error:', err);
      toast.error("Vəkil yaradılmadı: " + (err.message || "Xəta baş verdi"));
    } finally { setSaving(false); }
  };

  var copyText = function(text: string, setFlag: (b: boolean) => void) {
    navigator.clipboard.writeText(text).then(function() {
      setFlag(true);
      toast.success('Kopyalandı');
      setTimeout(function() { setFlag(false); }, 3000);
    }).catch(function() { toast.error('Kopyalama uğursuz oldu'); });
  };

  var copyBoth = function() {
    var text = 'E-mail: ' + createdEmail + '\nİlkin kod: ' + createdCode;
    copyText(text, setBothCopied);
  };

  var handleDone = function() {
    if (onSuccess) onSuccess('Vəkil yaradıldı', createdName + ' vəkili sistemə əlavə edildi');
    resetForm();
    handleClose();
  };

  if (showCredentials) {
    return (
      <Dialog open={open} onOpenChange={function(o) { if (!o) { resetForm(); handleClose(); } }}>
        <DialogContent className="max-w-md">
          <div className="text-center py-2">
            <div className="mx-auto w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3">
              <CheckCircle className="h-7 w-7 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold mb-1">Vəkil yaradıldı</h2>
            <p className="text-sm text-muted-foreground">
              <strong>{createdName}</strong> sistemə əlavə edildi
            </p>
          </div>

          <Card className="border-blue-200 bg-blue-50 mt-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
                <Key className="h-4 w-4" />Vəkilə bunları göndərin
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-blue-700">
                Vəkil bu e-poçt və kodla sistemə daxil olacaq və daxil olduqdan sonra şifrəsini dəyişə bilər.
              </p>

              <div>
                <Label className="text-xs text-blue-800">E-poçt</Label>
                <div className="flex items-center gap-1.5 mt-1">
                  <Input value={createdEmail} readOnly className="text-sm bg-white font-mono" />
                  <Button size="sm" variant={emailCopied ? 'default' : 'outline'} className="shrink-0" type="button"
                    onClick={function() { copyText(createdEmail, setEmailCopied); }}>
                    {emailCopied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs text-blue-800">İlkin kod (şifrə)</Label>
                <div className="flex items-center gap-1.5 mt-1">
                  <Input value={createdCode} readOnly className="text-base bg-white font-mono font-semibold tracking-wider" />
                  <Button size="sm" variant={codeCopied ? 'default' : 'outline'} className="shrink-0" type="button"
                    onClick={function() { copyText(createdCode, setCodeCopied); }}>
                    {codeCopied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <Button variant={bothCopied ? 'default' : 'secondary'} className="w-full" size="sm" type="button" onClick={copyBoth}>
                {bothCopied ? <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {bothCopied ? 'Hər ikisi kopyalandı' : 'E-poçt və kodu birlikdə kopyala'}
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-3">
            <Button onClick={handleDone} type="button">Bağla</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={function(o) { if (!o) { resetForm(); handleClose(); } }}>
      <DialogContent className="max-w-lg w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />Yeni vəkil hesabı
          </DialogTitle>
          <DialogDescription>
            Vəkil profilini yaradın və ona giriş kodunu verin
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="h-4 w-4" />Vəkil məlumatları
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Ad, soyad *</Label>
                <Input placeholder="Məs: Əli Məmmədov" value={name}
                  onChange={function(e) { setName(e.target.value); }} />
              </div>

              <div className="space-y-2">
                <Label>E-poçt *</Label>
                <Input type="email" placeholder="vekil@firma.az" value={email}
                  onChange={function(e) { setEmail(e.target.value); }} />
              </div>

              <div className="space-y-2">
                <Label>Telefon</Label>
                <PhoneInput value={phone} onChange={setPhone} />
              </div>

              <div className="space-y-2">
                <Label>İxtisas (birdən çox seçmək olar)</Label>
                <div className="flex flex-wrap gap-1.5 border rounded-lg p-2">
                  {SPECIALIZATIONS.map(function(s) {
                    var active = specializations.includes(s);
                    return (
                      <button key={s} type="button"
                        className={"text-xs px-2.5 py-1 rounded-full border transition-colors " + (active ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 text-gray-600 hover:border-blue-400")}
                        onClick={function() { toggleSpecialization(s); }}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Təcrübə (il)</Label>
                  <Input type="number" placeholder="0" value={experience}
                    onChange={function(e) { setExperience(e.target.value); }} />
                </div>
                <div className="space-y-2">
                  <Label>Vəkil vəsiqə nömrəsi</Label>
                  <Input placeholder="Vəsiqə nömrəsi" value={licenseNumber}
                    onChange={function(e) { setLicenseNumber(e.target.value); }} />
                </div>
              </div>

              <div className="space-y-2 p-3 border rounded-lg bg-amber-50 border-amber-200">
                <Label className="flex items-center gap-1 text-amber-900">
                  <Key className="h-3.5 w-3.5" />İlkin kod (giriş şifrəsi) *
                </Label>
                <p className="text-[11px] text-amber-700">
                  Vəkil bu kodu e-poçtla birlikdə işlədib sistemə daxil olacaq
                </p>
                <div className="flex items-center gap-2">
                  <Input value={initialCode}
                    onChange={function(e) { setInitialCode(e.target.value.toUpperCase()); }}
                    className="font-mono font-semibold tracking-wider bg-white" maxLength={32} />
                  <Button variant="outline" size="sm" className="shrink-0" type="button"
                    onClick={function() { setInitialCode(generateInitialCode()); }}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />Yenisi
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="px-6 py-4 border-t bg-white flex justify-between gap-2 shrink-0">
          <Button variant="outline" type="button" onClick={function() { resetForm(); handleClose(); }}>
            Ləğv et
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            {saving ? 'Yaradılır...' : 'Vəkil yarat'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}