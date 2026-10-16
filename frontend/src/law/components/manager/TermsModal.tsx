import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Shield, 
  Clock,
  User,
  Lock,
  XCircle,
  Mail
} from 'lucide-react';

interface TermsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgree?: () => void;
  showAgreementCheckbox?: boolean;
}

export function TermsModal({ open, onOpenChange, onAgree, showAgreementCheckbox = false }: TermsModalProps) {
  const [agreed, setAgreed] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  useEffect(() => {
    if (!open) {
      setAgreed(false);
      setHasScrolledToBottom(false);
    }
  }, [open]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrolledToBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    if (scrolledToBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAgree = () => {
    if (onAgree) {
      onAgree();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col" data-modal="terms">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Sistem Qaydaları və Şərtləri
          </DialogTitle>
          <DialogDescription>
            Müştəri dashboard sistemindən istifadə qaydaları və şərtləri
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto pr-4" onScroll={handleScroll}>
          <div className="space-y-6 pb-4">
              {/* Ümumi Qaydalar */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-500" />
                    Ümumi Qaydalar
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <p>Sistemdən istifadə edərkən dürüst və düzgün məlumat təqdim etməlisiniz.</p>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <p>Bütün tapşırıqlar manager icazəsi ilə yaradılır və idarə olunur.</p>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <p>Şəxsi məlumatlarınızın təhlükəsizliyi təmin edilir və üçüncü şəxslərlə paylaşılmır.</p>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <p>Sistemdən sui-istifadə edilməsi qadağandır və hesabın bağlanmasına səbəb ola bilər.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Tapşırıq İdarəetməsi */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-500" />
                    Tapşırıq İdarəetməsi Qaydaları
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <p><strong>Tapşırıq yaratma:</strong> Yeni tapşırıq yaratmaq üçün manager təsdiqi tələb olunur.</p>
                  </div>
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <p><strong>Tapşırıq dəyişikliyi:</strong> Tapşırığın prioriteti və son tarixini dəyişmək üçün manager təsdiqi lazımdır.</p>
                  </div>
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <p><strong>Tapşırığın geri götürülməsi:</strong> Aktiv tapşırıqları geri götürmək mümkündür, lakin manager təsdiqi tələb olunur.</p>
                  </div>
                  <div className="flex gap-2">
                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p><strong>Tamamlanan işlər:</strong> Tamamlanan işləri geri götürmək, ləğv etmək və ya dəyişdirmək mümkün deyil.</p>
                  </div>
                  <div className="flex gap-2">
                    <Clock className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p><strong>Manager cavabı:</strong> Manager təsdiq tələblərinə qısa müddətdə cavab verilir.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Sənəd İdarəetməsi */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-green-500" />
                    Sənəd İdarəetməsi Qaydaları
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <p>Sənədlər yalnız PDF, DOC, DOCX, JPG, PNG, XLSX formatlarında yüklənə bilər.</p>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <p>Hər bir sənədin maksimum ölçüsü 10 MB olmalıdır.</p>
                  </div>
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <p>Sənədləri dəyişdirmək və ya silmək üçün manager icazəsi lazımdır.</p>
                  </div>
                  <div className="flex gap-2">
                    <Lock className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p>Yüklənmiş sənədlər şifrələnmiş şəkildə saxlanılır və təhlükəsizdir.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Vəkillər və Əlaqə */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-indigo-500" />
                    Vəkillər və Əlaqə Qaydaları
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <p>Təyin olunmuş vəkillərlə birbaşa chat vasitəsilə əlaqə saxlaya bilərsiniz.</p>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <p>Chat məlumatları qeydə alınır və məxfilik qorunur.</p>
                  </div>
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <p>Vəkillərlə qarşılıqlı hörmət və peşəkarlıq mühitində ünsiyyət qurulmalıdır.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Məxfilik və Təhlükəsizlik */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock className="h-4 w-4 text-red-500" />
                    Məxfilik və Təhlükəsizlik
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex gap-2">
                    <Shield className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p>Şəxsi məlumatlarınız SSL şifrələməsi ilə qorunur.</p>
                  </div>
                  <div className="flex gap-2">
                    <Shield className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p>Hesabınıza giriş şifrəsi güclü olmalı və başqaları ilə paylaşılmamalıdır.</p>
                  </div>
                  <div className="flex gap-2">
                    <Shield className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p>Şübhəli fəaliyyət aşkar edildikdə dərhal sistemə bildiriş verilməlidir.</p>
                  </div>
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <p>Sistem PII (Şəxsiyyəti Müəyyənləşdirən Məlumat) toplamaq və ya saxlamaq üçün nəzərdə tutulmayıb.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Bildirişlər */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Bildiriş Qaydaları
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <p>Bildirişlər yalnız tapşırıq detallarına baxıldıqda oxunmuş kimi işarələnir.</p>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <p>Vacib bildirişlər e-poçt və ya SMS vasitəsilə də göndərilə bilər.</p>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <p>Bildiriş tənzimləmələrini profil ayarlarından idarə edə bilərsiniz.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Məsuliyyət Məhdudiyyətləri */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-500" />
                    Məsuliyyət Məhdudiyyətləri
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p><strong>Sənəd məsuliyyəti:</strong> Sistemə əlavə olunmayan sənədlərə və ya digər qeydlərə görə hüquqi dəstək göstərən konsultant şirkət məsuliyyət daşımır. Müştəri bütün lazımi sənədlərin vaxtında və düzgün şəkildə sistemə yüklənməsindən məsuldur.</p>
                  </div>
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <p><strong>Geri götürülmüş işlər:</strong> Geri götürülmüş işlər icra mərhələsindən asılı olaraq qarşılıqlı razılıq əsasında şirkət tərəfindən icra olunmuş olaraq qəbul oluna bilər. Bu halda müştəri yerinə yetirilmiş xidmətlər üçün ödəniş etməli ola bilər.</p>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p><strong>Ödəniş şərtləri:</strong> Xidmətlər üzrə ödəniş şərtləri və tariflər ayrıca müqavilə ilə tənzimlənir.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Sistem Çatışmazlıqları */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Sistem Çatışmazlıqları və Texniki Dəstək
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <p><strong>Texniki problemlər:</strong> Sistemlə bağlı çatışmazlıqlar və ya texniki problemlər yarandıqda müştəri dərhal konsultant şirkətlə birbaşa əlaqə saxlamalıdır.</p>
                  </div>
                  <div className="flex gap-2">
                    <Mail className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p><strong>Alternativ ünsiyyət:</strong> Sistem əlçatan olmadıqda və ya sənəd yüklənməsi mümkün olmadıqda, müştəri məlumatları digər vasitələrlə - e-poçt, WhatsApp və ya digər razılaşdırılmış üsullarla göndərməlidir.</p>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <p><strong>Texniki dəstək:</strong> Texniki dəstək komandası ilə əlaqə üçün sistemdə göstərilən əlaqə məlumatlarından istifadə edin.</p>
                  </div>
                  <div className="flex gap-2">
                    <Clock className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p><strong>Cavab müddəti:</strong> Texniki dəstək sorğularına iş günləri ərzində ən qısa müddətdə cavab verilir.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Xəbərdarlıq */}
              <Card className="bg-orange-50 border-orange-200">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />
                    <div className="space-y-2 text-sm text-orange-900">
                      <p className="font-semibold">Diqqət!</p>
                      <p>Bu sistem hüquqi xidmətlər üçün nəzərdə tutulub. Sistemdən istifadə edərkən yuxarıdakı qaydalarla razılaşdığınızı təsdiq edirsiniz.</p>
                      <p>Qaydaların pozulması hesabın məhdudlaşdırılması və ya bağlanması ilə nəticələnə bilər.</p>
                      <p className="mt-3 font-medium">Müştəri öz öhdəliklərini yerinə yetirməlidir və sistemə lazımi məlumatları vaxtında yükləməlidir. Əks halda, konsultant şirkət prosesdə yarana biləcək gecikmələrə görə məsuliyyət daşımır.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Separator />

              <div className="space-y-4 pt-4">
                {showAgreementCheckbox && (
                  <div className="flex items-start space-x-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Checkbox
                      id="terms-agree"
                      checked={agreed}
                      onCheckedChange={(checked) => setAgreed(!!checked)}
                      disabled={!hasScrolledToBottom}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor="terms-agree"
                        className="text-sm cursor-pointer"
                      >
                        <span className="font-medium">Oxudum və razılaşıram</span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {!hasScrolledToBottom 
                            ? 'Razılaşmaq üçün əvvəlcə bütün şərtləri oxuyun (aşağı scroll edin)'
                            : 'Yuxarıdakı bütün qaydalar və şərtlərlə razılaşıram'}
                        </p>
                      </Label>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">
                    Son yenilənmə: 14 Oktyabr 2025
                  </p>
                  {showAgreementCheckbox ? (
                    <Button 
                      onClick={handleAgree}
                      disabled={!agreed}
                    >
                      Təsdiq et və davam et
                    </Button>
                  ) : (
                    <Button onClick={() => onOpenChange(false)}>
                      Başa düşdüm
                    </Button>
                  )}
                </div>
              </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}