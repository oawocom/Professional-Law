'use client';
import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  FileText, Calendar, User, DollarSign, Briefcase,
  AlertTriangle, RefreshCw, Tag
} from 'lucide-react';
import { isCompletedStatus, isTerminalStatus, getStatusLabel, getStatusColor } from '../../utils/taskStatusConstants';

// Helper: get field with snake_case fallback
function f(obj: any, camel: string, snake: string, fallback: any = '') {
  return obj?.[camel] ?? obj?.[snake] ?? fallback;
}

interface ContractDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: any;
  tasks?: any[];
  onTaskClick?: (task: any) => void;
  hideQuota?: boolean;
}

export function ContractDetailModal({ open, onOpenChange, contract, tasks = [], onTaskClick, hideQuota }: ContractDetailModalProps) {
  const contractId = contract ? String(contract.id) : '';
  const contractTasks = useMemo(function() {
    if (!contract) return [];
    return (tasks || []).filter(function(t: any) {
      var cid = String(f(t, 'contractId', 'contract_id'));
      return cid === contractId;
    });
  }, [tasks, contractId, contract]);

  if (!contract) return null;

  const completedTasks = contractTasks.filter(function(t: any) { return isCompletedStatus(t.status); });
  const activeTasks = contractTasks.filter(function(t: any) { return !isTerminalStatus(t.status); });

  const name = contract.name || f(contract, 'title', 'title', 'Müqavilə #' + contract.id);
  const contractNumber = f(contract, 'contractNumber', 'contract_number', '');
  const status = f(contract, 'status', 'status', 'active');
  const clientName = f(contract, 'clientName', 'client_name', (contract.client && contract.client.name) || '');
  const category = f(contract, 'category', 'category', '');
  const startDate = f(contract, 'startDate', 'start_date', '');
  const endDate = f(contract, 'endDate', 'end_date', '');
  const value = f(contract, 'value', 'value', 0);
  const currency = f(contract, 'currency', 'currency', 'AZN');
  const notes = f(contract, 'notes', 'notes', '');
  const description = f(contract, 'description', 'description', '');
  const taskQuota = f(contract, 'taskQuota', 'task_quota', 0);
  const autoRenew = f(contract, 'autoRenew', 'auto_renew', false);
  const staticLawyerFee = f(contract, 'staticLawyerFee', 'static_lawyer_fee', 0);
  const courtName = f(contract, 'courtName', 'court_name', '');
  const caseNumber = f(contract, 'caseNumber', 'case_number', '');
  const claimAmount = f(contract, 'claimAmount', 'claim_amount', 0);
  const priority = f(contract, 'priority', 'priority', '');

  var allowedCategoriesRaw = f(contract, 'allowedCategories', 'allowed_categories', []);
  var allowedCategories: string[] = [];
  if (Array.isArray(allowedCategoriesRaw)) {
    allowedCategories = allowedCategoriesRaw;
  } else if (typeof allowedCategoriesRaw === 'string' && allowedCategoriesRaw) {
    try { allowedCategories = JSON.parse(allowedCategoriesRaw); } catch { allowedCategories = []; }
  }

  const formatDate = function(d: string) {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('az-AZ'); } catch { return d; }
  };

  const getStatusBadge = function(s: string) {
    var map: Record<string, { cls: string; label: string }> = {
      'active': { cls: 'bg-green-100 text-green-800', label: 'Aktiv' },
      'completed': { cls: 'bg-blue-100 text-blue-800', label: 'Tamamlandı' },
      'expired': { cls: 'bg-red-100 text-red-800', label: 'Müddəti bitib' },
      'inactive': { cls: 'bg-gray-100 text-gray-800', label: 'Qeyri-aktiv' },
      'draft': { cls: 'bg-yellow-100 text-yellow-800', label: 'Qaralama' },
      'archived': { cls: 'bg-gray-100 text-gray-800', label: 'Arxivləşmiş' },
      'near-limit': { cls: 'bg-orange-100 text-orange-800', label: 'Kvota bitir' },
    };
    var x = map[s] || { cls: 'bg-gray-100 text-gray-800', label: s };
    return <Badge className={x.cls}>{x.label}</Badge>;
  };

  const getTaskStatusBadge = function(s: string) {
    // Sistemin real status kodları (tehkim_gozleyir, mehkemeye_gonderildi,
    // is_yekunlasdi və s.) üçün vahid mənbədən (taskStatusConstants) istifadə
    // edilir — əvvəllər burada yalnız köhnə/qondarma kodlar tanınırdı və real
    // statuslar xam kod kimi (tərcümə edilmədən) göstərilirdi.
    return <Badge className={getStatusColor(s)}>{getStatusLabel(s)}</Badge>;
  };

  const quotaUsed = contractTasks.length;
  const quotaPercent = taskQuota > 0 ? Math.min((quotaUsed / taskQuota) * 100, 100) : 0;
  const gridCols = hideQuota ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden" data-modal="contract-detail">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />{name}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            {contractNumber && <Badge variant="outline">#{contractNumber}</Badge>}
            {getStatusBadge(status)}
            {priority && <Badge variant="outline">{priority === 'high' ? 'Yüksək' : priority === 'medium' ? 'Orta' : 'Aşağı'}</Badge>}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 overflow-hidden">
          <TabsList className={'grid w-full ' + gridCols}>
            <TabsTrigger value="details">Detallar</TabsTrigger>
            <TabsTrigger value="tasks">Tapşırıqlar ({contractTasks.length})</TabsTrigger>
            {!hideQuota && <TabsTrigger value="quota">Kvota</TabsTrigger>}
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    {clientName && (
                      <div>
                        <span className="text-muted-foreground text-sm">Müştəri</span>
                        <p className="font-medium flex items-center gap-1"><User className="h-4 w-4" />{clientName}</p>
                      </div>
                    )}
                    {category && (
                      <div>
                        <span className="text-muted-foreground text-sm">Kateqoriya</span>
                        <p className="font-medium">{category}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground text-sm">Başlanğıc</span>
                      <p className="font-medium flex items-center gap-1"><Calendar className="h-4 w-4" />{formatDate(startDate)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-sm">Bitmə</span>
                      <p className="font-medium flex items-center gap-1"><Calendar className="h-4 w-4" />{formatDate(endDate)}</p>
                    </div>
                    {value > 0 && (
                      <div>
                        <span className="text-muted-foreground text-sm">Dəyər</span>
                        <p className="font-medium flex items-center gap-1"><DollarSign className="h-4 w-4" />{Number(value).toLocaleString('az-AZ')} {currency}</p>
                      </div>
                    )}
                    {staticLawyerFee > 0 && (
                      <div>
                        <span className="text-muted-foreground text-sm">Vəkil haqqı</span>
                        <p className="font-medium">{Number(staticLawyerFee).toLocaleString('az-AZ')} ₼</p>
                      </div>
                    )}
                    {courtName && (
                      <div>
                        <span className="text-muted-foreground text-sm">Məhkəmə</span>
                        <p className="font-medium">{courtName}</p>
                      </div>
                    )}
                    {caseNumber && (
                      <div>
                        <span className="text-muted-foreground text-sm">İş nömrəsi</span>
                        <p className="font-medium">{caseNumber}</p>
                      </div>
                    )}
                    {claimAmount > 0 && (
                      <div>
                        <span className="text-muted-foreground text-sm">İddia məbləği</span>
                        <p className="font-medium text-amber-700">{Number(claimAmount).toLocaleString('az-AZ')} ₼</p>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground text-sm">Avto-yenilənmə</span>
                      <p className="font-medium flex items-center gap-1">
                        <RefreshCw className="h-4 w-4" />{autoRenew ? 'Bəli' : 'Xeyr'}
                      </p>
                    </div>
                  </div>

                  {allowedCategories.length > 0 && (
                    <div className="pt-3 border-t">
                      <span className="text-muted-foreground text-sm">İcazə verilən kateqoriyalar</span>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {allowedCategories.map(function(cat: string, idx: number) {
                          return <Badge key={idx} variant="outline" className="text-xs"><Tag className="h-3 w-3 mr-1" />{cat}</Badge>;
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {(description || notes) && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Qeydlər</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{description || notes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="tasks" className="space-y-3">
              {contractTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Tapşırıq yoxdur</p>
                </div>
              ) : (
                contractTasks.map(function(task: any) {
                  var isOverdue = task.deadline && !isTerminalStatus(task.status) && new Date(task.deadline) < new Date();
                  return (
                    <Card
                      key={task.id}
                      className={'cursor-pointer hover:shadow-md transition-shadow ' + (isOverdue ? 'border-l-4 border-l-red-500' : '')}
                      onClick={function() { if (onTaskClick) onTaskClick(task); }}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{task.title}</h4>
                              {getTaskStatusBadge(task.status)}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              {task.deadline && (
                                <span className={'flex items-center gap-1 ' + (isOverdue ? 'text-red-500' : '')}>
                                  <Calendar className="h-3 w-3" />{formatDate(task.deadline)}
                                  {isOverdue && <AlertTriangle className="h-3 w-3" />}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>

            {!hideQuota && (
              <TabsContent value="quota" className="space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Tapşırıq Kvotası</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">İstifadə edilən / Kvota</span>
                      <span className="font-bold text-lg">{quotaUsed} / {taskQuota || '∞'}</span>
                    </div>
                    {taskQuota > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={'h-3 rounded-full transition-all ' + (quotaPercent > 90 ? 'bg-red-500' : quotaPercent > 70 ? 'bg-yellow-500' : 'bg-green-500')}
                          style={{ width: quotaPercent + '%' }}
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-4 text-center pt-2">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="text-xl font-bold text-blue-600">{activeTasks.length}</div>
                        <p className="text-xs text-muted-foreground">Aktiv</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="text-xl font-bold text-green-600">{completedTasks.length}</div>
                        <p className="text-xs text-muted-foreground">Tamamlanan</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-xl font-bold text-gray-600">{taskQuota > 0 ? Math.max(0, taskQuota - quotaUsed) : '∞'}</div>
                        <p className="text-xs text-muted-foreground">Qalıq</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
