import { fetchApi, getApiBase, getLawToken } from '../../utils/apiHelper';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import { 
  FileText, 
  Trash2, 
  Pencil,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Clock,
  Target,
  User,
  Loader2
} from 'lucide-react';
import type { Contract } from './contract';
import { 
  getContractStatusColor, 
  getQuotaUsageColor,
  getContractStatusLabel,
  getQuotaUsageStatus
} from './contract';

interface ContractManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  contracts: Contract[];
  onContractsUpdate: (contracts: Contract[]) => void;
  lawyers?: any[];
}

export function ContractManagementModal({
  open,
  onOpenChange,
  clientId,
  clientName,
  contracts,
  onContractsUpdate,
  lawyers = []
}: ContractManagementModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [taskTypes, setTaskTypes] = useState<Array<{ id: number; name: string; is_active: boolean }>>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [editCategories, setEditCategories] = useState<string[]>([]);


  // Fetch task types when edit dialog opens
  useEffect(function() {
    if (!editingContract) return;
    setLoadingTypes(true);
    setEditCategories(editingContract.allowedCategories || []);
    fetchApi('/task-types')
      
      .then(function(d) { setTaskTypes(Array.isArray(d) ? d.filter(function(t: any) { return t.is_active; }) : []); })
      .catch(function() { setTaskTypes([]); })
      .finally(function() { setLoadingTypes(false); });
  }, [editingContract]);

  var toggleEditCategory = function(cat: string) {
    setEditCategories(function(prev) {
      return prev.includes(cat) ? prev.filter(function(c) { return c !== cat; }) : [...prev, cat];
    });
  };

  const getLawyerName = (lawyerId?: string) => {
    if (!lawyerId) return 'Təyin edilməyib';
    const lawyer = lawyers.find(l => l.id === lawyerId);
    return lawyer ? lawyer.name : 'Naməlum vəkil';
  };

  const handleDeleteContract = async (contractId: string) => {
    if (!confirm('Bu müqaviləni silmək istədiyinizə əminsiniz?')) return;
    try {
      await fetchApi('/contracts/' + contractId, { method: 'DELETE' });
      
      onContractsUpdate(contracts.filter(c => c.id !== contractId));
      toast.success('Müqavilə silindi');
    } catch (err) {
      console.error(err);
      toast.error('Müqavilə silinmədi');
    }
  };

  const handleUpdateContract = async (updatedContract: Contract) => {
    try {
      var res = await fetchApi('/contracts/' + updatedContract.id, {
        method: 'PUT',
        body: JSON.stringify({
          title: updatedContract.name,
          task_quota: updatedContract.taskQuota,
          start_date: updatedContract.startDate,
          end_date: updatedContract.endDate,
          status: updatedContract.status,
          allowed_categories: editCategories,
        }),
      });
      onContractsUpdate(contracts.map(c => c.id === updatedContract.id ? { ...updatedContract, allowedCategories: editCategories } : c));
      toast.success('Müqavilə yeniləndi');
      setEditingContract(null);
    } catch (err) {
      console.error(err);
      toast.error('Müqavilə yenilənmədi');
    }
  };

  const activeContracts = contracts.filter(c => c.status === 'active');
  const totalQuota = activeContracts.reduce((sum, c) => sum + c.taskQuota, 0);
  const totalUsed = activeContracts.reduce((sum, c) => sum + c.tasksUsed, 0);
  const totalRemaining = activeContracts.reduce((sum, c) => sum + c.tasksRemaining, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] overflow-hidden flex flex-col" data-modal="contract-management">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            {clientName} - Müqavilə İdarəetməsi
          </DialogTitle>
          <DialogDescription>
            Müştəri müqavilələrini idarə edin və kvotaları izləyin
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Ümumi Baxış</TabsTrigger>
            <TabsTrigger value="contracts">Müqavilələr ({contracts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 overflow-auto mt-4">
            <ScrollArea className="h-full pr-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Ümumi Müqavilələr
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{contracts.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {activeContracts.length} aktiv
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Ümumi Kvota
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalQuota}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      tapşırıq limiti
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      İstifadə edilmiş
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{totalUsed}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalQuota > 0 ? Math.round((totalUsed / totalQuota) * 100) : 0}% istifadə
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Qalan
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{totalRemaining}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      tapşırıq əlavə edilə bilər
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Active Contracts Overview */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Aktiv Müqavilələr
                </h3>
                
                {activeContracts.length === 0 ? (
                  <Card className="p-8 text-center">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Aktiv müqavilə yoxdur</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Müqavilə yaratmaq üçün Müqavilə Bazasına daxil olun
                    </p>
                  </Card>
                ) : (
                  activeContracts.map(contract => {
                    const usagePercentage = Math.round((contract.tasksUsed / contract.taskQuota) * 100);
                    const daysRemaining = Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <Card key={contract.id} className="overflow-hidden">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <CardTitle className="text-base">{contract.name}</CardTitle>
                                <Badge className={getContractStatusColor(contract.status)}>
                                  {getContractStatusLabel(contract.status)}
                                </Badge>
                              </div>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(contract.startDate).toLocaleDateString('az-AZ')} - {new Date(contract.endDate).toLocaleDateString('az-AZ')}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {daysRemaining} gün qalıb
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  <span>{getLawyerName(contract.assignedLawyer)}</span>
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteContract(contract.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Quota Usage */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm">Kvota İstifadəsi</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={
                                  usagePercentage >= 95 ? 'border-red-500 text-red-700' :
                                  usagePercentage >= 80 ? 'border-yellow-500 text-yellow-700' :
                                  'border-green-500 text-green-700'
                                }>
                                  {getQuotaUsageStatus(usagePercentage)}
                                </Badge>
                                <span className="text-sm font-semibold">
                                  {contract.tasksUsed} / {contract.taskQuota}
                                </span>
                              </div>
                            </div>
                            <Progress value={usagePercentage} className="h-2" />
                            <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                              <span>{usagePercentage}% istifadə edilib</span>
                              <span>{contract.tasksRemaining} tapşırıq qalıb</span>
                            </div>
                          </div>

                          {/* Task Statistics */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-green-50 rounded-lg">
                              <div className="text-lg font-bold text-green-700">{contract.completedTasks}</div>
                              <div className="text-xs text-muted-foreground">Tamamlanmış</div>
                            </div>
                            <div className="text-center p-3 bg-blue-50 rounded-lg">
                              <div className="text-lg font-bold text-blue-700">{contract.inProgressTasks}</div>
                              <div className="text-xs text-muted-foreground">İcrada</div>
                            </div>
                          </div>

                          {/* Lawyer Fee */}
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-blue-900">Vəkil Haqqı</span>
                              <span className="text-lg font-bold text-blue-700">{contract.staticLawyerFee} ₼</span>
                            </div>
                            <p className="text-xs text-blue-700 mt-1">Müqavilə üzrə statik ödəniş</p>
                          </div>

                          {/* Allowed Categories */}
                          <div>
                            <div className="text-sm mb-2">İcazə verilən iş növləri:</div>
                            <div className="flex flex-wrap gap-2">
                              {contract.allowedCategories?.map(cat => (
                                <Badge key={cat} variant="secondary" className="text-xs">
                                  {cat}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {contract.notes && (
                            <div className="text-sm p-3 bg-muted/30 rounded-lg">
                              <span className="font-medium">Qeyd: </span>
                              {contract.notes}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="contracts" className="flex-1 overflow-auto mt-4">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4">
                {contracts.length === 0 ? (
                  <Card className="p-8 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Heç bir müqavilə yoxdur</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Müqavilə yaratmaq üçün Müqavilə Bazasına daxil olun
                    </p>
                  </Card>
                ) : (
                  contracts.map(contract => {
                    const usagePercentage = Math.round((contract.tasksUsed / contract.taskQuota) * 100);
                    
                    return (
                      <Card key={contract.id}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <CardTitle className="text-base">{contract.name}</CardTitle>
                                <Badge className={getContractStatusColor(contract.status)}>
                                  {getContractStatusLabel(contract.status)}
                                </Badge>
                              </div>
                              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                                <p>ID: {contract.id}</p>
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  <span>{getLawyerName(contract.assignedLawyer)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingContract(contract)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteContract(contract.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Başlama:</span>
                              <p className="font-medium">{new Date(contract.startDate).toLocaleDateString('az-AZ')}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Bitmə:</span>
                              <p className="font-medium">{new Date(contract.endDate).toLocaleDateString('az-AZ')}</p>
                            </div>
                          </div>
                          
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Kvota: {contract.tasksUsed} / {contract.taskQuota}</span>
                              <span>{usagePercentage}%</span>
                            </div>
                            <Progress value={usagePercentage} />
                          </div>

                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-blue-900">Vəkil Haqqı</span>
                              <span className="text-lg font-bold text-blue-700">{contract.staticLawyerFee} ₼</span>
                            </div>
                          </div>

                          {contract.notes && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Qeyd:</span>
                              <p className="mt-1">{contract.notes}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Edit Contract Dialog */}
      {editingContract && (
        <Dialog open={!!editingContract} onOpenChange={() => setEditingContract(null)}>
          <DialogContent className="max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Müqaviləni Düzəliş Et</DialogTitle>
              <DialogDescription>
                Müqavilə parametrlərini dəyişin
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Müqavilə Adı</Label>
                <Input
                  value={editingContract.name}
                  onChange={(e) => setEditingContract({ ...editingContract, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Tapşırıq Kvotası</Label>
                <Input
                  type="number"
                  min="1"
                  value={editingContract.taskQuota}
                  onChange={(e) => {
                    const newQuota = parseInt(e.target.value) || 0;
                    const remaining = newQuota - editingContract.tasksUsed;
                    setEditingContract({ 
                      ...editingContract, 
                      taskQuota: newQuota,
                      tasksRemaining: remaining
                    });
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Cari istifadə: {editingContract.tasksUsed} / {editingContract.taskQuota}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Başlama Tarixi</Label>
                  <Input
                    type="date"
                    value={editingContract.startDate}
                    onChange={(e) => setEditingContract({ ...editingContract, startDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Bitmə Tarixi</Label>
                  <Input
                    type="date"
                    value={editingContract.endDate}
                    onChange={(e) => setEditingContract({ ...editingContract, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editingContract.status}
                  onChange={(e) => setEditingContract({ 
                    ...editingContract, 
                    status: e.target.value as Contract['status']
                  })}
                >
                  <option value="active">Aktiv</option>
                  <option value="expired">Bitib</option>
                  <option value="suspended">Dayandırılıb</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>İcazə verilən iş növləri</Label>
                {loadingTypes ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Yüklənir...
                  </div>
                ) : taskTypes.length === 0 ? (
                  <p className="text-sm text-yellow-600 p-2 bg-yellow-50 rounded">
                    Heç bir iş növü tapılmadı.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2">
                    {taskTypes.map(function(tt) {
                      var isChecked = editCategories.includes(tt.name);
                      return (
                        <div key={tt.id} className="flex items-center gap-2">
                          <Checkbox
                            id={'edit-tt-' + tt.id}
                            checked={isChecked}
                            onCheckedChange={function() { toggleEditCategory(tt.name); }}
                          />
                          <Label htmlFor={'edit-tt-' + tt.id} className="text-sm cursor-pointer flex-1">
                            {tt.name}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}
                {editCategories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {editCategories.map(function(cat) {
                      return (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {cat}
                          <button className="ml-1 hover:text-destructive" onClick={function() { toggleEditCategory(cat); }}>×</button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setEditingContract(null)}>
                Ləğv et
              </Button>
              <Button onClick={() => handleUpdateContract({
                ...editingContract,
                lastModified: new Date().toISOString()
              })}>
                Yadda saxla
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}