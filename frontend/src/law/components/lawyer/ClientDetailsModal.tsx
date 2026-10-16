import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import {
  User,
  Mail,
  Phone,
  Calendar,
  FileText,
  Briefcase,
  MapPin,
  Clock
} from 'lucide-react';
import { isCompletedStatus } from '../../utils/taskStatusConstants';

interface Client {
  id: number;
  name: string;
  companyName?: string;
  email: string;
  phone: string;
  activeCases?: number;
  activeTasks?: number;
  totalCases?: number;
  taskCount?: number;
  completedTasks?: number;
  lastContact?: string;
  lastActivity?: string;
  status: string;
  category?: string;
  industry?: string;
  address?: string;
  registrationDate?: string;
  joinDate?: string;
  notes?: string;
  caseHistory?: Array<{
    id: number;
    title: string;
    status: string;
    date: string;
    outcome: string;
  }>;
}

interface ClientDetailsModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskClick?: (task: any) => void;
  tasks?: any[];
}

export function ClientDetailsModal({ client, isOpen, onClose, onTaskClick, tasks = [] }: ClientDetailsModalProps) {
  var clientTasks = useMemo(function() {
    if (!client) return [];
    var cid = String(client.id);
    return (tasks || []).filter(function(t: any) {
      var tcid = t.clientId !== undefined ? t.clientId : (t.client_id !== undefined ? t.client_id : null);
      return tcid !== null && String(tcid) === cid;
    });
  }, [client, tasks]);

  var activeTaskCount = useMemo(function() {
    return clientTasks.filter(function(t: any) { return !isCompletedStatus(t.status); }).length;
  }, [clientTasks]);

  if (!client) return null;

  // client obyekti xam (snake_case) API cavabı ola bilər — company_name əsl
  // backend sahə adıdır (companyName heç vaxt gəlmirdi).
  const displayName = client.companyName || (client as any).company_name || client.name;
  const joinDate = client.joinDate || (client as any).created_at || '';
  const lastActivity = client.lastActivity || (client as any).updated_at || '';

  const handleCaseClick = (task: any) => {
    if (onTaskClick) onTaskClick(task);
  };

  const handleEmail = () => {
    if (client.email) window.location.href = 'mailto:' + client.email;
  };

  const handleCall = () => {
    if (client.phone) window.location.href = 'tel:' + client.phone;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Aktiv</Badge>;
      case 'completed':
        return <Badge variant="secondary">Tamamlandı</Badge>;
      case 'inactive':
        return <Badge variant="outline">Passiv</Badge>;
      default:
        return <Badge variant="secondary">{status || '—'}</Badge>;
    }
  };

  const getCaseStatusBadge = (status: string) => {
    if (isCompletedStatus(status)) return <Badge variant="secondary" className="bg-green-100 text-green-800">Tamamlandı</Badge>;
    return <Badge variant="default" className="bg-blue-100 text-blue-800">Davam edir</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-modal="client-details">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2>{displayName}</h2>
              <p className="text-sm text-muted-foreground">Müştəri məlumatları</p>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Müştəri haqqında ətraflı məlumat və aktiv iş məlumatları
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Personal Information */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Şəxsi məlumatlar</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {client.email && (
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">{client.email}</p>
                    </div>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Telefon</p>
                      <p className="text-sm text-muted-foreground">{client.phone}</p>
                    </div>
                  </div>
                )}
                {client.address && (
                  <div className="md:col-span-2 flex items-start gap-3 p-3 border rounded-lg">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                    <div>
                      <p className="text-sm font-medium">Ünvan</p>
                      <p className="text-sm text-muted-foreground">{client.address}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Case History */}
            <div>
              <h3 className="text-lg font-semibold mb-4">İş tarixçəsi</h3>
              <div className="space-y-3">
                {clientTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Bu müştəri üçün iş tapılmadı</p>
                ) : (
                  clientTasks.map((task: any) => (
                    <div
                      key={task.id}
                      className="border rounded-lg p-4 cursor-pointer hover:bg-accent hover:shadow-md transition-all duration-200"
                      onClick={() => handleCaseClick(task)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{task.title || task.name}</h4>
                          {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {task.deadline || task.assignedDate || '—'}
                            </div>
                          </div>
                        </div>
                        <div className="ml-4">
                          {getCaseStatusBadge(task.status)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Notes */}
            {client.notes && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Qeydlər</h3>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">{client.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-4">Qısa məlumat</h3>

              <div className="space-y-3">
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status</span>
                    {getStatusBadge(client.status)}
                  </div>
                </div>

                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Aktiv işlər</span>
                    <span className="text-lg font-semibold text-primary">{activeTaskCount}</span>
                  </div>
                </div>

                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Ümumi işlər</span>
                    <span className="text-lg font-semibold">{clientTasks.length}</span>
                  </div>
                </div>

                {lastActivity && (
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Son yenilənmə</p>
                        <p className="text-sm text-muted-foreground">{new Date(lastActivity).toLocaleDateString('az-AZ')}</p>
                      </div>
                    </div>
                  </div>
                )}

                {joinDate && (
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Qeydiyyat tarixi</p>
                        <p className="text-sm text-muted-foreground">{new Date(joinDate).toLocaleDateString('az-AZ')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Button className="w-full" onClick={handleEmail} disabled={!client.email} type="button">
                <Mail className="h-4 w-4 mr-2" />
                Email göndər
              </Button>
              <Button variant="outline" className="w-full" onClick={handleCall} disabled={!client.phone} type="button">
                <Phone className="h-4 w-4 mr-2" />
                Zəng et
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
