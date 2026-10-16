import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Progress } from '../ui/progress';
import { Input } from '../ui/input';
import { PhoneInput } from '../shared/PhoneInput';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  TrendingUp, 
  FileText, 
  MessageSquare,
  Star,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit,
  Trash2,
  UserMinus,
  UserPlus,
  BarChart3,
  Target,
  Award,
  DollarSign,
  Plus,
  Save,
  X
} from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchApi } from '../../utils/apiHelper';
import { formatDateRelative } from '../../utils/dateFormat';
import { LawyerReassignDeleteDialog } from './LawyerReassignDeleteDialog';

interface Lawyer {
  id: string;
  name: string;
  email: string;
  specialization: string;
  experience: string;
  activeTasks: number;
  completedCases: number;
  clientSatisfaction: number;
  efficiency: number;
  status: 'active' | 'inactive';
  workload: 'high' | 'medium' | 'low';
  lastActive: string;
  phone: string;
  degree: string;
  joinDate: string;
}

interface LawyerManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lawyer: Lawyer | null;
  onRefresh?: () => void;
  allLawyers?: any[];
  /** BUG DÜZƏLİŞİ (2026-09): əvvəllər "Tapşırıq ver" düyməsi sadəcə uğur
   * bildirişi göstərib heç nə etmirdi. İndi, ötürülübsə, real tapşırıq
   * yaratma axınını açır (ManagerDashboard-da artıq mövcud olan, amma
   * heç bir yerdən çağırılmayan `taskCreationOpenForLawyer` axını). */
  onAssignTask?: (lawyer: Lawyer) => void;
}

// parseJsonField - backend jsonb sahələri (education/career_history/
// certifications/languages/achievements) ya artıq array, ya da JSON-encoded
// string kimi gələ bilər.
function parseJsonField(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v) {
    try { var parsed = JSON.parse(v); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
}

// getLawyerEducationData - vəkilin REAL (backend-dən gələn) təhsil/karyera
// məlumatlarını oxuyur. Əvvəllər bura yalnız iki sabit vəkil ID-si (1 və 2)
// üçün əldən yazılmış saxta məlumat qaytarırdı və bu, HƏR vəkilin (öz real
// məlumatları olsa belə) profilində göstərilirdi. İndi Lawyer modelinin öz
// education/career_history/certifications/languages/achievements
// sahələrindən oxuyur.
const getLawyerEducationData = (lawyer: any) => {
  if (!lawyer) {
    return { education: [], certifications: [], careerHistory: [], languages: [], awards: [] };
  }
  return {
    education: parseJsonField(lawyer.education),
    certifications: parseJsonField(lawyer.certifications),
    careerHistory: parseJsonField(lawyer.careerHistory || lawyer.career_history),
    languages: parseJsonField(lawyer.languages),
    awards: parseJsonField(lawyer.awards || lawyer.achievements),
  };
};

// getLawyerStats - vəkilin REAL performans/say göstəricilərini normallaşdırır.
// BUG DÜZƏLİŞİ (2026-09): `activeTasks`, `completedCases`, `efficiency`,
// `clientSatisfaction`, `degree`, `experience`, `joinDate`, `lastActive`, `workload`
// sahələri yalnız `dataMappers.ts`-dəki `mapLawyer()` tərəfindən doldurulur, LAKİN
// bu funksiya real data axınında (`useData.ts`) heç vaxt çağırılmır — backend
// bu sahələri "xam" (snake_case, məs. `active_cases`) formada göndərir və bəziləri
// (`efficiency`, `clientSatisfaction`, `workload`, `lastActive`, `degree`) backend-də
// heç mövcud deyil. Nəticədə bu panel real menecerə "undefined%" performans
// göstəriciləri və "Invalid Date" qoşulma tarixi göstərirdi. İndi real sahələrdən
// (active_cases/completed_cases/rating/updated_at/created_at/education) hesablanır —
// `getLawyerEducationData`-dakı eyni normallaşdırma nümunəsi ilə.
const getLawyerStats = (lawyer: any) => {
  if (!lawyer) {
    return { activeTasks: 0, completedCases: 0, efficiency: 0, clientSatisfaction: 0, degree: '', experience: '0 il', joinDate: '', workload: 'low' as 'high' | 'medium' | 'low', lastActive: 'Bilinmir' };
  }
  var completedCases = Number(lawyer.completedCases ?? lawyer.completed_cases ?? 0);
  var activeTasks = Number(lawyer.activeTasks ?? lawyer.active_cases ?? 0);
  var totalCases = completedCases + activeTasks;
  // Effektivlik: real tamamlanma nisbəti (iş tarixçəsi yoxdursa neytral defolt)
  var efficiency = (lawyer.efficiency !== undefined && lawyer.efficiency !== null)
    ? Number(lawyer.efficiency)
    : (totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 80);
  var rating = Number(lawyer.rating ?? 4);
  var clientSatisfaction = (lawyer.clientSatisfaction !== undefined && lawyer.clientSatisfaction !== null)
    ? Number(lawyer.clientSatisfaction)
    : Math.round(rating * 20);
  var workload: 'high' | 'medium' | 'low' = lawyer.workload || (activeTasks > 6 ? 'high' : activeTasks > 3 ? 'medium' : 'low');
  var expRaw = lawyer.experience;
  var experience = (typeof expRaw === 'string' && expRaw.indexOf('il') !== -1) ? expRaw : (expRaw ? String(expRaw) + ' il' : '0 il');
  var edu = parseJsonField(lawyer.education);
  var degree = lawyer.degree || (edu.length > 0 ? (edu[0]?.degree || '') : '');
  var joinDate = lawyer.joinDate || lawyer.created_at || '';
  var lastActive = lawyer.lastActive || formatDateRelative(lawyer.updated_at, 'Bilinmir');
  return { activeTasks, completedCases, efficiency, clientSatisfaction, degree, experience, joinDate, workload, lastActive };
};

export function LawyerManagementModal({ open, onOpenChange, lawyer, onRefresh, allLawyers = [], onAssignTask }: LawyerManagementModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editedLawyer, setEditedLawyer] = useState<Lawyer | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTasks, setReassignTasks] = useState<any[]>([]);

  if (!lawyer) return null;

  const stats = getLawyerStats(lawyer);

  // Initialize edited lawyer when editing starts
  const startEditing = () => {
    setEditedLawyer({ ...lawyer, ...stats });
    setIsEditing(true);
    setActiveTab('edit');
  };

  const cancelEditing = () => {
    setEditedLawyer(null);
    setIsEditing(false);
    setActiveTab('overview');
  };

  const [savingChanges, setSavingChanges] = useState(false);

  const saveChanges = async () => {
    if (!editedLawyer) return;
    setSavingChanges(true);
    try {
      // "experience" bu formada "5 il" kimi mətn ola bilər — backend int gözləyir,
      // ona görə rəqəm hissəsini çıxarırıq.
      var expNum = parseInt(String(editedLawyer.experience).replace(/[^0-9]/g, ''), 10);
      await fetchApi('/lawyers/' + editedLawyer.id, {
        method: 'PUT',
        body: JSON.stringify({
          name: editedLawyer.name,
          email: editedLawyer.email,
          phone: editedLawyer.phone,
          specialization: editedLawyer.specialization,
          experience: isNaN(expNum) ? 0 : expNum,
          status: editedLawyer.status,
        }),
      });
      toast.success(`${editedLawyer.name} vəkilinin məlumatları yeniləndi`);
      setIsEditing(false);
      setActiveTab('overview');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Update lawyer error:', err);
      toast.error('Yadda saxlanılmadı: ' + (err && err.message ? err.message : 'Xəta baş verdi'));
    } finally {
      setSavingChanges(false);
    }
  };

  const deleteLawyer = async () => {
    if (!confirm(`${lawyer.name} vəkilini silmək istədiyinizə əminsiniz? Bu əməliyyat geri alına bilməz.`)) return;
    try {
      await fetchApi('/lawyers/' + lawyer.id, { method: 'DELETE' });
      toast.success(`${lawyer.name} vəkili silindi`);
      onOpenChange(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      try {
        const parsed = JSON.parse(err.message || '{}');
        if (parsed && parsed.pending_tasks) {
          setReassignTasks(parsed.pending_tasks);
          setReassignOpen(true);
          return;
        }
      } catch { /* JSON deyil */ }
      console.error('Delete lawyer error:', err);
      toast.error('Vəkil silinmədi');
    }
  };

  const handleReassignConfirm = async (reassignments: Record<string, number>) => {
    try {
      await fetchApi('/lawyers/' + lawyer.id, { method: 'DELETE', body: JSON.stringify({ reassignments }) });
      toast.success(`${lawyer.name} vəkili silindi, tapşırıqlar yenidən təhkim edildi`);
      setReassignOpen(false);
      onOpenChange(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Reassign+delete lawyer error:', err);
      toast.error('Əməliyyat uğursuz oldu');
    }
  };

  const getWorkloadColor = (workload: string) => {
    switch (workload) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleEdit = () => {
    startEditing();
  };

  // BUG DÜZƏLİŞİ (2026-09): əvvəllər bu iki funksiya sadəcə "uğur oldu" bildirişi
  // göstərib faktiki HEÇ NƏ etmirdi (yalançı-müsbət UX). "Chat" indi vəkilin
  // e-poçtuna real mailto: keçidi açır (telefon varsa, ona alternativ olaraq
  // göstərilir); "Tapşırıq ver" isə valideynə (ManagerDashboard) ötürülübsə,
  // artıq mövcud olan (amma əvvəllər heç bir yerdən çağırılmayan) tapşırıq
  // yaratma axınını açır.
  const handleMessage = () => {
    if (lawyer.email) {
      window.location.href = 'mailto:' + lawyer.email;
    } else if (lawyer.phone) {
      toast.info('Bu vəkilin e-poçt ünvanı qeyd olunmayıb. Telefon: ' + lawyer.phone);
    } else {
      toast.error('Bu vəkil üçün əlaqə məlumatı qeyd olunmayıb.');
    }
  };

  const handleAssignTask = () => {
    if (onAssignTask) {
      onAssignTask(lawyer);
    } else {
      toast.error('Tapşırıq yaratma funksiyası mövcud deyil.');
    }
  };

  const [togglingStatus, setTogglingStatus] = useState(false);

  const handleToggleStatus = async () => {
    var nextStatus = lawyer.status === 'active' ? 'inactive' : 'active';
    setTogglingStatus(true);
    try {
      await fetchApi('/lawyers/' + lawyer.id, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      toast.success(`${lawyer.name} vəkili ${nextStatus === 'active' ? 'aktiv' : 'deaktiv'} edildi`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Toggle lawyer status error:', err);
      toast.error('Status dəyişdirilmədi: ' + (err && err.message ? err.message : 'Xəta baş verdi'));
    } finally {
      setTogglingStatus(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[90vw] w-[90vw] max-h-[90vh] overflow-hidden flex flex-col"
        data-modal="lawyer-management"
      >
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">
                  {lawyer.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div>
                  <DialogTitle className="text-xl">{lawyer.name}</DialogTitle>
                  <DialogDescription className="text-base">
                    {lawyer.specialization} • {stats.experience} təcrübə
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={lawyer.status === 'active' ? 'default' : 'secondary'}>
                    {lawyer.status === 'active' ? 'Aktiv' : 'Qeyri-aktiv'}
                  </Badge>
                  <Badge className={getWorkloadColor(stats.workload)}>
                    İş yükü: {stats.workload === 'high' ? 'Yüksək' :
                             stats.workload === 'medium' ? 'Orta' : 'Aşağı'}
                  </Badge>
                  <Badge variant="outline">{stats.experience} təcrübə</Badge>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button variant="default" size="sm" onClick={saveChanges} disabled={savingChanges}>
                    {savingChanges ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Yadda saxla
                  </Button>
                  <Button variant="outline" size="sm" onClick={cancelEditing} disabled={savingChanges}>
                    <X className="h-4 w-4 mr-1" />
                    Ləğv et
                  </Button>
                  <Button variant="destructive" size="sm" onClick={deleteLawyer} disabled={savingChanges}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Sil
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={handleEdit}>
                    <Edit className="h-4 w-4 mr-1" />
                    Redaktə et
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleMessage}>
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Chat
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleAssignTask}>
                    <FileText className="h-4 w-4 mr-1" />
                    Tapşırıq ver
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggleStatus}
                    disabled={togglingStatus}
                    className={lawyer.status === 'active' ? 'text-red-600' : 'text-green-600'}
                  >
                    {togglingStatus ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : (lawyer.status === 'active' ? <UserMinus className="h-4 w-4 mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />)}
                    {lawyer.status === 'active' ? 'Deaktiv et' : 'Aktiv et'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
          <TabsList className={`grid w-full ${isEditing ? 'grid-cols-5' : 'grid-cols-4'}`}>
            <TabsTrigger value="overview" disabled={isEditing}>Ümumi</TabsTrigger>
            <TabsTrigger value="education" disabled={isEditing}>Təhsil və Karyera</TabsTrigger>
            <TabsTrigger value="reviews" disabled={isEditing}>Rəylər</TabsTrigger>
            <TabsTrigger value="settings" disabled={isEditing}>Tənzimləmələr</TabsTrigger>
            {isEditing && <TabsTrigger value="edit">Redaktə et</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="mt-6 overflow-hidden">
            <ScrollArea className="h-[600px] w-full pr-4">
              <div className="space-y-6">
                {/* Professional Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Peşəkar Xülasə
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">İxtisas sahəsi</h4>
                        <p className="font-semibold">{lawyer.specialization}</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">Peşəkar təcrübə</h4>
                        <p className="font-semibold">{stats.experience}</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">Təhsil səviyyəsi</h4>
                        <p className="font-semibold">{stats.degree || 'Qeyd olunmayıb'}</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">Hazırkı status</h4>
                        <Badge variant={lawyer.status === 'active' ? 'default' : 'secondary'}>
                          {lawyer.status === 'active' ? 'Aktiv' : 'Qeyri-aktiv'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Contact & Basic Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Əlaqə Məlumatları
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{lawyer.email}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{lawyer.phone}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Qoşulma: {stats.joinDate ? new Date(stats.joinDate).toLocaleDateString('az-AZ') : 'Bilinmir'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Son fəaliyyət: {stats.lastActive}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                {/* Performance Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Performans Göstəriciləri
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Tamamlanan işlər</span>
                          <span className="font-medium">{stats.completedCases}</span>
                        </div>
                        <Progress value={(stats.completedCases / 250) * 100} className="h-2" />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Effektivlik</span>
                          <span className="font-medium">{stats.efficiency}%</span>
                        </div>
                        <Progress value={stats.efficiency} className="h-2" />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Müştəri məmnuniyyəti</span>
                          <span className="font-medium">{stats.clientSatisfaction}%</span>
                        </div>
                        <Progress value={stats.clientSatisfaction} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Current Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Hazırkı Vəziyyət
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{stats.activeTasks}</div>
                        <p className="text-xs text-muted-foreground">Aktiv</p>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-orange-600">{stats.clientSatisfaction}%</div>
                        <p className="text-xs text-muted-foreground">Məmnuniyyət</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                </div>

                {/* Professional Experience Overview */}
                {(() => {
                  const educationData = getLawyerEducationData(lawyer);
                  
                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Recent Career History */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Son Karyera Addımları
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {educationData.careerHistory.slice(0, 2).map((job: any, index: number) => (
                              <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                                <h4 className="font-semibold text-sm">{job.position}</h4>
                                <p className="text-sm text-muted-foreground">{job.company}</p>
                                <Badge variant="outline" className="text-xs mt-1">
                                  {job.startDate} - {job.endDate}
                                </Badge>
                              </div>
                            ))}
                            {educationData.careerHistory.length === 0 && (
                              <p className="text-sm text-muted-foreground">Karyera məlumatları mövcud deyil</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Key Achievements */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Star className="h-5 w-5" />
                            Əsas Nailiyyətlər
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {educationData.awards.slice(0, 3).map((award: any, index: number) => (
                              <div key={index} className="flex items-start gap-3">
                                <Star className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                                <div>
                                  <h4 className="font-semibold text-sm">{award.title}</h4>
                                  <p className="text-xs text-muted-foreground">{award.organization}</p>
                                  <Badge variant="secondary" className="text-xs mt-1">{award.year}</Badge>
                                </div>
                              </div>
                            ))}
                            {educationData.awards.length === 0 && (
                              <p className="text-sm text-muted-foreground">Mükafat məlumatları mövcud deyil</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Language Skills */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            Dil Bilikləri
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {educationData.languages.slice(0, 4).map((lang: any, index: number) => (
                              <div key={index} className="flex justify-between items-center">
                                <span className="text-sm font-medium">{lang.language}</span>
                                <Badge variant="outline" className="text-xs">{lang.level}</Badge>
                              </div>
                            ))}
                            {educationData.languages.length === 0 && (
                              <p className="text-sm text-muted-foreground">Dil məlumatları mövcud deyil</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Active Certifications */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5" />
                            Aktiv Sertifikatlar
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {educationData.certifications
                              .filter((cert: any) => new Date(cert.validUntil) > new Date())
                              .slice(0, 3)
                              .map((cert: any, index: number) => (
                                <div key={index} className="space-y-1">
                                  <h4 className="font-semibold text-sm">{cert.name}</h4>
                                  <p className="text-xs text-muted-foreground">{cert.issuer}</p>
                                  <Badge variant="default" className="text-xs">
                                    Keçərli: {cert.validUntil}
                                  </Badge>
                                </div>
                              ))}
                            {educationData.certifications.filter((cert: any) => new Date(cert.validUntil) > new Date()).length === 0 && (
                              <p className="text-sm text-muted-foreground">Aktiv sertifikat mövcud deyil</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="education" className="mt-6 overflow-hidden">
            <ScrollArea className="h-[600px] w-full pr-4">
              <div className="space-y-6">
                {(() => {
                  const educationData = getLawyerEducationData(lawyer);
                  
                  return (
                    <>
                      {/* Education Section */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Award className="h-5 w-5" />
                            Təhsil
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {educationData.education.map((edu: any, index: number) => (
                              <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h4 className="font-semibold">{edu.degree}</h4>
                                    <p className="text-sm text-muted-foreground">{edu.university}</p>
                                    {edu.specialization && (
                                      <p className="text-sm text-blue-600">İxtisas: {edu.specialization}</p>
                                    )}
                                    {edu.thesis && (
                                      <p className="text-sm text-gray-600 mt-1">Dissertasiya: {edu.thesis}</p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <Badge variant="outline">{edu.year}</Badge>
                                    {edu.gpa && (
                                      <p className="text-sm text-green-600 mt-1">GPA: {edu.gpa}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Career History */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Karyera Tarixi
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {educationData.careerHistory.map((job: any, index: number) => (
                              <div key={index} className="border-l-4 border-green-500 pl-4 py-2">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <h4 className="font-semibold">{job.position}</h4>
                                    <p className="text-sm text-muted-foreground">{job.company}</p>
                                    <p className="text-sm text-gray-600 mt-2">{job.responsibilities}</p>
                                  </div>
                                  <div className="text-right ml-4">
                                    <Badge variant="outline" className="mb-1">
                                      {job.startDate} - {job.endDate}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Certifications */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5" />
                            Sertifikatlar və Lisenziyalar
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {educationData.certifications.map((cert: any, index: number) => (
                              <div key={index} className="border rounded-lg p-4">
                                <h4 className="font-semibold text-sm">{cert.name}</h4>
                                <p className="text-sm text-muted-foreground">{cert.issuer}</p>
                                <div className="flex justify-between items-center mt-2">
                                  <Badge variant="secondary" className="text-xs">
                                    Alınıb: {cert.date}
                                  </Badge>
                                  <Badge 
                                    variant={new Date(cert.validUntil) > new Date() ? "default" : "destructive"} 
                                    className="text-xs"
                                  >
                                    {new Date(cert.validUntil) > new Date() ? `Keçərli: ${cert.validUntil}` : 'Müddəti bitib'}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Languages */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <MessageSquare className="h-5 w-5" />
                              Dil Bilikləri
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {educationData.languages.map((lang: any, index: number) => (
                                <div key={index} className="flex justify-between items-center">
                                  <span className="font-medium">{lang.language}</span>
                                  <Badge variant="outline">{lang.level}</Badge>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Awards */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Star className="h-5 w-5" />
                              Mükafatlar və Nailiyyətlər
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {educationData.awards.map((award: any, index: number) => (
                                <div key={index} className="border-l-4 border-yellow-500 pl-3 py-2">
                                  <h4 className="font-semibold text-sm">{award.title}</h4>
                                  <p className="text-sm text-muted-foreground">{award.organization}</p>
                                  <Badge variant="secondary" className="text-xs mt-1">{award.year}</Badge>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  );
                })()}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="reviews" className="mt-6 overflow-hidden">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Müştəri Rəyləri</h3>
              {/* Sistemdə hələ müştəri rəyi funksiyası yoxdur — əvvəllər bura
                  HƏR vəkil üçün eyni 3 saxta rəy göstərilirdi. Real funksiya
                  əlavə olunanadək dürüst boş vəziyyət göstərilir. */}
              <div className="text-center py-12 text-muted-foreground">
                <Star className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Müştəri rəyi sistemi hələ aktiv deyil</p>
              </div>
            </div>
          </TabsContent>

          {isEditing && editedLawyer && (
            <TabsContent value="edit" className="mt-6 overflow-hidden">
              <ScrollArea className="h-[600px] w-full pr-4">
                <div className="space-y-6">
                  {/* Basic Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Əsas Məlumatlar
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Ad və Soyad</Label>
                          <Input
                            id="name"
                            value={editedLawyer.name}
                            onChange={(e) => setEditedLawyer({ ...editedLawyer, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={editedLawyer.email}
                            onChange={(e) => setEditedLawyer({ ...editedLawyer, email: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Telefon</Label>
                          <PhoneInput
                            value={editedLawyer.phone}
                            onChange={(v) => setEditedLawyer({ ...editedLawyer, phone: v })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="degree">Təhsil</Label>
                          <Select
                            value={editedLawyer.degree}
                            onValueChange={(value) => setEditedLawyer({ ...editedLawyer, degree: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Hüquq üzrə bakalavr">Hüquq üzrə bakalavr</SelectItem>
                              <SelectItem value="Hüquq üzrə magistr">Hüquq üzrə magistr</SelectItem>
                              <SelectItem value="Hüquq doktoru">Hüquq doktoru</SelectItem>
                              <SelectItem value="PhD">PhD</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Professional Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Award className="h-5 w-5" />
                        Peşəkar Məlumatlar
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="specialization">İxtisas</Label>
                          <Select
                            value={editedLawyer.specialization}
                            onValueChange={(value) => setEditedLawyer({ ...editedLawyer, specialization: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Bank və Lizinq hüququ">Bank və Lizinq hüququ</SelectItem>
                              <SelectItem value="Əmək hüququ">Əmək hüququ</SelectItem>
                              <SelectItem value="Mülki hüquq">Mülki hüquq</SelectItem>
                              <SelectItem value="Cinayət hüququ">Cinayət hüququ</SelectItem>
                              <SelectItem value="İnzibati hüquq">İnzibati hüquq</SelectItem>
                              <SelectItem value="Ailə hüququ">Ailə hüququ</SelectItem>
                              <SelectItem value="Vergi və Gömrük hüququ">Vergi və Gömrük hüququ</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="experience">Təcrübə</Label>
                          <Select
                            value={editedLawyer.experience}
                            onValueChange={(value) => setEditedLawyer({ ...editedLawyer, experience: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1-3 il">1-3 il</SelectItem>
                              <SelectItem value="3-5 il">3-5 il</SelectItem>
                              <SelectItem value="5-8 il">5-8 il</SelectItem>
                              <SelectItem value="8-12 il">8-12 il</SelectItem>
                              <SelectItem value="12-15 il">12-15 il</SelectItem>
                              <SelectItem value="15+ il">15+ il</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="status">Status</Label>
                          <Select
                            value={editedLawyer.status}
                            onValueChange={(value: 'active' | 'inactive') => setEditedLawyer({ ...editedLawyer, status: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Aktiv</SelectItem>
                              <SelectItem value="inactive">Qeyri-aktiv</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="workload">İş yükü</Label>
                          <Select
                            value={editedLawyer.workload}
                            onValueChange={(value: 'high' | 'medium' | 'low') => setEditedLawyer({ ...editedLawyer, workload: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Aşağı</SelectItem>
                              <SelectItem value="medium">Orta</SelectItem>
                              <SelectItem value="high">Yüksək</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Performance Metrics */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Performans Göstəriciləri
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="completedCases">Tamamlanan işlər</Label>
                          <Input
                            id="completedCases"
                            type="number"
                            value={editedLawyer.completedCases}
                            onChange={(e) => setEditedLawyer({ ...editedLawyer, completedCases: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="efficiency">Effektivlik (%)</Label>
                          <Input
                            id="efficiency"
                            type="number"
                            min="0"
                            max="100"
                            value={editedLawyer.efficiency}
                            onChange={(e) => setEditedLawyer({ ...editedLawyer, efficiency: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="clientSatisfaction">Müştəri məmnuniyyəti (%)</Label>
                          <Input
                            id="clientSatisfaction"
                            type="number"
                            min="0"
                            max="100"
                            value={editedLawyer.clientSatisfaction}
                            onChange={(e) => setEditedLawyer({ ...editedLawyer, clientSatisfaction: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Financial Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Maliyyə Məlumatları
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="activeTasks">Aktiv tapşırıqlar</Label>
                          <Input
                            id="activeTasks"
                            type="number"
                            value={editedLawyer.activeTasks}
                            onChange={(e) => setEditedLawyer({ ...editedLawyer, activeTasks: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          <TabsContent value="settings" className="mt-6 overflow-hidden">
            <ScrollArea className="h-[500px] w-full pr-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Vəkil Tənzimləmələri</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Tapşırıq bildirişləri</h4>
                        <p className="text-sm text-muted-foreground">Yeni tapşırıq təhkimi bildirişləri</p>
                      </div>
                      <Button variant="outline" size="sm">Aktiv</Button>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">İş yükü limitləri</h4>
                        <p className="text-sm text-muted-foreground">Maksimum eyni vaxtda tapşırıq sayı</p>
                      </div>
                      <Button variant="outline" size="sm">8 tapşırıq</Button>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Avtomatik təhkim</h4>
                        <p className="text-sm text-muted-foreground">İxtisas sahəsi üzrə avtomatik tapşırıq təhkimi</p>
                      </div>
                      <Button variant="outline" size="sm">Aktiv</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>

      <LawyerReassignDeleteDialog
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        lawyer={lawyer}
        pendingTasks={reassignTasks}
        otherLawyers={allLawyers.filter((l: any) => String(l.id) !== String(lawyer.id))}
        onConfirm={handleReassignConfirm}
      />
    </Dialog>
  );
}
export default LawyerManagementModal;