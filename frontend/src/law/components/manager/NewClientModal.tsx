import { fetchApi } from '../../utils/apiHelper';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  User, Building2, Plus, X, Save, Loader2, Copy, CheckCircle, Key, RefreshCw, ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { PhoneInput } from '../shared/PhoneInput';

interface NewClientModalProps {
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  onClientCreated?: (client: any) => void;
  onSuccess?: (title: string, message: string) => void;
  editClient?: any;
  onClientUpdated?: (client: any) => void;
  // Verilibsə, bu modal birbaşa "bağlı Fərdi hesab yarat" rejimində açılır —
  // tip seçimi ekranı ötürülür (həmişə individual), yaradılan hesab bu Hüquqi
  // şəxsə (parentClientId) bağlanır. Yalnız yeni-hesab rejimində istifadə olunur.
  parentClientId?: number | string | null;
  parentClientName?: string;
}

var industries = [
  'Ticarət', 'IT', 'İnşaat', 'Maliyyə', 'Energetika', 'Səhiyyə',
  'Ekoloji texnologiya', 'Kənd təsərrüfatı', 'Avtomobil xidməti',
  'Tekstil', 'Turizm', 'Təhsil', 'Media', 'Logistika', 'Dövlət orqanı', 'Digər',
];

function generateInitialCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function normalizeType(t: string): string {
  // "company" köhnə dəyərdir — geriyə uyğunluq üçün "legal"a bərabər tutulur
  if (t === 'company' || t === 'legal') return 'legal';
  return 'individual';
}

export function NewClientModal({ open, onClose, onOpenChange, onClientCreated, onSuccess, editClient, onClientUpdated, parentClientId, parentClientName }: NewClientModalProps) {
  var isEditMode = !!editClient;
  var isLinkedCreate = !isEditMode && !!parentClientId;
  var [submitting, setSubmitting] = useState(false);
  var [showCredentials, setShowCredentials] = useState(false);
  var [createdClientName, setCreatedClientName] = useState('');
  var [createdClientEmail, setCreatedClientEmail] = useState('');
  var [createdCode, setCreatedCode] = useState('');
  var [emailCopied, setEmailCopied] = useState(false);
  var [codeCopied, setCodeCopied] = useState(false);
  var [bothCopied, setBothCopied] = useState(false);

  // Tip-birinci axın: yeni müştəri yaradılarkən ƏVVƏLCƏ Hüquqi/Fiziki şəxs seçilir,
  // yalnız sonra müvafiq sahələr göstərilir. Redaktə rejimində mövcud tip saxlanılır
  // və seçim ekranı ötürülür. Bağlı hesab yaradılarkən (parentClientId verilib) tip
  // seçimi də ötürülür — bağlı hesab həmişə Fiziki şəxs (individual) olur.
  var [clientType, setClientType] = useState<string>(isEditMode ? normalizeType(editClient.type) : (isLinkedCreate ? 'individual' : ''));

  var blankForm = function() {
    return {
      name: '', company: '', email: '', phones: [''], companyPhones: [''],
      address: '', industry: '', taxNumber: '', contactPerson: '', description: '',
      initialCode: '',
    };
  };

  var formFromClient = function(client: any) {
    var notes: string = client.notes || '';
    var industry = '';
    var companyPhones = [''];
    var descLines: string[] = [];
    notes.split('\n').forEach(function(line: string) {
      var m1 = line.match(/^Sahəsi:\s*(.*)$/);
      var m2 = line.match(/^Qurum tel:\s*(.*)$/) || line.match(/^Şirkət tel:\s*(.*)$/);
      if (m1) { industry = m1[1].trim(); }
      else if (m2) { companyPhones = m2[1].split(',').map(function(s: string) { return s.trim(); }).filter(Boolean); if (!companyPhones.length) companyPhones = ['']; }
      else if (line.trim()) { descLines.push(line); }
    });
    var phones = (client.phone || '').split(',').map(function(s: string) { return s.trim(); }).filter(Boolean);
    return {
      name: client.name || '',
      company: client.company_name || client.companyName || client.company || '',
      email: client.email || '',
      phones: phones.length ? phones : [''],
      companyPhones: companyPhones,
      address: client.address || '',
      industry: industry,
      taxNumber: client.tax_number || client.taxNumber || '',
      contactPerson: client.contact_person || client.contactPerson || '',
      description: descLines.join('\n'),
      initialCode: '',
    };
  };

  var [formData, setFormData] = useState(isEditMode ? formFromClient(editClient) : blankForm());

  useEffect(function() {
    if (isEditMode && editClient) { setFormData(formFromClient(editClient)); setClientType(normalizeType(editClient.type)); }
    else if (!isEditMode) { setFormData(blankForm()); setClientType(isLinkedCreate ? 'individual' : ''); }
  }, [editClient && editClient.id, open, parentClientId]);

  var closeModal = function() {
    if (onClose) onClose();
    if (onOpenChange) onOpenChange(false);
    setShowCredentials(false);
  };

  var resetForm = function() {
    setFormData(isEditMode && editClient ? formFromClient(editClient) : blankForm());
    setClientType(isEditMode && editClient ? normalizeType(editClient.type) : (isLinkedCreate ? 'individual' : ''));
    setShowCredentials(false);
    setEmailCopied(false); setCodeCopied(false); setBothCopied(false);
  };

  var isLegal = clientType === 'legal';

  var handleSubmit = async function() {
    if (!formData.name.trim()) { toast.error(isLegal ? 'Qurumun/Şirkətin adının yazıldığı Ad Soyad (məsul şəxs) sahəsi tələb olunur' : 'Ad Soyad daxil edilməlidir'); return; }
    if (!formData.email.trim()) { toast.error('E-mail daxil edilməlidir'); return; }
    if (isLegal) {
      if (!formData.company.trim()) { toast.error('Qurumun/Şirkətin adı tələb olunur'); return; }
      if (!formData.taxNumber.trim()) { toast.error('VÖEN/Qeydiyyat nömrəsi tələb olunur'); return; }
      if (!formData.contactPerson.trim()) { toast.error('Əlaqədar şəxs tələb olunur'); return; }
    }
    if (!isEditMode && (!formData.initialCode.trim() || formData.initialCode.trim().length < 4)) {
      toast.error('İlkin kod ən azı 4 simvol olmalıdır (özünüz təyin edin və ya "Yenisi" düyməsi ilə yaradın)'); return;
    }

    var validPhones = formData.phones.filter(function(p) { return p.trim() !== ''; });
    setSubmitting(true);
    try {
      var companyPhonesStr = formData.companyPhones.filter(function(p) { return p.trim(); }).join(', ');
      var noteParts: string[] = [];
      if (formData.description.trim()) noteParts.push(formData.description.trim());
      if (isLegal && companyPhonesStr) noteParts.push('Qurum tel: ' + companyPhonesStr);
      if (isLegal && formData.industry) noteParts.push('Sahəsi: ' + formData.industry);

      if (isEditMode) {
        var updateBody: any = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: validPhones.join(', '),
          address: formData.address.trim(),
          notes: noteParts.join('\n'),
        };
        if (isLegal) {
          updateBody.company_name = formData.company.trim();
          updateBody.tax_number = formData.taxNumber.trim();
          updateBody.contact_person = formData.contactPerson.trim();
        }
        var updated = await fetchApi('/clients/' + editClient.id, { method: 'PUT', body: JSON.stringify(updateBody) });
        toast.success('Müştəri məlumatları yeniləndi');
        if (onClientUpdated) onClientUpdated(updated.client || updated);
        closeModal();
        return;
      }

      var body: any = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: validPhones.join(', '),
        address: formData.address.trim(),
        type: clientType,
        notes: noteParts.join('\n'),
        status: 'active',
        password: formData.initialCode.trim(),
      };
      if (isLegal) {
        body.company_name = formData.company.trim();
        body.tax_number = formData.taxNumber.trim();
        body.contact_person = formData.contactPerson.trim();
      }
      if (isLinkedCreate) {
        body.parent_client_id = Number(parentClientId);
      }
      var result = await fetchApi('/clients', { method: 'POST', body: JSON.stringify(body) });
      var clientData = result.client || result;

      setCreatedClientName(formData.name.trim());
      setCreatedClientEmail(formData.email.trim());
      setCreatedCode(formData.initialCode.trim());
      setShowCredentials(true);

      if (onClientCreated) onClientCreated(clientData);
    } catch (err: any) {
      console.error('Create client error:', err);
      var serverMsg = err.message || '';
      try { var p = JSON.parse(serverMsg); if (p.error) serverMsg = p.error; } catch { /* raw string */ }
      toast.error(serverMsg || (isEditMode ? 'Müştəri yenilənmədi' : 'Müştəri yaradılmadı'));
    } finally { setSubmitting(false); }
  };

  var copyText = function(text: string, setFlag: (b: boolean) => void) {
    navigator.clipboard.writeText(text).then(function() {
      setFlag(true);
      toast.success('Kopyalandı');
      setTimeout(function() { setFlag(false); }, 3000);
    }).catch(function() { toast.error('Kopyalama uğursuz oldu'); });
  };

  var copyBoth = function() {
    var text = 'E-mail: ' + createdClientEmail + '\nİlkin kod: ' + createdCode;
    copyText(text, setBothCopied);
  };

  var handleDone = function() {
    if (onSuccess) onSuccess('Müştəri yaradıldı', createdClientName + ' müştərisi sistemə əlavə edildi');
    resetForm(); closeModal();
  };

  // ============== UĞUR EKRANI ==============
  if (showCredentials) {
    return (
      <Dialog open={open} onOpenChange={function(isOpen) { if (!isOpen) { resetForm(); closeModal(); } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col">
          <div className="px-6 pt-6 pb-2 text-center">
            <div className="mx-auto w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3">
              <CheckCircle className="h-7 w-7 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold mb-1">Müştəri yaradıldı</h2>
            <p className="text-sm text-muted-foreground">
              <strong>{createdClientName}</strong> sistemə əlavə edildi
            </p>
          </div>

          <div className="px-6 pb-4">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
                  <Key className="h-4 w-4" />Müştəriyə bunları göndərin
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-blue-700">
                  Müştəri bu e-poçt və kodla sistemə daxil ola bilər. Daxil olduqdan sonra şifrəsini dəyişə bilər.
                </p>

                <div>
                  <Label className="text-xs text-blue-800">E-poçt</Label>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Input value={createdClientEmail} readOnly className="text-sm bg-white font-mono" />
                    <Button size="sm" variant={emailCopied ? 'default' : 'outline'} className="shrink-0" type="button"
                      onClick={function() { copyText(createdClientEmail, setEmailCopied); }}>
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
          </div>

          <div className="px-6 py-4 border-t flex justify-end shrink-0">
            <Button onClick={handleDone} type="button">Bağla</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ============== TİP SEÇİMİ (yalnız yeni müştəri yaradılarkən, bağlı hesab yaradılarkən ötürülür) ==============
  if (!isEditMode && !isLinkedCreate && !clientType) {
    return (
      <Dialog open={open} onOpenChange={function(isOpen) { if (!isOpen) { resetForm(); closeModal(); } }}>
        <DialogContent className="max-w-md" data-modal="new-client-type">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><User className="h-5 w-5" />Yeni müştəri hesabı</DialogTitle>
            <DialogDescription>Əvvəlcə müştərinin növünü seçin</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-2">
            <button type="button" onClick={function() { setClientType('individual'); }}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors text-left">
              <div className="h-11 w-11 rounded-lg bg-blue-100 flex items-center justify-center shrink-0"><User className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="font-medium text-sm">Fiziki şəxs</p>
                <p className="text-xs text-muted-foreground">Bir fərdi müştəri hesabı</p>
              </div>
            </button>
            <button type="button" onClick={function() { setClientType('legal'); }}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 transition-colors text-left">
              <div className="h-11 w-11 rounded-lg bg-amber-100 flex items-center justify-center shrink-0"><Building2 className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="font-medium text-sm">Hüquqi şəxs</p>
                <p className="text-xs text-muted-foreground">Qurum/Şirkət hesabı — sonra ona bağlı fərdi hesablar əlavə edə bilərsiniz</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ============== ƏSAS FORMA ==============
  return (
    <Dialog open={open} onOpenChange={function(isOpen) { if (!isOpen) { resetForm(); closeModal(); } }}>
      <DialogContent
        className="max-w-3xl w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col"
        data-modal="new-client"
      >
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {!isEditMode && !isLinkedCreate && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 -ml-1" type="button" onClick={function() { setClientType(''); }}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {isLegal ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
            {isEditMode ? 'Müştəri məlumatlarını redaktə et' : isLinkedCreate ? 'Yeni bağlı Fərdi hesab' : (isLegal ? 'Yeni Hüquqi şəxs hesabı' : 'Yeni Fiziki şəxs hesabı')}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Müştəri profilinin məlumatlarını yeniləyin'
              : isLinkedCreate
                ? (parentClientName ? parentClientName + ' hüquqi şəxsinə bağlı yeni Fərdi hesab yaradın' : 'Bu Hüquqi şəxsə bağlı yeni Fərdi hesab yaradın')
                : 'Müştəri profilini yaradın və ona giriş kodunu verin'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <div className={'grid grid-cols-1 gap-4 ' + (isLegal ? 'lg:grid-cols-2' : 'max-w-xl mx-auto')}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" />{isLegal ? 'Məsul şəxsin məlumatları' : 'Şəxsi məlumatlar'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Ad Soyad *</Label>
                  <Input id="name" value={formData.name}
                    onChange={function(e) { setFormData(Object.assign({}, formData, { name: e.target.value })); }}
                    placeholder={isLegal ? 'Qurum adından çıxış edən şəxsin adı' : 'Müştərinin tam adı'} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input id="email" type="email" value={formData.email}
                    onChange={function(e) { setFormData(Object.assign({}, formData, { email: e.target.value })); }}
                    placeholder="email@example.com" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Telefon</Label>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" type="button"
                      onClick={function() {
                        setFormData(Object.assign({}, formData, { phones: formData.phones.concat(['']) }));
                      }}>
                      <Plus className="h-3 w-3 mr-1" />Əlavə et
                    </Button>
                  </div>
                  {formData.phones.map(function(phone, index) { return (
                    <div key={index} className="flex items-center gap-2">
                      <PhoneInput className="flex-1" value={phone}
                        onChange={function(v) {
                          var newPhones = formData.phones.slice();
                          newPhones[index] = v;
                          setFormData(Object.assign({}, formData, { phones: newPhones }));
                        }} />
                      {formData.phones.length > 1 && (
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0" type="button"
                          onClick={function() {
                            setFormData(Object.assign({}, formData, {
                              phones: formData.phones.filter(function(_, i) { return i !== index; })
                            }));
                          }}>
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ); })}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Ünvan</Label>
                  <Textarea id="address" value={formData.address}
                    onChange={function(e) { setFormData(Object.assign({}, formData, { address: e.target.value })); }}
                    placeholder="Tam ünvan" rows={2} />
                </div>

                {!isEditMode && (
                  <div className="space-y-2 p-3 border rounded-lg bg-amber-50 border-amber-200">
                    <Label className="flex items-center gap-1 text-amber-900">
                      <Key className="h-3.5 w-3.5" />İlkin kod (giriş şifrəsi) *
                    </Label>
                    <p className="text-[11px] text-amber-700">
                      Kodu özünüz təyin edin (ən azı 4 simvol) — istəsəniz "Yenisi" ilə təsadüfi kod yarada bilərsiniz
                    </p>
                    <div className="flex items-center gap-2">
                      <Input value={formData.initialCode}
                        onChange={function(e) {
                          setFormData(Object.assign({}, formData, { initialCode: e.target.value.toUpperCase() }));
                        }}
                        placeholder="Kodu daxil edin"
                        className="font-mono font-semibold tracking-wider bg-white" maxLength={32} />
                      <Button variant="outline" size="sm" className="shrink-0" type="button"
                        onClick={function() {
                          setFormData(Object.assign({}, formData, { initialCode: generateInitialCode() }));
                        }}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />Yenisi
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {isLegal && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4" />Qurum/Şirkət məlumatları
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">Qurumun/Şirkətin adı *</Label>
                    <Input id="company" value={formData.company}
                      onChange={function(e) { setFormData(Object.assign({}, formData, { company: e.target.value })); }}
                      placeholder="Dövlət qurumu, şirkət və ya təşkilat adı" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="taxNumber">VÖEN / Qeydiyyat nömrəsi *</Label>
                    <Input id="taxNumber" value={formData.taxNumber}
                      onChange={function(e) { setFormData(Object.assign({}, formData, { taxNumber: e.target.value })); }}
                      placeholder="Vergi ödəyicisinin və ya qurumun qeydiyyat nömrəsi" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactPerson">Əlaqədar şəxs *</Label>
                    <Input id="contactPerson" value={formData.contactPerson}
                      onChange={function(e) { setFormData(Object.assign({}, formData, { contactPerson: e.target.value })); }}
                      placeholder="Qurumdakı əlaqədar şəxs" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Qurum telefonu</Label>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" type="button"
                        onClick={function() {
                          setFormData(Object.assign({}, formData, { companyPhones: formData.companyPhones.concat(['']) }));
                        }}>
                        <Plus className="h-3 w-3 mr-1" />Əlavə et
                      </Button>
                    </div>
                    {formData.companyPhones.map(function(phone, index) { return (
                      <div key={index} className="flex items-center gap-2">
                        <PhoneInput className="flex-1" value={phone}
                          onChange={function(v) {
                            var newPhones = formData.companyPhones.slice();
                            newPhones[index] = v;
                            setFormData(Object.assign({}, formData, { companyPhones: newPhones }));
                          }} />
                        {formData.companyPhones.length > 1 && (
                          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0" type="button"
                            onClick={function() {
                              setFormData(Object.assign({}, formData, {
                                companyPhones: formData.companyPhones.filter(function(_, i) { return i !== index; })
                              }));
                            }}>
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ); })}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="industry">Fəaliyyət sahəsi</Label>
                    <Select value={formData.industry}
                      onValueChange={function(value) { setFormData(Object.assign({}, formData, { industry: value })); }}>
                      <SelectTrigger><SelectValue placeholder="Sahə seçin" /></SelectTrigger>
                      <SelectContent>
                        {industries.map(function(industry) {
                          return <SelectItem key={industry} value={industry}>{industry}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Əlavə qeydlər</Label>
                    <Textarea id="description" value={formData.description}
                      onChange={function(e) { setFormData(Object.assign({}, formData, { description: e.target.value })); }}
                      placeholder="Müştəri haqqında əlavə məlumatlar" rows={2} />
                  </div>
                </CardContent>
              </Card>
            )}

            {!isLegal && (
              <div className="space-y-2 lg:col-span-1">
                <Label htmlFor="description2">Əlavə qeydlər</Label>
                <Textarea id="description2" value={formData.description}
                  onChange={function(e) { setFormData(Object.assign({}, formData, { description: e.target.value })); }}
                  placeholder="Müştəri haqqında əlavə məlumatlar" rows={2} />
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-white flex items-center justify-between shrink-0">
          <Button variant="outline" onClick={closeModal} disabled={submitting} type="button">
            Ləğv et
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} type="button">
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isEditMode ? 'Yadda saxla' : 'Müştəri yarat'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
