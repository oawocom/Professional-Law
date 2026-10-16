'use client';
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import {
  Users,
  Building2,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  Activity,
  FileText,
  Briefcase,
  TrendingUp,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { toast } from 'sonner';
import type { UiClient, UiContract, UiTask } from '../../utils/dataMappers';
import { isCompletedStatus, isTerminalStatus } from '../../utils/taskStatusConstants';

// Helper: get field from both camelCase and snake_case
function f(obj: any, camel: string, snake: string, fallback: any = '') {
  return obj?.[camel] ?? obj?.[snake] ?? fallback;
}

interface ClientStatsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: (UiClient | any)[];
  contracts?: (UiContract | any)[];
  tasks?: (UiTask | any)[];
  onViewClient?: (client: any) => void;
  onEditClient?: (client: any) => void;
  onMessageClient?: (client: any) => void;
}

export function ClientStatsModal({
  open, onOpenChange, clients, contracts = [], tasks = [],
  onViewClient, onEditClient, onMessageClient
}: ClientStatsModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');

  // Calculate per-client stats from contracts/tasks
  const clientStats = useMemo(() => {
    const stats: Record<string, { activeTasks: number; completedTasks: number; activeContracts: number; totalContracts: number }> = {};

    clients.forEach((c: any) => {
      const cid = String(c.id);
      stats[cid] = { activeTasks: 0, completedTasks: 0, activeContracts: 0, totalContracts: 0 };
    });

    contracts.forEach((con: any) => {
      const clientId = String(f(con, 'clientId', 'client_id'));
      if (stats[clientId]) {
        stats[clientId].totalContracts++;
        const st = con.status;
        if (st === 'active' || st === 'draft') stats[clientId].activeContracts++;
      }
    });

    tasks.forEach((t: any) => {
      // Tapşırığın öz client_id sahəsindən birbaşa istifadə edilir (müqavilə
      // zənciri ilə deyil) — əvvəllər müqaviləsiz (contract_id boş) və ya
      // müqavilələr siyahısında olmayan tapşırıqlar hesablamadan kənarda
      // qalırdı (bax: useData.ts-də eyni sinif xəta üçün oxşar izah).
      const clientId = String(f(t, 'clientId', 'client_id'));
      if (stats[clientId]) {
        if (isCompletedStatus(t.status)) {
          stats[clientId].completedTasks++;
        } else if (!isTerminalStatus(t.status)) {
          stats[clientId].activeTasks++;
        }
      }
    });

    return stats;
  }, [clients, contracts, tasks]);

  const getClientType = (c: any) => f(c, 'type', 'type', 'individual');
  const getClientCompany = (c: any) => f(c, 'company', 'company_name', '');
  const getClientPhone = (c: any) => f(c, 'phone', 'phone', '');
  const getClientEmail = (c: any) => f(c, 'email', 'email', '');
  const getClientJoinDate = (c: any) => f(c, 'joinDate', 'created_at', '');
  const getClientStatus = (c: any) => f(c, 'status', 'status', 'active');

  const clientTypes = useMemo(() => [...new Set(clients.map(getClientType))], [clients]);

  const filteredClients = useMemo(() => {
    return clients
      .filter((client: any) => {
        const name = client.name?.toLowerCase() || '';
        const company = getClientCompany(client).toLowerCase();
        const matchesSearch = name.includes(searchTerm.toLowerCase()) || company.includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || getClientStatus(client) === statusFilter;
        const matchesType = typeFilter === 'all' || getClientType(client) === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
      })
      .sort((a: any, b: any) => {
        const statsA = clientStats[String(a.id)] || { activeTasks: 0, completedTasks: 0 };
        const statsB = clientStats[String(b.id)] || { activeTasks: 0, completedTasks: 0 };
        switch (sortBy) {
          case 'name': return (a.name || '').localeCompare(b.name || '');
          case 'company': return getClientCompany(a).localeCompare(getClientCompany(b));
          case 'activeTasks': return statsB.activeTasks - statsA.activeTasks;
          case 'date': return new Date(getClientJoinDate(b)).getTime() - new Date(getClientJoinDate(a)).getTime();
          default: return 0;
        }
      });
  }, [clients, searchTerm, statusFilter, typeFilter, sortBy, clientStats]);

  // Totals
  const totalActive = clients.filter((c: any) => getClientStatus(c) === 'active').length;
  const totalActiveTasks = Object.values(clientStats).reduce((s, v) => s + v.activeTasks, 0);
  const totalCompletedTasks = Object.values(clientStats).reduce((s, v) => s + v.completedTasks, 0);

  const handleAction = (action: string, client: any) => {
    switch (action) {
      case 'details':
        if (onViewClient) onViewClient(client);
        else toast.info(`${client.name} müştəri detalları`);
        break;
      case 'edit':
        if (onEditClient) onEditClient(client);
        else toast.info(`${client.name} redaktə ediləcək`);
        break;
      case 'message':
        if (onMessageClient) onMessageClient(client);
        else toast.info(`${client.name} ilə mesaj`);
        break;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden" data-modal="client-stats">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Müştəri Statistikaları
          </DialogTitle>
          <DialogDescription>
            Bütün müştərilərin məlumatları və statistikası
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Overview */}
          <div className="grid grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{clients.length}</div>
                <p className="text-xs text-muted-foreground">Ümumi Müştəri</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{totalActive}</div>
                <p className="text-xs text-muted-foreground">Aktiv Müştəri</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">{totalActiveTasks}</div>
                <p className="text-xs text-muted-foreground">Aktiv Tapşırıq</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-purple-600">{totalCompletedTasks}</div>
                <p className="text-xs text-muted-foreground">Tamamlanan</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ad və ya şirkət ilə axtar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent className="z-[200] bg-white">
                <SelectItem value="all">Hamısı</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="inactive">Qeyri-aktiv</SelectItem>
                <SelectItem value="archived">Arxivləşmiş</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Tip" /></SelectTrigger>
              <SelectContent className="z-[200] bg-white">
                <SelectItem value="all">Hamısı</SelectItem>
                <SelectItem value="individual">Fərdi</SelectItem>
                <SelectItem value="company">Şirkət</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Sırala" /></SelectTrigger>
              <SelectContent className="z-[200] bg-white">
                <SelectItem value="name">Ada görə</SelectItem>
                <SelectItem value="company">Şirkətə görə</SelectItem>
                <SelectItem value="activeTasks">Aktiv tapşırığa görə</SelectItem>
                <SelectItem value="date">Tarixə görə</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Client List */}
          <ScrollArea className="flex-1 h-[400px]">
            <div className="space-y-3 pr-4">
              {filteredClients.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Müştəri tapılmadı</p>
                </div>
              ) : (
                filteredClients.map((client: any) => {
                  const cid = String(client.id);
                  const stats = clientStats[cid] || { activeTasks: 0, completedTasks: 0, activeContracts: 0, totalContracts: 0 };
                  const status = getClientStatus(client);
                  const type = getClientType(client);

                  return (
                    <Card key={client.id} className="hover:shadow-md transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-11 w-11">
                              <AvatarFallback className={type === 'company' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                                {client.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium">{client.name}</h3>
                                <Badge className={status === 'active' ? 'bg-green-100 text-green-800' : status === 'archived' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'}>
                                  {status === 'active' ? 'Aktiv' : status === 'archived' ? 'Arxiv' : 'Qeyri-aktiv'}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {type === 'company' ? 'Şirkət' : 'Fərdi'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                {getClientCompany(client) && (
                                  <span className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {getClientCompany(client)}
                                  </span>
                                )}
                                {getClientPhone(client) && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {getClientPhone(client)}
                                  </span>
                                )}
                                {getClientEmail(client) && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {getClientEmail(client)}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {getClientJoinDate(client) ? new Date(getClientJoinDate(client)).toLocaleDateString('az-AZ') : '-'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="grid grid-cols-3 gap-4 text-center">
                              <div>
                                <div className="font-medium text-blue-600">{stats.activeTasks}</div>
                                <div className="text-xs text-muted-foreground">Aktiv</div>
                              </div>
                              <div>
                                <div className="font-medium text-green-600">{stats.completedTasks}</div>
                                <div className="text-xs text-muted-foreground">Tamamlanan</div>
                              </div>
                              <div>
                                <div className="font-medium text-purple-600">{stats.totalContracts}</div>
                                <div className="text-xs text-muted-foreground">Müqavilə</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleAction('message', client)}>
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="z-[200] bg-white">
                                  <DropdownMenuItem onClick={() => handleAction('details', client)}>
                                    <Eye className="h-4 w-4 mr-2" />Detallar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleAction('edit', client)}>
                                    <Edit className="h-4 w-4 mr-2" />Redaktə et
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          <div className="text-sm text-muted-foreground">
            {filteredClients.length} müştəri göstərilir (Ümumi: {clients.length})
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bağla</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}