import { fetchApi } from '../../utils/apiHelper';
import { formatDate as sharedFormatDate } from '../../utils/dateFormat';
import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, User,
  CheckCircle, AlertCircle, FileText, Filter, ArrowRight,
} from 'lucide-react';

interface DeadlineCalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks?: any[];
  lawyers?: any[];
  onSelectTask?: (task: any) => void;
  onRefresh?: () => void;
}

var azMonths = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun',
  'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
];
var azDays = ['B.', 'B.e', 'Ç.a', 'Ç.', 'C.a', 'C.', 'Ş.'];

// red    = deadline keçmiş
// yellow = 1 gün və ya az qalmış
// green  = 1 həftə (7 gün) və ya az qalmış
// null   = 1 həftədən çox qalır VƏ YA tamamlanıb
function getUrgency(deadline: string | Date | null | undefined, status: string): 'red' | 'yellow' | 'green' | null {
  if (!deadline) return null;
  if (status === 'completed') return null;

  var dl = new Date(deadline);
  if (isNaN(dl.getTime())) return null;

  var now = new Date();
  var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var startOfDeadline = new Date(dl.getFullYear(), dl.getMonth(), dl.getDate());
  var diffDays = Math.round((startOfDeadline.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'red';
  if (diffDays <= 1) return 'yellow';
  if (diffDays <= 7) return 'green';
  return null;
}

function urgencyDotColor(u: 'red' | 'yellow' | 'green' | null): string {
  if (u === 'red') return 'bg-red-500';
  if (u === 'yellow') return 'bg-yellow-500';
  if (u === 'green') return 'bg-green-500';
  return '';
}

function urgencyLabel(u: 'red' | 'yellow' | 'green' | null): string {
  if (u === 'red') return 'Gecikmiş';
  if (u === 'yellow') return '1 gün qalıb';
  if (u === 'green') return '1 həftə qalıb';
  return '—';
}

export function DeadlineCalendarModal({ open, onOpenChange, tasks: rawTasks, lawyers, onSelectTask, onRefresh }: DeadlineCalendarModalProps) {
  var [currentDate, setCurrentDate] = useState(function() { return new Date(); });
  var [selectedDate, setSelectedDate] = useState<string | null>(null);
  var [filterUrgency, setFilterUrgency] = useState<string>('all');
  var [filterCreatedBy, setFilterCreatedBy] = useState<string>('all');
  var [legendFilter, setLegendFilter] = useState<'red' | 'yellow' | 'green' | null>(null);

  useEffect(function() {
    if (!open || !onRefresh) return;
    var iv = setInterval(function() {
      if (document.visibilityState === 'visible') onRefresh();
    }, 30000);
    return function() { clearInterval(iv); };
  }, [open, onRefresh]);

  var enrichedTasks = useMemo(function() {
    if (!rawTasks) return [];
    return (rawTasks || [])
      .filter(function(t: any) { return t.deadline; })
      .map(function(t: any) {
        var status = t.status || 'pending';
        var urgency = getUrgency(t.deadline, status);
        var deadlineDateStr = '';
        try {
          var d = new Date(t.deadline);
          deadlineDateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        } catch { /* ignore */ }
        return {
          id: t.id,
          title: t.title || 'Adsız tapşırıq',
          deadline: t.deadline,
          deadlineDateStr: deadlineDateStr,
          status: status,
          urgency: urgency,
          priority: t.priority || 'medium',
          clientName: t.clientName || t.client_name || (t.client && t.client.name) || '—',
          lawyerName: t.lawyerName || t.lawyer_name || t.assignedLawyer || (t.assignee && t.assignee.name) || (t.lawyer && t.lawyer.name) || undefined,
          // Backend indi hər tapşırığa real "created_by_role" (yaradan
          // istifadəçinin həqiqi rolu) əlavə edir — əvvəllər `t.createdBy`
          // heç vaxt 'client' sətri olmurdu (rəqəmsal user ID idi), ona görə
          // bu filtr həmişə 'manager' qaytarırdı.
          createdBy: (t.createdByRole || t.created_by_role) === 'client' ? 'client' : 'manager',
          raw: t,
        };
      });
  }, [rawTasks]);

  var filteredTasks = useMemo(function() {
    return enrichedTasks.filter(function(t: any) {
      if (filterUrgency !== 'all') {
        if (filterUrgency === 'none' && t.urgency !== null) return false;
        if (filterUrgency !== 'none' && t.urgency !== filterUrgency) return false;
      }
      if (filterCreatedBy !== 'all' && t.createdBy !== filterCreatedBy) return false;
      return true;
    });
  }, [enrichedTasks, filterUrgency, filterCreatedBy]);

  var todayStr = useMemo(function() {
    var n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
  }, []);

  var stats = useMemo(function() {
    return {
      total: enrichedTasks.length,
      red: enrichedTasks.filter(function(t: any) { return t.urgency === 'red'; }).length,
      yellow: enrichedTasks.filter(function(t: any) { return t.urgency === 'yellow'; }).length,
      green: enrichedTasks.filter(function(t: any) { return t.urgency === 'green'; }).length,
    };
  }, [enrichedTasks]);

  var getTasksForDate = function(date: string) {
    return filteredTasks.filter(function(t: any) { return t.deadlineDateStr === date; });
  };

  var navigateMonth = function(direction: 'prev' | 'next') {
    setCurrentDate(function(prev) {
      var nd = new Date(prev);
      if (direction === 'prev') nd.setMonth(prev.getMonth() - 1);
      else nd.setMonth(prev.getMonth() + 1);
      return nd;
    });
    setSelectedDate(null);
  };

  var goToToday = function() {
    setCurrentDate(new Date());
    setSelectedDate(todayStr);
  };

  var getDaysInMonth = function(date: Date) {
    var year = date.getFullYear();
    var month = date.getMonth();
    var firstDay = new Date(year, month, 1);
    var lastDay = new Date(year, month + 1, 0);
    return { daysInMonth: lastDay.getDate(), startingDayOfWeek: firstDay.getDay() };
  };

  var handleTaskClick = function(task: any) {
    if (onSelectTask) {
      onSelectTask(task.raw);
      onOpenChange(false);
    }
  };

  var dim = getDaysInMonth(currentDate);
  var daysInMonth = dim.daysInMonth;
  var startingDayOfWeek = dim.startingDayOfWeek;

  var renderCalendar = function() {
    var days = [];
    for (var i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={'empty-' + i} className="h-24 border border-gray-200 bg-gray-50" />);
    }
    for (var day = 1; day <= daysInMonth; day++) {
      var dateStr = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      var dayTasks = getTasksForDate(dateStr);

      var redCount = dayTasks.filter(function(t: any) { return t.urgency === 'red'; }).length;
      var yellowCount = dayTasks.filter(function(t: any) { return t.urgency === 'yellow'; }).length;
      var greenCount = dayTasks.filter(function(t: any) { return t.urgency === 'green'; }).length;

      var isSelected = selectedDate === dateStr;
      var isToday = dateStr === todayStr;

      (function(d, ds) {
        days.push(
          <div key={d}
            className={
              'h-24 border border-gray-200 p-1.5 cursor-pointer transition-all hover:shadow-md hover:bg-blue-50/40 ' +
              (isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : '') + ' ' +
              (isToday ? 'border-orange-400 border-2' : '')
            }
            onClick={function() { setSelectedDate(function(prev) { return prev === ds ? null : ds; }); }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={'text-xs font-medium ' + (isToday ? 'text-orange-600 font-bold' : '')}>{d}</span>
              {dayTasks.length > 0 && (
                <Badge variant="secondary" className="text-xs h-4 px-1">{dayTasks.length}</Badge>
              )}
            </div>

            {(redCount > 0 || yellowCount > 0 || greenCount > 0) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {redCount > 0 && (
                  <div className="flex items-center gap-0.5" title={redCount + ' gecikmiş tapşırıq'}>
                    <span className="block w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" />
                    {redCount > 1 && <span className="text-[10px] text-red-600 font-semibold">{redCount}</span>}
                  </div>
                )}
                {yellowCount > 0 && (
                  <div className="flex items-center gap-0.5" title={yellowCount + ' tapşırığa 1 gün qalıb'}>
                    <span className="block w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-sm" />
                    {yellowCount > 1 && <span className="text-[10px] text-yellow-700 font-semibold">{yellowCount}</span>}
                  </div>
                )}
                {greenCount > 0 && (
                  <div className="flex items-center gap-0.5" title={greenCount + ' tapşırığa 1 həftə qalıb'}>
                    <span className="block w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm" />
                    {greenCount > 1 && <span className="text-[10px] text-green-700 font-semibold">{greenCount}</span>}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-0.5 mt-1">
              {dayTasks.slice(0, 1).map(function(task: any) {
                return (
                  <div key={task.id}
                    className="text-[10px] px-1 py-0.5 rounded bg-gray-100 truncate text-gray-700"
                    title={task.title}>
                    {task.title.length > 18 ? task.title.substring(0, 18) + '…' : task.title}
                  </div>
                );
              })}
              {dayTasks.length > 1 && (
                <div className="text-[10px] text-muted-foreground px-1">+{dayTasks.length - 1} daha</div>
              )}
            </div>
          </div>
        );
      })(day, dateStr);
    }
    return days;
  };

  var selectedDateTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  var legendFilteredTasks = useMemo(function() {
    if (!legendFilter) return [];
    return enrichedTasks
      .filter(function(t: any) { return t.urgency === legendFilter; })
      .slice()
      .sort(function(a: any, b: any) { return new Date(a.deadline).getTime() - new Date(b.deadline).getTime(); });
  }, [enrichedTasks, legendFilter]);

  var toggleLegendFilter = function(u: 'red' | 'yellow' | 'green') {
    setLegendFilter(function(prev) { return prev === u ? null : u; });
  };

  var navigateToTask = function(task: any) {
    if (!task.deadlineDateStr) return;
    var parts = task.deadlineDateStr.split('-');
    var y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1;
    setCurrentDate(new Date(y, m, 1));
    setSelectedDate(task.deadlineDateStr);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />Deadline təqvimi
          </DialogTitle>
          <DialogDescription>
            Deadline-ı keçmiş, 1 gün və 1 həftə qalmış tapşırıqlar — rəngli nöqtələr ilə
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={function() { navigateMonth('prev'); }} type="button">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="font-medium min-w-[200px] text-center">
                  {azMonths[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h3>
                <Button variant="outline" size="sm" onClick={function() { navigateMonth('next'); }} type="button">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={goToToday} type="button">Bu gün</Button>
            </div>

            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <button type="button"
                className={'flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ' + (legendFilter === 'red' ? 'border-red-400 bg-red-50 ring-1 ring-red-300' : 'border-transparent hover:bg-gray-100')}
                onClick={function() { toggleLegendFilter('red'); }}>
                <span className="block w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs">Gecikmiş</span>
                <Badge variant="outline" className="text-[10px] h-4 px-1 ml-0.5">{stats.red}</Badge>
              </button>
              <button type="button"
                className={'flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ' + (legendFilter === 'yellow' ? 'border-yellow-400 bg-yellow-50 ring-1 ring-yellow-300' : 'border-transparent hover:bg-gray-100')}
                onClick={function() { toggleLegendFilter('yellow'); }}>
                <span className="block w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-xs">1 gün qalıb</span>
                <Badge variant="outline" className="text-[10px] h-4 px-1 ml-0.5">{stats.yellow}</Badge>
              </button>
              <button type="button"
                className={'flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ' + (legendFilter === 'green' ? 'border-green-400 bg-green-50 ring-1 ring-green-300' : 'border-transparent hover:bg-gray-100')}
                onClick={function() { toggleLegendFilter('green'); }}>
                <span className="block w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs">1 həftə qalıb</span>
                <Badge variant="outline" className="text-[10px] h-4 px-1 ml-0.5">{stats.green}</Badge>
              </button>
              {legendFilter && (
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" type="button" onClick={function() { setLegendFilter(null); }}>
                  Filtri sıfırla
                </Button>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-auto space-y-4">
              <div className="grid grid-cols-7 gap-0 border border-gray-200 rounded-lg overflow-hidden">
                {azDays.map(function(day) {
                  return <div key={day} className="bg-gray-100 border-b border-gray-200 p-2 text-center text-xs font-medium">{day}</div>;
                })}
                {renderCalendar()}
              </div>

              {legendFilter && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <span className={'block w-2.5 h-2.5 rounded-full ' + urgencyDotColor(legendFilter)} />
                      {urgencyLabel(legendFilter)} ({legendFilteredTasks.length})
                    </h4>
                    {legendFilteredTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Bu kateqoriyada tapşırıq yoxdur</p>
                    ) : (
                      <div className="space-y-2">
                        {legendFilteredTasks.map(function(task: any) {
                          return (
                            <div key={task.id}
                              className="flex items-center justify-between gap-2 p-2.5 rounded-lg border hover:shadow-sm hover:bg-blue-50/30 cursor-pointer transition-all"
                              onClick={function() { navigateToTask(task); }}>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{task.title}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                  <span className="flex items-center gap-1"><User className="h-3 w-3" />{task.clientName}</span>
                                  <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{task.deadlineDateStr}</span>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" type="button"
                                onClick={function(e: any) { e.stopPropagation(); handleTaskClick(task); }}>
                                Bax<ArrowRight className="h-3 w-3 ml-1" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 overflow-auto">
            <Card>
              <CardContent className="p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2"><FileText className="h-4 w-4" />Statistika</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Cəmi (deadline-lı):</span>
                    <Badge variant="outline">{stats.total}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5"><span className="block w-2.5 h-2.5 rounded-full bg-red-500" />Gecikmiş:</span>
                    <Badge className="bg-red-500 text-white">{stats.red}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5"><span className="block w-2.5 h-2.5 rounded-full bg-yellow-500" />1 gün qalıb:</span>
                    <Badge className="bg-yellow-500 text-white">{stats.yellow}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5"><span className="block w-2.5 h-2.5 rounded-full bg-green-500" />1 həftə qalıb:</span>
                    <Badge className="bg-green-500 text-white">{stats.green}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2"><Filter className="h-4 w-4" />Filtrlər</h4>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Təcillik</Label>
                    <Select value={filterUrgency} onValueChange={setFilterUrgency}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Hamısı</SelectItem>
                        <SelectItem value="red">Yalnız gecikmiş</SelectItem>
                        <SelectItem value="yellow">Yalnız 1 gün qalıb</SelectItem>
                        <SelectItem value="green">Yalnız 1 həftə qalıb</SelectItem>
                        <SelectItem value="none">Daha sonra (1 həftədən çox)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Yaradan</Label>
                    <Select value={filterCreatedBy} onValueChange={setFilterCreatedBy}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Hamısı</SelectItem>
                        <SelectItem value="manager">Menecer</SelectItem>
                        <SelectItem value="client">Müştəri</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" type="button"
                    onClick={function() { setFilterUrgency('all'); setFilterCreatedBy('all'); }}>
                    Filtri sıfırla
                  </Button>
                </div>
              </CardContent>
            </Card>

            {selectedDate && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">
                      {sharedFormatDate(selectedDate)}
                    </h4>
                  </div>
                  {selectedDateTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Bu tarixdə tapşırıq yoxdur</p>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2 pr-2">
                        {selectedDateTasks.map(function(task: any) {
                          var dotColor = urgencyDotColor(task.urgency);
                          return (
                            <Card key={task.id}
                              className={'cursor-pointer hover:shadow-md transition-all border-l-4 ' + (task.urgency === 'red' ? 'border-l-red-500' : task.urgency === 'yellow' ? 'border-l-yellow-500' : task.urgency === 'green' ? 'border-l-green-500' : 'border-l-slate-400')}
                              onClick={function() { handleTaskClick(task); }}>
                              <CardContent className="p-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2 flex-1 min-w-0">
                                    {dotColor && <span className={'block w-2.5 h-2.5 rounded-full mt-1 shrink-0 ' + dotColor} />}
                                    <h5 className="text-sm font-medium leading-tight">{task.title}</h5>
                                  </div>
                                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                </div>
                                <div className="space-y-1 text-xs text-muted-foreground pl-4">
                                  <div className="flex items-center gap-1"><User className="h-3 w-3" /><span>{task.clientName}</span></div>
                                  {task.lawyerName && (
                                    <div className="flex items-center gap-1"><User className="h-3 w-3" /><span>Vəkil: {task.lawyerName}</span></div>
                                  )}
                                  <div className="flex items-center gap-1"><Clock className="h-3 w-3" /><span>{urgencyLabel(task.urgency)}</span></div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={function() { onOpenChange(false); }} type="button">Bağla</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}