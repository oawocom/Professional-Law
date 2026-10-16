'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { getStatusLabel, getStatusColor } from '../../utils/taskStatusConstants';
import { Search, FileText, User, Calendar, Clock, MessageSquare, ChevronRight, Filter, MoreVertical, History, Archive, ArrowRightCircle } from 'lucide-react';

function fmtDate(d: any): string {
  if (!d) return '-';
  try {
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString('az-AZ');
  } catch { return String(d); }
}

interface TaskListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: any[];
  title?: string;
  lawyers?: any[];
  onTaskClick?: (task: any) => void;
  onChat?: (task: any) => void;
  onViewLogs?: (task: any) => void;
  onArchive?: (task: any) => void;
}

export function TaskListModal({ open, onOpenChange, tasks, title = 'Tapşırıqlar', lawyers = [], onTaskClick, onChat, onViewLogs, onArchive }: TaskListModalProps) {
  var [searchTerm, setSearchTerm] = useState('');
  var [statusFilter, setStatusFilter] = useState('all');
  var [priorityFilter, setPriorityFilter] = useState('all');
  var [lawyerFilter, setLawyerFilter] = useState('all');
  var [clientFilter, setClientFilter] = useState('all');
  var [activeFilter, setActiveFilter] = useState('all'); // all | active | passive
  var [filtersOpen, setFiltersOpen] = useState(false);

  // Derive unique values from actual data
  var statuses = Array.from(new Set((tasks || []).map(function(t: any) { return t.status; }).filter(Boolean)));
  var priorities = Array.from(new Set((tasks || []).map(function(t: any) { return t.priority; }).filter(Boolean)));
  var lawyerNames = Array.from(new Set((tasks || []).map(function(t: any) { return t.assignedLawyer || t.lawyer_name || t.assigned_lawyer || ''; }).filter(Boolean)));
  var clientNames = Array.from(new Set((tasks || []).map(function(t: any) { return t.clientName || t.client_name || t.client || ''; }).filter(Boolean)));

  var filteredTasks = (tasks || []).filter(function(task: any) {
    var t = task.title || task.taskTitle || '';
    var client = task.clientName || task.client_name || '';
    var lawyer = task.assignedLawyer || task.lawyer_name || task.assigned_lawyer || '';
    var matchSearch = !searchTerm ||
      t.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lawyer.toLowerCase().includes(searchTerm.toLowerCase());
    var matchStatus = statusFilter === 'all' || task.status === statusFilter;
    var matchPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    var matchLawyer = lawyerFilter === 'all' || lawyer === lawyerFilter;
    var matchClient = clientFilter === 'all' || client === clientFilter;
    var isArch = task.isArchived || task.is_archived;
    var matchActive = activeFilter === 'all' ||
      (activeFilter === 'active' && !isArch) ||
      (activeFilter === 'passive' && isArch);
    return matchSearch && matchStatus && matchPriority && matchLawyer && matchClient && matchActive;
  });

  var now = new Date();

  var getPriorityLabel = function(p: string) {
    if (p === 'high' || p === 'urgent') return 'Yüksək';
    if (p === 'medium' || p === 'normal') return 'Orta';
    if (p === 'low') return 'Aşağı';
    return p || '';
  };

  var getPriorityClass = function(p: string) {
    if (p === 'high' || p === 'urgent') return 'border-red-300 text-red-700';
    if (p === 'medium' || p === 'normal') return 'border-yellow-300 text-yellow-700';
    return 'border-green-300 text-green-700';
  };

  var isOverdue = function(deadline: string) {
    if (!deadline) return false;
    try { return new Date(deadline) < now; } catch { return false; }
  };

  var hasActiveFilter = statusFilter !== 'all' || priorityFilter !== 'all' || lawyerFilter !== 'all' || clientFilter !== 'all' || activeFilter !== 'all' || !!searchTerm;
  var activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (priorityFilter !== 'all' ? 1 : 0) + (lawyerFilter !== 'all' ? 1 : 0) + (clientFilter !== 'all' ? 1 : 0) + (activeFilter !== 'all' ? 1 : 0);
  var clearAllFilters = function() { setStatusFilter('all'); setPriorityFilter('all'); setLawyerFilter('all'); setClientFilter('all'); setActiveFilter('all'); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[90vw] max-h-[85vh] flex flex-col overflow-hidden" data-modal="all-tasks">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title} ({filteredTasks.length})
          </DialogTitle>
          <DialogDescription>Tapşırıqları görüntüləyin və idarə edin</DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="shrink-0 border-b pb-3 space-y-2">
          {/* Search + Filterlər düyməsi */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchTerm} onChange={function(e) { setSearchTerm(e.target.value); }} placeholder="Tapşırıq, müştəri, vəkil axtar..." className="pl-10 h-9 bg-muted/30 border-muted-foreground/20" />
            </div>

            <DropdownMenu open={filtersOpen} onOpenChange={setFiltersOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0">
                  <Filter className="h-4 w-4" />
                  Filterlər
                  {activeFilterCount > 0 && (
                    <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-3 space-y-3">
                {/* Vəziyyət (aktiv/passiv) */}
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Vəziyyət</p>
                  <div className="flex gap-1.5">
                    {[['all','Hamısı'],['active','Aktiv'],['passive','Passiv']].map(function(o) {
                      var isA = activeFilter === o[0];
                      return (
                        <button key={o[0]} onClick={function() { setActiveFilter(o[0]); }}
                          className={'px-2.5 py-1 rounded-md text-xs font-medium border transition-all ' +
                            (isA ? 'bg-slate-800 text-white border-slate-800' : 'bg-background text-muted-foreground border-muted-foreground/30 hover:border-slate-400')}>
                          {o[1]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Status */}
                {statuses.length >= 1 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Status</p>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Bütün statuslar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Bütün statuslar</SelectItem>
                        {statuses.map(function(s: any) { return <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>; })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Prioritet */}
                {priorities.length >= 1 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Prioritet</p>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Bütün prioritetlər" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Bütün prioritetlər</SelectItem>
                        {priorities.map(function(p: any) { return <SelectItem key={p} value={p}>{getPriorityLabel(p)}</SelectItem>; })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Vəkil */}
                {lawyerNames.length >= 1 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Vəkil</p>
                    <Select value={lawyerFilter} onValueChange={setLawyerFilter}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Bütün vəkillər" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Bütün vəkillər</SelectItem>
                        {lawyerNames.map(function(l: any) { return <SelectItem key={l} value={l}>{l}</SelectItem>; })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Müştəri */}
                {clientNames.length >= 1 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Müştəri</p>
                    <Select value={clientFilter} onValueChange={setClientFilter}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Bütün müştərilər" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Bütün müştərilər</SelectItem>
                        {clientNames.map(function(c: any) { return <SelectItem key={c} value={c}>{c}</SelectItem>; })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {hasActiveFilter && (
                  <button onClick={clearAllFilters}
                    className="w-full text-center text-[11px] text-red-500 hover:text-red-600 pt-1 border-t">
                    ✕ Filtrləri sıfırla
                  </button>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="text-[11px] text-muted-foreground tabular-nums">
            {filteredTasks.length}<span className="text-muted-foreground/50">/{(tasks || []).length}</span> tapşırıq
          </div>
        </div>

        {/* Task list */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-2 pr-2 py-1">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Tapşırıq tapılmadı</p>
              </div>
            ) : filteredTasks.map(function(task: any) {
              var tTitle = task.title || task.taskTitle || 'Tapşırıq';
              var tStatus = task.status || 'new';
              var tPriority = task.priority || 'normal';
              var tDeadline = task.deadline || task.managerDeadline || task.manager_deadline || '';
              var tClient = task.clientName || task.client_name || task.client || '';
              var tLawyer = task.assignedLawyer || task.lawyer_name || task.assigned_lawyer || '';
              var tCategory = task.category || task.taskTypeName || '';
              var overdue = isOverdue(tDeadline);

              return (
                <Card
                  key={task.id}
                  className={(onTaskClick ? 'cursor-pointer ' : '') + 'hover:shadow-md transition-all ' + (overdue ? 'border-red-300 bg-red-50/30' : '')}
                  onClick={onTaskClick ? function() { onTaskClick(task); } : undefined}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Title + badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-semibold truncate max-w-[280px]">{tTitle}</p>
                          <Badge className={getStatusColor(tStatus) + ' text-[10px]'}>{getStatusLabel(tStatus)}</Badge>
                          {(task.isArchived || task.is_archived) && (
                            <Badge className="bg-gray-200 text-gray-600 text-[10px]">Passiv</Badge>
                          )}
                          <Badge variant="outline" className={'text-[10px] ' + getPriorityClass(tPriority)}>
                            {getPriorityLabel(tPriority)}
                          </Badge>
                          {overdue && <Badge variant="destructive" className="text-[10px]">Gecikmiş</Badge>}
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {tClient && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />{tClient}
                            </span>
                          )}
                          {tLawyer && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3 text-blue-500" />{tLawyer}
                            </span>
                          )}
                          {tDeadline && (
                            <span className={'flex items-center gap-1 ' + (overdue ? 'text-red-600 font-medium' : '')}>
                              <Calendar className="h-3 w-3" />{fmtDate(tDeadline)}
                            </span>
                          )}
                          {tCategory && (
                            <Badge variant="secondary" className="text-[10px]">{tCategory}</Badge>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {onChat && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={function(e) { e.stopPropagation(); onChat(task); }}>
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {/* BUG DÜZƏLİŞİ (2026-09): bu üç menyu bəndi əvvəllər çağıran heç bir
                            handler ötürməsə belə HƏMİŞƏ göstərilirdi (məs. ReportsModal-ın
                            drill-down siyahısında) — nəticədə klikləmək üçün tamamilə "ölü"
                            görünürdü. İndi hər bənd yalnız uyğun handler ötürüldükdə görünür. */}
                        {(onViewLogs || onTaskClick || onArchive) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={function(e) { e.stopPropagation(); }}>
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={function(e: any) { e.stopPropagation(); }}>
                              {onViewLogs && (
                                <DropdownMenuItem onClick={function(e: any) { e.stopPropagation(); onViewLogs(task); }}>
                                  <History className="h-4 w-4 mr-2" />Tapşırığın logları
                                </DropdownMenuItem>
                              )}
                              {onTaskClick && (
                                <DropdownMenuItem onClick={function(e: any) { e.stopPropagation(); onTaskClick(task); }}>
                                  <ArrowRightCircle className="h-4 w-4 mr-2" />Tapşırığa keçid
                                </DropdownMenuItem>
                              )}
                              {onArchive && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-amber-600 focus:text-amber-700"
                                    onClick={function(e: any) { e.stopPropagation(); onArchive(task); }}>
                                    <Archive className="h-4 w-4 mr-2" />Arxivləşdir
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}