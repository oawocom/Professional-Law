"use client";
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import {
  ClipboardList, Calendar, Briefcase, ArrowRight, Inbox, AlertCircle, Clock,
  Archive, Loader2, MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { fetchApi } from '../../utils/apiHelper';
import { toast } from 'sonner';

interface ContractTasksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: any;
  tasks: any[];
  lawyers?: any[];
  filterByLawyerId?: string | number;
  onSelectTask?: (task: any) => void;
  onRefresh?: () => void;
  onBack?: () => void;
}

function formatDateAz(d?: string | Date | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('az-AZ'); } catch { return String(d); }
}

function getStatusBadge(status: string) {
  var s = (status || '').toString();
  if (s === 'completed' || s === 'icra_olundu' || s === 'tamamlandi') return <Badge className="bg-green-100 text-green-800 text-xs">İcra edildi</Badge>;
  if (s === 'in_progress' || s === 'in-progress' || s === 'davam_edir') return <Badge className="bg-yellow-100 text-yellow-800 text-xs">Davam edir</Badge>;
  if (s === 'tehkim_gozleyir' || s === 'pending' || s === 'new') return <Badge className="bg-blue-100 text-blue-800 text-xs">Yeni</Badge>;
  if (s === 'tehkim_olundu' || s === 'assigned') return <Badge className="bg-purple-100 text-purple-800 text-xs">Təhkim olundu</Badge>;
  return <Badge variant="outline" className="text-xs">{s || '—'}</Badge>;
}

function getPriorityIcon(priority: string) {
  if (priority === 'high' || priority === 'urgent') return <AlertCircle className="h-3 w-3 text-red-500" />;
  if (priority === 'medium' || priority === 'normal') return <Clock className="h-3 w-3 text-orange-500" />;
  return null;
}

export function ContractTasksModal({ open, onOpenChange, contract, tasks, lawyers, filterByLawyerId, onSelectTask, onRefresh, onBack }: ContractTasksModalProps) {
  var contractId = contract && (contract.id || contract.ID);
  var contractTitle = contract ? (contract.title || contract.name || 'Müqavilə #' + contractId) : '';
  var [archivingContract, setArchivingContract] = useState(false);
  var [archivingTaskId, setArchivingTaskId] = useState<any>(null);

  var contractTasks = useMemo(function() {
    if (!contract || !tasks) return [];
    return tasks.filter(function(t: any) {
      var tcid = t.contract_id || t.contractId;
      if (String(tcid) !== String(contractId)) return false;
      if (t.is_archived || t.isArchived) return false; // arxivləşdirilmişlər siyahıda görünmür
      if (filterByLawyerId !== undefined && filterByLawyerId !== null && filterByLawyerId !== '') {
        var tlid = t.assigned_to || t.assignedTo;
        if (String(tlid) !== String(filterByLawyerId)) return false;
      }
      return true;
    });
  }, [contract, tasks, filterByLawyerId, contractId]);

  var getLawyerName = function(id: any) {
    if (!id || !lawyers) return '—';
    var l = lawyers.find(function(x: any) { return String(x.id) === String(id); });
    return l ? l.name : '#' + id;
  };

  var handleTaskClick = function(task: any) {
    if (onSelectTask) {
      onSelectTask(task);
      onOpenChange(false);
    }
  };

  var handleArchiveContract = async function() {
    if (!contractId) return;
    if (!confirm('Bu müqaviləni arxivləşdirmək istədiyinizə əminsiniz? Sonradan arxivdən bərpa edə bilərsiniz.')) return;
    setArchivingContract(true);
    try {
      await fetchApi('/contracts/' + contractId + '/archive', {
        method: 'PUT',
        body: JSON.stringify({ is_archived: true }),
      });
      toast.success('Müqavilə arxivə göndərildi');
      if (onRefresh) onRefresh();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Arxivləşdirmə xətası: ' + (err?.message || ''));
    } finally {
      setArchivingContract(false);
    }
  };

  var handleArchiveTask = async function(task: any) {
    if (!confirm((task.title || 'Bu tapşırığı') + ' arxivləşdirmək istədiyinizə əminsiniz?')) return;
    setArchivingTaskId(task.id);
    try {
      await fetchApi('/tasks/' + task.id + '/archive', {
        method: 'PUT',
        body: JSON.stringify({ is_archived: true }),
      });
      toast.success('Tapşırıq arxivə göndərildi');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error('Arxivləşdirmə xətası: ' + (err?.message || ''));
    } finally {
      setArchivingTaskId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] h-[85vh] p-0 gap-0 overflow-hidden flex flex-col" onBack={onBack} backLabel="Geri qayıt">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Müqavilə daxilində verilmiş tapşırıqlar
              </DialogTitle>
              <DialogDescription className="text-xs">
                <span className="font-medium">{contractTitle}</span>
                {' — '}{contractTasks.length} tapşırıq
              </DialogDescription>
            </div>

            {/* Müqaviləni arxivləşdirmək düyməsi */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleArchiveContract}
              disabled={archivingContract}
              type="button"
              className="shrink-0 text-amber-700 border-amber-300 hover:bg-amber-50"
            >
              {archivingContract ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Archive className="h-3.5 w-3.5 mr-1.5" />}
              Müqaviləni arxivləşdir
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0 px-6 py-4">
          <ScrollArea className="h-full pr-3">
            {contractTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Inbox className="h-12 w-12 text-muted-foreground mb-3 opacity-60" />
                <h3 className="font-medium mb-1">Tapşırıq yoxdur</h3>
                <p className="text-sm text-muted-foreground">Bu müqavilə üzrə hələ tapşırıq verilməyib</p>
              </div>
            ) : (
              <div className="space-y-2">
                {contractTasks.map(function(task: any) {
                  var taskTitle = task.title || ('Tapşırıq #' + task.id);
                  var status = task.status || 'new';
                  var priority = task.priority || 'medium';
                  var taskBusy = archivingTaskId === task.id;
                  return (
                    <Card key={task.id}
                      className="hover:shadow-md hover:border-primary/40 transition-all">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={function() { handleTaskClick(task); }}
                          >
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              {getPriorityIcon(priority)}
                              {getStatusBadge(status)}
                              {task.task_number && (
                                <span className="text-[11px] text-muted-foreground font-mono">{task.task_number}</span>
                              )}
                            </div>
                            <h4 className="font-medium text-sm leading-tight mb-1">{taskTitle}</h4>
                            {task.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <div className="flex items-center gap-1">
                                <Briefcase className="h-3 w-3" />
                                <span>{getLawyerName(task.assigned_to || task.assignedTo)}</span>
                              </div>
                              {task.deadline && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>{formatDateAz(task.deadline)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-start gap-1 shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" type="button">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={function() { handleTaskClick(task); }}>
                                  <ArrowRight className="h-3.5 w-3.5 mr-2" />Detallarına bax
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={function() { handleArchiveTask(task); }} disabled={taskBusy}>
                                  {taskBusy ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Archive className="h-3.5 w-3.5 mr-2" />}
                                  Arxivləşdir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="px-6 py-3 border-t shrink-0 flex justify-end">
          <Button variant="outline" onClick={function() { onOpenChange(false); }} type="button">Bağla</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}