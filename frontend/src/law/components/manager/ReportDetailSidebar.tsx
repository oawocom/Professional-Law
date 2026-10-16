import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { 
  X, 
  User, 
  FileText, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Gavel,
  TrendingUp,
  Award,
  Phone,
  Mail,
  BarChart3
} from 'lucide-react';
import { isCompletedStatus, getStatusGroup } from '../../utils/taskStatusConstants';

interface ReportDetailSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedData: {
    type: 'status' | 'lawyer' | 'category' | 'priority';
    item: any;
    relatedTasks: any[];
    title: string;
  } | null;
  allTasks: any[];
  lawyers: any[];
}

export function ReportDetailSidebar({ 
  isOpen, 
  onClose, 
  selectedData, 
  allTasks, 
  lawyers 
}: ReportDetailSidebarProps) {
  if (!isOpen || !selectedData) return null;

  const { type, item, relatedTasks, title } = selectedData;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in-progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'court-submitted':
        return <Gavel className="h-4 w-4 text-purple-500" />;
      case 'assigned':
        return <User className="h-4 w-4 text-orange-500" />;
      case 'pending':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Tamamlandı';
      case 'in-progress': return 'Davam edir';
      case 'court-submitted': return 'Məhkəməyə göndərildi';
      case 'assigned': return 'Təhkim olundu';
      case 'pending': return 'Gözlənilir';
      case 'cancelled': return 'Ləğv edildi';
      case 'withdrawn': return 'Geri götürüldü';
      default: return 'Bilinmir';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return 'Yüksək';
      case 'medium': return 'Orta';
      default: return 'Aşağı';
    }
  };

  const calculateDaysLeft = (deadline: string) => {
    const days = Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    if (days < 0) return 'Vaxt keçib';
    if (days === 0) return 'Bu gün';
    if (days === 1) return '1 gün qalıb';
    return `${days} gün qalıb`;
  };

  const renderStatusDetail = () => (
    <div className="space-y-6">
      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {getStatusIcon(item.status?.toLowerCase())}
            {title} Statistikası
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-xl font-bold">{relatedTasks.length}</div>
              <p className="text-sm text-muted-foreground">Ümumi iş</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-xl font-bold text-blue-600">
                {Math.round((relatedTasks.length / allTasks.length) * 100)}%
              </div>
              <p className="text-sm text-muted-foreground">Ümumi nisbət</p>
            </div>
          </div>
          
          {item.status === 'completed' && (
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 text-green-700">
                <TrendingUp className="h-4 w-4" />
                <span className="font-medium">Orta tamamlanma müddəti: 14 gün</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">İş Siyahısı ({relatedTasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {relatedTasks.map((task, index) => (
                <div key={index} className="p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h4 className="font-medium text-sm">{task.title}</h4>
                      <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                        {getPriorityText(task.priority)}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {task.assignedLawyer}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {task.deadline}
                      </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      {calculateDaysLeft(task.deadline)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const renderLawyerDetail = () => {
    const lawyer = lawyers.find(l => l.name === item.name) || item;
    
    return (
      <div className="space-y-6">
        {/* Lawyer Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  {lawyer?.name?.split(' ').map((n: string) => n[0]).join('') || 'N/A'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3>{lawyer.name}</h3>
                <p className="text-sm text-muted-foreground">{lawyer.specialization}</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="text-xl font-bold">{relatedTasks.length}</div>
                <p className="text-sm text-muted-foreground">Aktiv işlər</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="text-xl font-bold text-green-600">
                  {lawyer.efficiency || Math.round((relatedTasks.filter((t: any) => t?.status === 'completed').length / relatedTasks.length) * 100)}%
                </div>
                <p className="text-sm text-muted-foreground">Effektivlik</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Reytinq:</span>
                <div className="flex items-center gap-1">
                  <Award className="h-4 w-4 text-yellow-500" />
                  <span>{lawyer.rating || 4.5}/5</span>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span>Təcrübə:</span>
                <span>{lawyer.experience || '8 il'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Həll edilmiş işlər:</span>
                <span>{lawyer.completedCases || 156}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4" />
                <span>{lawyer.name?.toLowerCase().replace(' ', '.')}@lawfirm.az</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4" />
                <span>+994 50 123 45 67</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Performans Təhlili
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Tamamlanan:</span>
                <Badge className="bg-green-100 text-green-800">
                  {relatedTasks.filter((t: any) => isCompletedStatus(t?.status)).length}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Aktiv işlər:</span>
                <Badge className="bg-blue-100 text-blue-800">
                  {relatedTasks.filter((t: any) => getStatusGroup(t?.status) === 'in_progress').length}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Məhkəmədə:</span>
                <Badge className="bg-purple-100 text-purple-800">
                  {relatedTasks.filter((t: any) => t?.status === 'mehkemeye_gonderildi').length}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Gözlənilən:</span>
                <Badge className="bg-yellow-100 text-yellow-800">
                  {relatedTasks.filter((t: any) => getStatusGroup(t?.status) === 'waiting').length}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Son İşlər</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {relatedTasks.slice(0, 10).map((task, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">{task.title}</h4>
                        {getStatusIcon(task.status)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {task.category} • {task.deadline}
                      </div>
                      <div className="text-xs">
                        {calculateDaysLeft(task.deadline)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderCategoryDetail = () => (
    <div className="space-y-6">
      {/* Category Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title} Statistikası</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-xl font-bold">{relatedTasks.length}</div>
              <p className="text-sm text-muted-foreground">Ümumi iş</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-xl font-bold text-green-600">
                {Math.round((relatedTasks.filter((t: any) => t?.status === 'completed').length / relatedTasks.length) * 100)}%
              </div>
              <p className="text-sm text-muted-foreground">Uğur dərəcəsi</p>
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-sm">
              <strong>Orta həll müddəti:</strong> {
                item.category === 'Lizinq' ? '15 gün' :
                item.category === 'Bank' ? '12 gün' : '22 gün'
              }
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Paylanması</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {['completed', 'assigned', 'in-progress', 'court-submitted', 'pending'].map(status => {
              const count = relatedTasks.filter((t: any) => t?.status === status).length;
              if (count === 0) return null;
              
              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status)}
                    <span className="text-sm">{getStatusText(status)}</span>
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">İş Siyahısı</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[350px]">
            <div className="space-y-3">
              {relatedTasks.map((task, index) => (
                <div key={index} className="p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h4 className="font-medium text-sm">{task.title}</h4>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(task.status)}
                        <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                          {getPriorityText(task.priority)}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {task.assignedLawyer}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {task.deadline}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const renderPriorityDetail = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {title} Prioritet Təhlili
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-xl font-bold">{relatedTasks.length}</div>
              <p className="text-sm text-muted-foreground">Bu prioritetdə iş</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <div className="text-xl font-bold text-orange-600">
                {Math.round((relatedTasks.length / allTasks.length) * 100)}%
              </div>
              <p className="text-sm text-muted-foreground">Ümumi nisbət</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task List by Priority */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">İş Siyahısı</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {relatedTasks.map((task, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h4 className="font-medium text-sm">{task.title}</h4>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(task.status)}
                        <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                          {getPriorityText(task.priority)}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{task.category}</span>
                      <span>{task.assignedLawyer}</span>
                      <span>{task.deadline}</span>
                    </div>
                    
                    <div className="text-xs">
                      {calculateDaysLeft(task.deadline)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-[59]" 
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-background border-l shadow-lg z-[60] overflow-hidden report-sidebar-overlay">
        <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{title}</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Ətraflı məlumatlar və statistikalar
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full p-4">
            {type === 'status' && renderStatusDetail()}
            {type === 'lawyer' && renderLawyerDetail()}
            {type === 'category' && renderCategoryDetail()}
            {type === 'priority' && renderPriorityDetail()}
          </ScrollArea>
        </div>
        </div>
      </div>
    </>
  );
}