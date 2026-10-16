"use client";
import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import {
  Award, Phone, Mail, Briefcase, FolderOpen, ArrowRight, Calendar,
  CheckCircle, FileText, User,
} from 'lucide-react';

interface LawyerDetailModalProps {
  lawyer: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contracts?: any[];
  tasks?: any[];
  clients?: any[];
  onSelectContract?: (contract: any) => void;
}

function formatDateAz(d?: string | Date | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('az-AZ'); } catch { return String(d); }
}

export function LawyerDetailModal({ lawyer, open, onOpenChange, contracts = [], tasks = [], clients = [], onSelectContract }: LawyerDetailModalProps) {
  var assignedContracts = useMemo(function() {
    if (!lawyer) return [];
    var lid = String(lawyer.id);

    var contractsWithDirectAssign = contracts.filter(function(c: any) {
      var aid = c.assigned_lawyer_id || c.assignedLawyer || c.lawyer_id || c.lawyerId;
      return aid && String(aid) === lid;
    });

    var contractIdsViaTask = new Set();
    tasks.forEach(function(t: any) {
      var tlid = t.assigned_to || t.assignedTo;
      if (tlid && String(tlid) === lid) {
        var tcid = t.contract_id || t.contractId;
        if (tcid) contractIdsViaTask.add(String(tcid));
      }
    });
    var contractsViaTask = contracts.filter(function(c: any) {
      var cid = String(c.id || c.ID);
      return contractIdsViaTask.has(cid) && !contractsWithDirectAssign.some(function(cd: any) { return String(cd.id || cd.ID) === cid; });
    });

    return contractsWithDirectAssign.concat(contractsViaTask);
  }, [lawyer, contracts, tasks]);

  var stats = useMemo(function() {
    if (!lawyer) return { active: 0, completed: 0, total: 0 };
    var lid = String(lawyer.id);
    var lawyerTasks = tasks.filter(function(t: any) {
      var tlid = t.assigned_to || t.assignedTo;
      return tlid && String(tlid) === lid;
    });
    return {
      active: lawyerTasks.filter(function(t: any) {
        var s = t.status;
        return s !== 'completed' && s !== 'icra_olundu';
      }).length,
      completed: lawyerTasks.filter(function(t: any) {
        var s = t.status;
        return s === 'completed' || s === 'icra_olundu';
      }).length,
      total: lawyerTasks.length,
    };
  }, [lawyer, tasks]);

  if (!lawyer || !lawyer.name) return null;

  var initials = (lawyer.name || 'N/A').split(' ').map(function(n: string) { return n[0]; }).join('').slice(0, 2);

  var getClientName = function(clientId: any) {
    if (!clientId || !clients) return '—';
    var c = clients.find(function(x: any) { return String(x.id) === String(clientId); });
    return c ? c.name : '—';
  };

  var handleContractClick = function(contract: any) {
    if (onSelectContract) {
      onSelectContract(contract);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] h-[88vh] p-0 gap-0 overflow-hidden flex flex-col" data-modal="lawyer-detail">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-base">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg">{lawyer.name}</h2>
              <p className="text-xs text-muted-foreground font-normal">{lawyer.specialization || 'İxtisas göstərilməyib'}</p>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">Vəkil haqqında məlumat və təhkim olunmuş müqavilələr</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0 px-6 py-4">
          <ScrollArea className="h-full pr-3">
            <div className="space-y-4">

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />Ümumi məlumatlar
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {lawyer.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <a href={'mailto:' + lawyer.email} className="text-blue-600 hover:underline truncate">{lawyer.email}</a>
                      </div>
                    )}
                    {lawyer.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <a href={'tel:' + lawyer.phone} className="text-blue-600 hover:underline">{lawyer.phone}</a>
                      </div>
                    )}
                    {lawyer.specialization && (
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{lawyer.specialization}</span>
                      </div>
                    )}
                    {(lawyer.experience !== undefined && lawyer.experience !== null) && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>Təcrübə: {lawyer.experience} il</span>
                      </div>
                    )}
                    {lawyer.licenseNumber && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>Vəsiqə: {lawyer.licenseNumber}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Badge className={lawyer.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {lawyer.status === 'active' ? 'Aktiv' : (lawyer.status || 'Aktiv')}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />Tapşırıq statistikası
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 rounded-lg bg-blue-50">
                      <div className="text-xl font-bold text-blue-600">{stats.active}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">Aktiv</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-green-50">
                      <div className="text-xl font-bold text-green-600">{stats.completed}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">Tamamlanmış</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-gray-50">
                      <div className="text-xl font-bold text-gray-700">{stats.total}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">Cəmi</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Təhkim olunmuş müqavilələr
                    <Badge variant="secondary" className="ml-auto text-xs">{assignedContracts.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {assignedContracts.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Bu vəkilə müqavilə təhkim edilməyib</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {assignedContracts.map(function(contract: any) {
                        var contractTitle = contract.title || contract.name || 'Müqavilə #' + (contract.id || contract.ID);
                        var clientId = contract.client_id || contract.clientId;
                        var status = contract.status;

                        return (
                          <div key={contract.id || contract.ID}
                            className="flex items-center gap-3 p-3 rounded-lg border bg-white hover:shadow-sm hover:border-primary/40 cursor-pointer transition-all"
                            onClick={function() { handleContractClick(contract); }}>
                            <div className="p-2 rounded-lg bg-violet-50">
                              <FolderOpen className="h-4 w-4 text-violet-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <p className="font-medium text-sm truncate">{contractTitle}</p>
                                {status && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {status === 'active' ? 'Aktiv' : status === 'draft' ? 'Qaralama' : status === 'expired' ? 'Bitib' : status}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                {clientId && (
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    <span className="truncate">{getClientName(clientId)}</span>
                                  </div>
                                )}
                                {contract.endDate && (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatDateAz(contract.endDate)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </ScrollArea>
        </div>

        <div className="px-6 py-3 border-t shrink-0 flex justify-end">
          <Button variant="outline" onClick={function() { onOpenChange(false); }} type="button">Bağla</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}