import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent } from '../ui/card';
import { Separator } from '../ui/separator';
import { fetchApi } from '../../utils/apiHelper';
import { getStatusLabel, getStatusColor } from '../../utils/taskStatusConstants';
import { formatDate as fmtDate } from '../../utils/dateFormat';
import { NewClientModal } from './NewClientModal';
import { toast } from 'sonner';
import {
  User, Building2, Phone, Mail, MapPin, Calendar, FileText,
  ChevronDown, ChevronRight, Clock, Hash, Briefcase, UserCheck, Pencil,
  Users, Plus,
} from 'lucide-react';

function isLegalClientType(t: string): boolean {
  return t === 'legal' || t === 'company';
}

function g(obj: any, ...keys: string[]): any {
  if (!obj) return '';
  for (var k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return '';
}

interface ClientDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  tenantId?: number | null;
  allContracts?: any[];
  allTasks?: any[];
  onEditClient?: (client: any) => void;
  onRefresh?: () => void;
}

export function ClientDetailModal({ open, onOpenChange, client, tenantId, allContracts, allTasks, onEditClient, onRefresh }: ClientDetailModalProps) {
  var [contracts, setContracts] = useState<any[]>([]);
  var [tasks, setTasks] = useState<any[]>([]);
  var [loading, setLoading] = useState(false);
  var [expandedContract, setExpandedContract] = useState<string | null>(null);

  // === Hüquqi şəxsə bağlı Fərdi hesablar (yalnız Hüquqi şəxs tipli müştərilər üçün) ===
  var [linkedClients, setLinkedClients] = useState<any[]>([]);
  var [linkedLoading, setLinkedLoading] = useState(false);
  var [createLinkedOpen, setCreateLinkedOpen] = useState(false);

  var fetchLinkedClients = function() {
    if (!client) return;
    var clientId = String(client.id || client.ID || '');
    setLinkedLoading(true);
    fetchApi('/clients').then(function(all: any) {
      var list = Array.isArray(all) ? all : [];
      setLinkedClients(list.filter(function(c: any) {
        return String(c.parent_client_id || c.parentClientId || '') === clientId;
      }));
    }).catch(function() { setLinkedClients([]); }).finally(function() { setLinkedLoading(false); });
  };

  useEffect(function() {
    if (!open || !client) return;
    var clientId = String(client.id || client.ID || '');

    if (isLegalClientType(g(client, 'type', 'Type'))) {
      fetchLinkedClients();
    }

    if (allContracts && allTasks) {
      setContracts((allContracts || []).filter(function(c: any) {
        return String(c.client_id || c.clientId) === clientId;
      }));
      setTasks(allTasks || []);
      return;
    }

    setLoading(true);
    Promise.all([
      fetchApi('/contracts').catch(function() { return []; }),
      fetchApi('/tasks').catch(function() { return []; }),
    ]).then(function(results) {
      var clientContracts = (results[0] || []).filter(function(c: any) {
        return String(c.client_id || c.clientId) === clientId;
      });
      setContracts(clientContracts);
      setTasks(results[1] || []);
    }).finally(function() { setLoading(false); });
  }, [open, client, allContracts, allTasks]);

  if (!client) return null;

  var name = g(client, 'name', 'Name');
  var email = g(client, 'email', 'Email');
  var phone = g(client, 'phone', 'Phone');
  var companyName = g(client, 'company_name', 'companyName', 'company');
  var address = g(client, 'address', 'Address');
  var taxNumber = g(client, 'tax_number', 'taxNumber');
  var contactPerson = g(client, 'contact_person', 'contactPerson');
  var clientType = g(client, 'type', 'Type') || 'individual';
  var status = g(client, 'status', 'Status') || 'active';
  var source = g(client, 'source', 'Source');
  var notes = g(client, 'notes', 'Notes');
  var createdAt = g(client, 'created_at', 'createdAt');
  var initials = name ? name.split(' ').map(function(n: string) { return n[0]; }).join('').toUpperCase() : '?';
  var isLegal = isLegalClientType(clientType);

  var getContractTasks = function(contractId: any) {
    return tasks.filter(function(t: any) {
      return String(t.contract_id || t.contractId) === String(contractId);
    });
  };

  var clientTasks = tasks.filter(function(t: any) {
    return contracts.some(function(c: any) { return String(c.id) === String(t.contract_id || t.contractId); });
  });
  var activeCount = clientTasks.filter(function(t: any) {
    var s = t.status || '';
    return s !== 'completed' && s !== 'cancelled' && s !== 'is_tamamlandi' && s !== 'is_tehvil_verildi';
  }).length;
  var completedCount = clientTasks.length - activeCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" data-modal="client-detail-manager">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="text-lg bg-blue-100 text-blue-700">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <DialogTitle className="text-xl">{name}{companyName ? ' — ' + companyName : ''}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                  {status === 'active' ? 'Aktiv' : 'Deaktiv'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {isLegal ? 'Hüquqi şəxs' : 'Fiziki şəxs'}
                </Badge>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground flex flex-col items-end gap-2">
              <div>{contracts.length} müqavilə</div>
              <div>{activeCount} aktiv / {completedCount} tamamlanmış</div>
              {onEditClient && (
                <Button size="sm" variant="outline" className="h-7 text-xs" type="button"
                  onClick={function() { onEditClient(client); }}>
                  <Pencil className="h-3 w-3 mr-1" />Redaktə et
                </Button>
              )}
            </div>
          </div>
          <DialogDescription className="sr-only">Müştəri haqqında ətraflı məlumat</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className={'grid w-full shrink-0 ' + (isLegal ? 'grid-cols-3' : 'grid-cols-2')}>
            <TabsTrigger value="general" className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Ümumi
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Müqavilələr ({contracts.length})
            </TabsTrigger>
            {isLegal && (
              <TabsTrigger value="linked" className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Bağlı hesablar ({linkedClients.length})
              </TabsTrigger>
            )}
          </TabsList>

          {/* === ÜMUMİ TAB === */}
          <TabsContent value="general" className="flex-1 min-h-0 overflow-y-auto mt-4">
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Əsas məlumatlar</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoRow icon={Mail} label="E-poçt" value={email} />
                    <InfoRow icon={Phone} label="Telefon" value={phone} />
                    {companyName && <InfoRow icon={Building2} label="Şirkət adı" value={companyName} />}
                    {address && <InfoRow icon={MapPin} label="Ünvan" value={address} />}
                    {taxNumber && <InfoRow icon={Hash} label="VÖEN" value={taxNumber} />}
                    {contactPerson && <InfoRow icon={UserCheck} label="Əlaqə şəxsi" value={contactPerson} />}
                    {source && <InfoRow icon={Briefcase} label="Mənbə" value={source} />}
                    <InfoRow icon={Calendar} label="Qeydiyyat tarixi" value={fmtDate(createdAt)} />
                  </div>
                </CardContent>
              </Card>
              {notes && (
                <Card><CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-2">Qeydlər</h3>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{notes}</p>
                </CardContent></Card>
              )}
              <Card><CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">Statistika</h3>
                <div className="grid grid-cols-3 gap-4">
                  <StatBox value={contracts.length} label="Müqavilə" color="blue" />
                  <StatBox value={activeCount} label="Aktiv tapşırıq" color="amber" />
                  <StatBox value={completedCount} label="Tamamlanmış" color="green" />
                </div>
              </CardContent></Card>
            </div>
          </TabsContent>

          {/* === MÜQAVİLƏLƏR TAB === */}
          <TabsContent value="contracts" className="flex-1 min-h-0 overflow-y-auto mt-4">
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 animate-spin opacity-30" />
                  <p className="text-sm">Yüklənir...</p>
                </div>
              ) : contracts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Bu müştərinin müqaviləsi yoxdur</p>
                </div>
              ) : (
                contracts.map(function(contract: any) {
                  var cId = String(contract.id);
                  var isExpanded = expandedContract === cId;
                  var cTitle = contract.title || contract.name || ('Müqavilə #' + (contract.contract_number || cId));
                  var cStatus = contract.status || 'active';
                  var cCategory = contract.category || contract.type || '';
                  var cStartDate = contract.start_date || contract.startDate || '';
                  var cEndDate = contract.end_date || contract.endDate || '';
                  // QEYD: əvvəllər "value" 0/boş olduqda vəkil haqqı (static_lawyer_fee)
                  // — tamam fərqli bir maliyyə sahəsi — müqavilənin dəyəri kimi göstərilirdi.
                  // Bu iki sahə eyni şey deyil (biri müştəriyə qiymət, digəri vəkilə ödəniş),
                  // ona görə fallback çıxarıldı.
                  var cValue = Number(contract.value || 0);
                  var taskQuota = contract.task_quota || contract.taskQuota || 100;
                  var tasksUsed = contract.tasks_used || contract.tasksUsed || 0;
                  var cTasks = getContractTasks(cId);

                  return (
                    <Card key={cId} className={isExpanded ? 'ring-2 ring-blue-200' : ''}>
                      <CardContent className="p-0">
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={function() { setExpandedContract(isExpanded ? null : cId); }}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                              <FileText className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{cTitle}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {cCategory && <Badge variant="outline" className="text-[10px]">{cCategory}</Badge>}
                                <span className="text-[10px] text-muted-foreground">{fmtDate(cStartDate)} — {fmtDate(cEndDate)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <Badge className={cStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                              {cStatus === 'active' ? 'Aktiv' : cStatus}
                            </Badge>
                            <div className="text-right text-xs text-muted-foreground">
                              <p>{cTasks.length} tapşırıq</p>
                              <p>{tasksUsed}/{taskQuota}</p>
                            </div>
                            {cValue > 0 && <span className="text-sm font-semibold text-amber-700">₼{cValue.toLocaleString()}</span>}
                            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t">
                            {cTasks.length === 0 ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">Bu müqavilədə tapşırıq yoxdur</div>
                            ) : (
                              <div className="divide-y">
                                {cTasks.map(function(task: any) {
                                  var tTitle = task.title || '';
                                  var tStatus = task.status || 'new';
                                  var tPriority = task.priority || 'normal';
                                  var tRespondent = task.respondent_name || task.respondentName || '';
                                  var tDeadline = task.deadline || '';
                                  var tTotalClaim = Number(task.total_claim || task.totalClaim || 0);
                                  var tCreatedAt = task.created_at || task.createdAt || '';

                                  return (
                                    <div key={task.id} className="p-3 hover:bg-muted/20">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium truncate">{tTitle}</p>
                                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <Badge className={getStatusColor(tStatus) + ' text-[10px]'}>
                                              {getStatusLabel(tStatus)}
                                            </Badge>
                                            <Badge variant="outline" className={'text-[10px] ' + (
                                              tPriority === 'high' || tPriority === 'urgent' ? 'border-red-300 text-red-700' :
                                              tPriority === 'normal' || tPriority === 'medium' ? 'border-yellow-300 text-yellow-700' :
                                              'border-green-300 text-green-700'
                                            )}>
                                              {tPriority === 'high' || tPriority === 'urgent' ? 'Yüksək' : tPriority === 'normal' || tPriority === 'medium' ? 'Orta' : 'Aşağı'}
                                            </Badge>
                                            {tRespondent && <span className="text-[10px] text-muted-foreground">Cavabdeh: {tRespondent}</span>}
                                          </div>
                                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                                            {tDeadline && <span><Calendar className="h-3 w-3 inline mr-0.5" />{fmtDate(tDeadline)}</span>}
                                            {tCreatedAt && <span><Clock className="h-3 w-3 inline mr-0.5" />{fmtDate(tCreatedAt)}</span>}
                                          </div>
                                        </div>
                                        {tTotalClaim > 0 && <span className="text-xs font-semibold text-amber-700 ml-2">₼{tTotalClaim.toLocaleString()}</span>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* === BAĞLI HESABLAR TAB (yalnız Hüquqi şəxs) === */}
          {isLegal && (
            <TabsContent value="linked" className="flex-1 min-h-0 overflow-y-auto mt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Bu Hüquqi şəxsə bağlı Fərdi hesablar</p>
                  <Button size="sm" type="button" onClick={function() { setCreateLinkedOpen(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />Yeni bağlı hesab
                  </Button>
                </div>
                {linkedLoading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 animate-spin opacity-30" />
                    <p className="text-sm">Yüklənir...</p>
                  </div>
                ) : linkedClients.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Hələ bağlı Fərdi hesab yoxdur</p>
                  </div>
                ) : (
                  linkedClients.map(function(item: any) {
                    var itemInitials = (item.name || '?').split(' ').map(function(n: string) { return n[0]; }).join('').slice(0, 2).toUpperCase();
                    return (
                      <Card key={item.id}>
                        <CardContent className="p-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-9 w-9 shrink-0">
                              <AvatarFallback className="text-xs">{itemInitials}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                {item.email && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" />{item.email}</span>}
                                {item.phone && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{item.phone}</span>}
                                {item.is_archived && <Badge className="text-[8px] bg-gray-200 text-gray-700 h-4">Deaktiv</Badge>}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>

      <NewClientModal
        open={createLinkedOpen}
        parentClientId={client.id || client.ID}
        parentClientName={name}
        onOpenChange={setCreateLinkedOpen}
        onClientCreated={function() {
          fetchLinkedClients();
          if (onRefresh) onRefresh();
        }}
      />
    </Dialog>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value || '-'}</p>
      </div>
    </div>
  );
}

function StatBox({ value, label, color }: { value: number; label: string; color: string }) {
  var bg = color === 'blue' ? 'bg-blue-50' : color === 'amber' ? 'bg-amber-50' : 'bg-green-50';
  var text = color === 'blue' ? 'text-blue-700' : color === 'amber' ? 'text-amber-700' : 'text-green-700';
  return (
    <div className={'rounded-lg p-3 text-center ' + bg}>
      <p className={'text-xl font-bold ' + text}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}