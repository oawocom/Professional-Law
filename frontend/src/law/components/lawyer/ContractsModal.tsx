import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Progress } from '../ui/progress';
import { 
  Search, 
  Filter,
  FileText,
  Calendar,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Building2
} from 'lucide-react';
import { isCompletedStatus } from '../../utils/taskStatusConstants';

interface ContractsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contracts: any[];
  tasks?: any[];
  onContractClick: (contract: any) => void;
}

// Normalize contract from API (snake_case) or Figma (camelCase) format
function n(c: any) {
  var clientStr = typeof c.client === 'string' ? c.client : c.client?.name || c.clientName || c.client_name || '';
  var fmtDate = function(d: any) {
    if (!d) return '';
    try {
      var dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return dt.toLocaleDateString('az-AZ');
    } catch(e) { return String(d); }
  };
  return {
    id: c.id,
    name: c.name || c.title || '',
    client: clientStr,
    clientId: c.clientId || c.client_id || 0,
    category: c.category || c.allowed_categories?.[0] || c.allowedCategories?.[0] || '',
    taskQuota: c.taskQuota || c.task_quota || 100,
    usedQuota: c.usedQuota || c.tasks_used || c.tasksUsed || 0,
    startDate: fmtDate(c.startDate || c.start_date),
    endDate: fmtDate(c.endDate || c.end_date),
    endDateRaw: c.endDate || c.end_date || '',
    status: c.status || 'active',
    description: c.description || '',
    _raw: c,
  };
}

export function ContractsModal({ open, onOpenChange, contracts: rawContracts, tasks, onContractClick }: ContractsModalProps) {
  const contracts = rawContracts.map(n);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Real per-müqavilə tapşırıq sayları — kontraktın öz sahələrindən DEYİL,
  // faktiki tasks siyahısından hesablanır (əvvəllər həmişə 0 göstərirdi).
  const taskStatsByContract: Record<string, { total: number; active: number; completed: number; overdue: number }> = {};
  (tasks || []).forEach(function(t: any) {
    var cid = t.contractId !== undefined && t.contractId !== null ? t.contractId : t.contract_id;
    if (cid === undefined || cid === null) return;
    var key = String(cid);
    if (!taskStatsByContract[key]) taskStatsByContract[key] = { total: 0, active: 0, completed: 0, overdue: 0 };
    var stat = taskStatsByContract[key];
    stat.total++;
    var isCompleted = isCompletedStatus(t.status);
    var isCancelled = t.status === 'cancelled';
    if (isCompleted) stat.completed++;
    else if (!isCancelled) stat.active++;
    if (t.deadline && !isCompleted) {
      try { if (new Date(t.deadline) < new Date()) stat.overdue++; } catch {}
    }
  });

  // Get unique categories
  const categories = Array.from(new Set(contracts.map(c => c.category).filter(Boolean)));

  // Filter contracts
  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = contract.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contract.client.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || contract.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Aktiv</Badge>;
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800"><CheckCircle className="h-3 w-3 mr-1" />Tamamlanmış</Badge>;
      case 'suspended':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Dayandırılmış</Badge>;
      case 'expired':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Vaxtı keçmiş</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getQuotaPercentage = (used: number, total: number) => {
    return (used / total) * 100;
  };

  const getQuotaColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-orange-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  const isQuotaNearLimit = (used: number, total: number) => {
    return (used / total) >= 0.9;
  };

  const calculateDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const today = new Date();
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] flex flex-col" data-modal="contracts">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Müqavilələr
            <span className="text-sm text-muted-foreground font-normal ml-2">
              ({filteredContracts.length} müqavilə)
            </span>
          </DialogTitle>
          <DialogDescription>
            Sizə təyin olunmuş bütün müqavilələri idarə edin
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="space-y-4 border-b pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Müqavilə və ya müştəri axtar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün statuslar</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="completed">Tamamlanmış</SelectItem>
                <SelectItem value="suspended">Dayandırılmış</SelectItem>
                <SelectItem value="expired">Vaxtı keçmiş</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Kateqoriya" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün kateqoriyalar</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Contracts Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {filteredContracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Filter className="h-12 w-12 text-muted-foreground mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">Heç bir müqavilə tapılmadı</h3>
              <p className="text-sm text-muted-foreground">
                Filtr parametrlərini dəyişdirərək yenidən cəhd edin
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
              {filteredContracts.map((contract) => {
                const quotaPercentage = getQuotaPercentage(contract.usedQuota, contract.taskQuota);
                const daysRemaining = calculateDaysRemaining(contract.endDateRaw);
                const isNearLimit = isQuotaNearLimit(contract.usedQuota, contract.taskQuota);
                const stat = taskStatsByContract[String(contract.id)] || { total: 0, active: 0, completed: 0, overdue: 0 };

                return (
                  <div
                    key={contract.id}
                    className="border rounded-xl p-4 hover:shadow-lg transition-all duration-200 cursor-pointer bg-white"
                    onClick={() => {
                      onContractClick(contract._raw);
                      onOpenChange(false);
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium mb-1 line-clamp-2">{contract.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span className="line-clamp-1">{contract.client}</span>
                        </div>
                      </div>
                      {getStatusBadge(contract.status)}
                    </div>

                    {/* Category */}
                    <div className="mb-3">
                      <Badge variant="outline" className="text-xs">
                        <Building2 className="h-3 w-3 mr-1" />
                        {contract.category}
                      </Badge>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-3 p-2 bg-muted/50 rounded">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Aktiv</div>
                        <div className="font-medium text-blue-600">{stat.active}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Tamamlanmış</div>
                        <div className="font-medium text-green-600">{stat.completed}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Gecikmiş</div>
                        <div className="font-medium text-red-600">{stat.overdue}</div>
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{contract.startDate} - {contract.endDate}</span>
                      </div>
                      {contract.status === 'active' && daysRemaining > 0 && (
                        <span className={daysRemaining < 30 ? 'text-orange-600' : ''}>
                          {daysRemaining} gün qalıb
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}