"use client";
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ScrollArea } from "../ui/scroll-area";
import { TaskListModal } from "./TaskListModal";
import { fetchApi } from "../../utils/apiHelper";
import { toast } from "sonner";
import { getStatusLabel, getStatusColor, getStatusGroup, ALL_STATUSES, OTHER_STATUSES } from "../../utils/taskStatusConstants";
import { getClaimLabel } from "../../utils/claimConstants";
import {
  BarChart3, Users, Briefcase, Wallet, CalendarClock, Tags,
  Download, Filter, Lock, Clock,
  Building2, ChevronRight,
} from "lucide-react";

function fmtMoney(n: any): string {
  var v = parseFloat(n) || 0;
  return v.toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' AZN';
}
function fmtDate(d: any): string {
  if (!d) return '-';
  try {
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString('az-AZ');
  } catch { return String(d); }
}
function daysUntil(d: any): number {
  if (!d) return Infinity;
  var dt = new Date(d);
  var now = new Date();
  return Math.ceil((dt.getTime() - now.getTime()) / 86400000);
}
function downloadCsv(filename: string, rows: any[][]) {
  var csv = rows.map(function(row) {
    return row.map(function(cell) {
      var s = cell === null || cell === undefined ? '' : String(cell);
      if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
        s = '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(',');
  }).join('\n');
  var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

var REPORT_TABS = [
  { key: 'overview', label: 'Ümumi baxış', icon: BarChart3 },
  { key: 'status', label: 'Status üzrə', icon: Clock },
  { key: 'lawyers', label: 'Vəkillər üzrə', icon: Briefcase },
  { key: 'clients', label: 'Müştərilər üzrə', icon: Users },
  { key: 'finance', label: 'Maliyyə', icon: Wallet },
  { key: 'deadlines', label: 'Müddətlər', icon: CalendarClock },
  { key: 'category', label: 'Kateqoriya üzrə', icon: Tags },
];

interface ReportsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allTasks?: any[];
  lawyers?: any[];
  clients?: any[];
  contracts?: any[];
  /** BUG DÜZƏLİŞİ (2026-09): əvvəllər ötürülmürdü — drill-down siyahısındakı
   * tapşırıqlar klikləndikdə heç nə olmurdu (görünüşdə klikləmə mümkün idi). */
  onTaskClick?: (task: any) => void;
}

export function ReportsModal({ open, onOpenChange, allTasks, lawyers, clients, contracts, onTaskClick }: ReportsModalProps) {
  var tasks = allTasks || [];
  var lawyerList = lawyers || [];
  var clientList = clients || [];
  var contractList = contracts || [];

  var [activeReport, setActiveReport] = useState('overview');
  var [period, setPeriod] = useState('all');
  var [lawyerFilter, setLawyerFilter] = useState('all');
  var [clientFilter, setClientFilter] = useState('all');
  var [contractFilter, setContractFilter] = useState('all');
  var [statusFilter, setStatusFilter] = useState('all');
  var [categoryFilter, setCategoryFilter] = useState('all');

  var [drillOpen, setDrillOpen] = useState(false);
  var [drillTasks, setDrillTasks] = useState<any[]>([]);
  var [drillTitle, setDrillTitle] = useState('');

  // === İcazə yoxlaması — hesabatlar da imtiyaz matrisinə tabedir ===
  var [perms, setPerms] = useState<any>(null);
  useEffect(function() {
    if (!open) return;
    fetchApi('/auth/permissions').then(setPerms).catch(function() { setPerms(null); });
  }, [open]);
  var canView = !perms || !perms.restricted || !!(perms.permissions && perms.permissions.view_reports);
  var canExport = !perms || !perms.restricted || !!(perms.permissions && perms.permissions.export_reports);

  var openDrill = function(title: string, list: any[]) {
    setDrillTitle(title);
    setDrillTasks(list);
    setDrillOpen(true);
  };

  var handleExportAttempt = function(filename: string, rows: any[][]) {
    if (!canExport) {
      toast.error('Hesabatları ixrac etmək üçün icazəniz yoxdur.', { description: 'İstəyirsinizsə, admin/menecerdən bu icazəni açmasını xahiş edin.' });
      return;
    }
    downloadCsv(filename, rows);
    toast.success('Hesabat CSV olaraq endirildi');
  };

  var clientLabel = function(id: any) {
    var c = clientList.find(function(x) { return x.id === id; });
    return c ? (c.company_name || c.name) : ('#' + id);
  };
  var contractLabel = function(ct: any) {
    if (!ct) return '';
    var num = ct.contract_number ? ct.contract_number + ' — ' : '';
    return num + ct.title;
  };

  // === Filtrlənmiş tapşırıqlar (bütün hesabatların əsası) ===
  var filteredTasks = useMemo(function() {
    var now = new Date();
    var cutoff: Date | null = null;
    if (period !== 'all') {
      cutoff = new Date();
      if (period === 'week') cutoff.setDate(now.getDate() - 7);
      else if (period === 'month') cutoff.setMonth(now.getMonth() - 1);
      else if (period === 'quarter') cutoff.setMonth(now.getMonth() - 3);
      else if (period === 'year') cutoff.setFullYear(now.getFullYear() - 1);
    }
    return tasks.filter(function(t: any) {
      if (cutoff && new Date(t.created_at) < cutoff) return false;
      if (lawyerFilter !== 'all' && String(t.assigned_to) !== lawyerFilter) return false;
      if (clientFilter !== 'all' && String(t.client_id) !== clientFilter) return false;
      if (contractFilter !== 'all' && String(t.contract_id) !== contractFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && t.claim_category !== categoryFilter) return false;
      return true;
    });
  }, [tasks, period, lawyerFilter, clientFilter, contractFilter, statusFilter, categoryFilter]);

  var filteredContracts = useMemo(function() {
    return contractList.filter(function(c: any) {
      if (clientFilter !== 'all' && String(c.client_id) !== clientFilter) return false;
      if (contractFilter !== 'all' && String(c.id) !== contractFilter) return false;
      return true;
    });
  }, [contractList, clientFilter, contractFilter]);

  var now = new Date();
  var completedTasks = filteredTasks.filter(function(t: any) { return getStatusGroup(t.status) === 'completed' && t.status !== 'cancelled' && t.status !== 'rejected'; });
  var waitingTasks = filteredTasks.filter(function(t: any) { return getStatusGroup(t.status) === 'waiting'; });
  var inProgressTasks = filteredTasks.filter(function(t: any) { return getStatusGroup(t.status) === 'in_progress'; });
  var overdueTasks = filteredTasks.filter(function(t: any) {
    if (!t.deadline) return false;
    var grp = getStatusGroup(t.status);
    return new Date(t.deadline) < now && grp !== 'completed';
  });
  var totalClaimValue = filteredTasks.reduce(function(sum: number, t: any) { return sum + (parseFloat(t.total_claim) || 0); }, 0);
  var totalContractValue = filteredContracts.reduce(function(sum: number, c: any) { return sum + (parseFloat(c.value) || 0); }, 0);
  var activeContracts = filteredContracts.filter(function(c: any) { return c.status === 'active' && !c.is_archived; });

  // === Status üzrə qruplaşdırma ===
  var statusBreakdown = useMemo(function() {
    var map: Record<string, any[]> = {};
    filteredTasks.forEach(function(t: any) {
      var s = t.status || 'new';
      if (!map[s]) map[s] = [];
      map[s].push(t);
    });
    return Object.keys(map).map(function(s) {
      return { status: s, label: getStatusLabel(s), color: getStatusColor(s), tasks: map[s], count: map[s].length };
    }).sort(function(a, b) { return b.count - a.count; });
  }, [filteredTasks]);

  // === Vəkillər üzrə ===
  var lawyerBreakdown = useMemo(function() {
    return lawyerList.map(function(l: any) {
      var lTasks = filteredTasks.filter(function(t: any) { return t.assigned_to === l.id; });
      var lCompleted = lTasks.filter(function(t: any) { return getStatusGroup(t.status) === 'completed'; });
      var lOverdue = lTasks.filter(function(t: any) {
        if (!t.deadline) return false;
        return new Date(t.deadline) < now && getStatusGroup(t.status) !== 'completed';
      });
      var claimSum = lTasks.reduce(function(sum: number, t: any) { return sum + (parseFloat(t.total_claim) || 0); }, 0);
      return {
        lawyer: l, tasks: lTasks, count: lTasks.length, completedCount: lCompleted.length,
        overdueCount: lOverdue.length, claimSum: claimSum,
        completionRate: lTasks.length > 0 ? Math.round((lCompleted.length / lTasks.length) * 100) : 0,
      };
    }).sort(function(a, b) { return b.count - a.count; });
  }, [lawyerList, filteredTasks]);

  // === Müştərilər üzrə ===
  var clientBreakdown = useMemo(function() {
    return clientList.map(function(cl: any) {
      var cContracts = contractList.filter(function(c: any) { return c.client_id === cl.id; });
      var cTasks = filteredTasks.filter(function(t: any) { return t.client_id === cl.id; });
      var contractValue = cContracts.reduce(function(sum: number, c: any) { return sum + (parseFloat(c.value) || 0); }, 0);
      var claimSum = cTasks.reduce(function(sum: number, t: any) { return sum + (parseFloat(t.total_claim) || 0); }, 0);
      return { client: cl, contracts: cContracts, tasks: cTasks, contractValue: contractValue, claimSum: claimSum };
    }).filter(function(row) { return row.contracts.length > 0 || row.tasks.length > 0; })
      .sort(function(a, b) { return b.tasks.length - a.tasks.length; });
  }, [clientList, contractList, filteredTasks]);

  // === Kateqoriya üzrə ===
  var categoryBreakdown = useMemo(function() {
    var map: Record<string, any[]> = {};
    filteredTasks.forEach(function(t: any) {
      var key = t.claim_category || '(kateqoriyasız)';
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return Object.keys(map).map(function(key) {
      var claimSum = map[key].reduce(function(sum: number, t: any) { return sum + (parseFloat(t.total_claim) || 0); }, 0);
      return { key: key, label: key === '(kateqoriyasız)' ? key : getClaimLabel(key), tasks: map[key], count: map[key].length, claimSum: claimSum };
    }).sort(function(a, b) { return b.count - a.count; });
  }, [filteredTasks]);

  // === Müddətlər ===
  var deadlineBuckets = useMemo(function() {
    var active = filteredTasks.filter(function(t: any) { return t.deadline && getStatusGroup(t.status) !== 'completed'; });
    var overdue = active.filter(function(t: any) { return daysUntil(t.deadline) < 0; });
    var thisWeek = active.filter(function(t: any) { var d = daysUntil(t.deadline); return d >= 0 && d <= 7; });
    var thisMonth = active.filter(function(t: any) { var d = daysUntil(t.deadline); return d > 7 && d <= 30; });
    var later = active.filter(function(t: any) { return daysUntil(t.deadline) > 30; });
    return { overdue: overdue, thisWeek: thisWeek, thisMonth: thisMonth, later: later };
  }, [filteredTasks]);

  var hasActiveFilters = period !== 'all' || lawyerFilter !== 'all' || clientFilter !== 'all' || contractFilter !== 'all' || statusFilter !== 'all' || categoryFilter !== 'all';
  var clearFilters = function() {
    setPeriod('all'); setLawyerFilter('all'); setClientFilter('all'); setContractFilter('all'); setStatusFilter('all'); setCategoryFilter('all');
  };

  var usedCategoryKeys = Array.from(new Set(tasks.map(function(t: any) { return t.claim_category; }).filter(Boolean)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Hesabatlar</DialogTitle>
          <DialogDescription>Real məlumatlar əsasında hesabat növləri — filtrləyin, təhlil edin, ixrac edin</DialogDescription>
        </DialogHeader>

        {!canView ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
            <Lock className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Hesabatları görmək üçün icazəniz yoxdur</p>
            <p className="text-xs mt-1">İstəyirsinizsə, admin/menecerdən bu icazəni açmasını xahiş edin.</p>
          </div>
        ) : (
        <>
        {/* === Filtr paneli === */}
        <div className="shrink-0 border-b pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Dövr" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün vaxt</SelectItem>
                <SelectItem value="week">Son 1 həftə</SelectItem>
                <SelectItem value="month">Son 1 ay</SelectItem>
                <SelectItem value="quarter">Son 3 ay</SelectItem>
                <SelectItem value="year">Son 1 il</SelectItem>
              </SelectContent>
            </Select>
            <Select value={lawyerFilter} onValueChange={setLawyerFilter}>
              <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Vəkil" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün vəkillər</SelectItem>
                {lawyerList.map(function(l: any) { return <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>; })}
              </SelectContent>
            </Select>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Müştəri" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün müştərilər</SelectItem>
                {clientList.map(function(c: any) { return <SelectItem key={c.id} value={String(c.id)}>{c.company_name || c.name}</SelectItem>; })}
              </SelectContent>
            </Select>
            <Select value={contractFilter} onValueChange={setContractFilter}>
              <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Müqavilə" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün müqavilələr</SelectItem>
                {contractList.map(function(c: any) { return <SelectItem key={c.id} value={String(c.id)}>{contractLabel(c)}</SelectItem>; })}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün statuslar</SelectItem>
                {ALL_STATUSES.map(function(s) { return <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>; })}
                {OTHER_STATUSES.map(function(s) { return <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>; })}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Kateqoriya" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün kateqoriyalar</SelectItem>
                {usedCategoryKeys.map(function(k: any) { return <SelectItem key={k} value={k}>{getClaimLabel(k)}</SelectItem>; })}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-8 text-[11px] text-red-500" onClick={clearFilters}>Filtrləri sıfırla</Button>
            )}
            <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">{filteredTasks.length}/{tasks.length} tapşırıq</span>
          </div>
        </div>

        <Tabs value={activeReport} onValueChange={setActiveReport} className="flex-1 flex flex-col overflow-hidden mt-2">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-transparent p-0 justify-start shrink-0">
            {REPORT_TABS.map(function(rt) {
              var Icon = rt.icon;
              return (
                <TabsTrigger key={rt.key} value={rt.key} className="text-xs gap-1.5 data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                  <Icon className="h-3.5 w-3.5" />{rt.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* === ÜMUMİ BAXIŞ === */}
          <TabsContent value="overview" className="flex-1 overflow-y-auto mt-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="cursor-pointer hover:shadow-md" onClick={function() { openDrill('Bütün tapşırıqlar', filteredTasks); }}>
                <CardContent className="p-4">
                  <p className="text-2xl font-bold">{filteredTasks.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Ümumi tapşırıq</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md" onClick={function() { openDrill('Tamamlanmış tapşırıqlar', completedTasks); }}>
                <CardContent className="p-4">
                  <p className="text-2xl font-bold text-green-600">{completedTasks.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Tamamlanmış</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md" onClick={function() { openDrill('İcrada olan tapşırıqlar', inProgressTasks.concat(waitingTasks)); }}>
                <CardContent className="p-4">
                  <p className="text-2xl font-bold text-blue-600">{inProgressTasks.length + waitingTasks.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Aktiv (icrada/gözləyir)</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md border-red-200" onClick={function() { openDrill('Gecikmiş tapşırıqlar', overdueTasks); }}>
                <CardContent className="p-4">
                  <p className="text-2xl font-bold text-red-600">{overdueTasks.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Gecikmiş</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-2xl font-bold">{filteredContracts.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Müqavilə</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-2xl font-bold text-green-600">{activeContracts.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Aktiv müqavilə</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-lg font-bold">{fmtMoney(totalClaimValue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Ümumi iddia məbləği</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-lg font-bold">{fmtMoney(totalContractValue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Ümumi müqavilə dəyəri</p>
                </CardContent>
              </Card>
            </div>
            <div className="flex justify-end mt-3">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={function() {
                handleExportAttempt('umumi-baxis.csv', [
                  ['Göstərici', 'Dəyər'],
                  ['Ümumi tapşırıq', filteredTasks.length],
                  ['Tamamlanmış', completedTasks.length],
                  ['Aktiv', inProgressTasks.length + waitingTasks.length],
                  ['Gecikmiş', overdueTasks.length],
                  ['Müqavilə', filteredContracts.length],
                  ['Aktiv müqavilə', activeContracts.length],
                  ['Ümumi iddia məbləği', totalClaimValue],
                  ['Ümumi müqavilə dəyəri', totalContractValue],
                ]);
              }}><Download className="h-3.5 w-3.5" />CSV ixrac et</Button>
            </div>
          </TabsContent>

          {/* === STATUS ÜZRƏ === */}
          <TabsContent value="status" className="flex-1 overflow-y-auto mt-3">
            <div className="space-y-2">
              {statusBreakdown.length === 0 ? (
                <p className="text-center py-10 text-sm text-muted-foreground">Məlumat yoxdur</p>
              ) : statusBreakdown.map(function(row) {
                var pct = filteredTasks.length > 0 ? Math.round((row.count / filteredTasks.length) * 100) : 0;
                return (
                  <Card key={row.status} className="cursor-pointer hover:shadow-md" onClick={function() { openDrill(row.label, row.tasks); }}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Badge className={row.color + ' text-[10px]'}>{row.label}</Badge>
                          <span className="text-xs text-muted-foreground">{row.count} tapşırıq ({pct}%)</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-slate-700 rounded-full" style={{ width: pct + '%' }} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="flex justify-end mt-3">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={function() {
                handleExportAttempt('status-uzre.csv', [['Status', 'Say', 'Faiz']].concat(
                  statusBreakdown.map(function(r) { return [r.label, r.count, filteredTasks.length > 0 ? Math.round((r.count / filteredTasks.length) * 100) + '%' : '0%']; })
                ));
              }}><Download className="h-3.5 w-3.5" />CSV ixrac et</Button>
            </div>
          </TabsContent>

          {/* === VƏKİLLƏR ÜZRƏ === */}
          <TabsContent value="lawyers" className="flex-1 overflow-y-auto mt-3">
            <div className="space-y-2">
              {lawyerBreakdown.length === 0 ? (
                <p className="text-center py-10 text-sm text-muted-foreground">Vəkil yoxdur</p>
              ) : lawyerBreakdown.map(function(row) {
                return (
                  <Card key={row.lawyer.id} className="cursor-pointer hover:shadow-md" onClick={function() { openDrill(row.lawyer.name + ' — tapşırıqlar', row.tasks); }}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{row.lawyer.name}</p>
                          <p className="text-[11px] text-muted-foreground">{row.lawyer.specialization || 'İxtisas göstərilməyib'}</p>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          <div>
                            <p className="text-sm font-bold">{row.count}</p>
                            <p className="text-[10px] text-muted-foreground">tapşırıq</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-green-600">{row.completionRate}%</p>
                            <p className="text-[10px] text-muted-foreground">tamamlanma</p>
                          </div>
                          {row.overdueCount > 0 && (
                            <div>
                              <p className="text-sm font-bold text-red-600">{row.overdueCount}</p>
                              <p className="text-[10px] text-muted-foreground">gecikmiş</p>
                            </div>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="flex justify-end mt-3">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={function() {
                handleExportAttempt('vekiller-uzre.csv', [['Vəkil', 'İxtisas', 'Tapşırıq sayı', 'Tamamlanmış', 'Tamamlanma %', 'Gecikmiş', 'İddia məbləği']].concat(
                  lawyerBreakdown.map(function(r) { return [r.lawyer.name, r.lawyer.specialization || '', r.count, r.completedCount, r.completionRate + '%', r.overdueCount, r.claimSum]; })
                ));
              }}><Download className="h-3.5 w-3.5" />CSV ixrac et</Button>
            </div>
          </TabsContent>

          {/* === MÜŞTƏRİLƏR ÜZRƏ === */}
          <TabsContent value="clients" className="flex-1 overflow-y-auto mt-3">
            <div className="space-y-2">
              {clientBreakdown.length === 0 ? (
                <p className="text-center py-10 text-sm text-muted-foreground">Məlumat yoxdur</p>
              ) : clientBreakdown.map(function(row) {
                return (
                  <Card key={row.client.id} className="cursor-pointer hover:shadow-md" onClick={function() { openDrill(row.client.name + ' — tapşırıqlar', row.tasks); }}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{row.client.company_name || row.client.name}</p>
                            <p className="text-[11px] text-muted-foreground">{row.contracts.length} müqavilə</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          <div>
                            <p className="text-sm font-bold">{row.tasks.length}</p>
                            <p className="text-[10px] text-muted-foreground">tapşırıq</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold">{fmtMoney(row.contractValue)}</p>
                            <p className="text-[10px] text-muted-foreground">müqavilə dəyəri</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="flex justify-end mt-3">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={function() {
                handleExportAttempt('musteriler-uzre.csv', [['Müştəri', 'Müqavilə sayı', 'Tapşırıq sayı', 'Müqavilə dəyəri', 'İddia məbləği']].concat(
                  clientBreakdown.map(function(r) { return [r.client.company_name || r.client.name, r.contracts.length, r.tasks.length, r.contractValue, r.claimSum]; })
                ));
              }}><Download className="h-3.5 w-3.5" />CSV ixrac et</Button>
            </div>
          </TabsContent>

          {/* === MALİYYƏ === */}
          <TabsContent value="finance" className="flex-1 overflow-y-auto mt-3">
            <div className="space-y-2">
              {filteredContracts.length === 0 ? (
                <p className="text-center py-10 text-sm text-muted-foreground">Müqavilə yoxdur</p>
              ) : filteredContracts.map(function(c: any) {
                var quotaPct = c.task_quota > 0 ? Math.min(100, Math.round((c.tasks_used / c.task_quota) * 100)) : 0;
                return (
                  <Card key={c.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{contractLabel(c)}</p>
                          <p className="text-[11px] text-muted-foreground">{clientLabel(c.client_id)}</p>
                        </div>
                        <div className="flex items-center gap-3 text-right shrink-0">
                          <div>
                            <p className="text-sm font-bold">{fmtMoney(c.value)}</p>
                            <p className="text-[10px] text-muted-foreground">dəyər</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold">{fmtMoney(c.static_lawyer_fee)}</p>
                            <p className="text-[10px] text-muted-foreground">vəkil haqqı</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold">{fmtMoney(c.claim_amount)}</p>
                            <p className="text-[10px] text-muted-foreground">iddia</p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{c.payment_status || 'pending'}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                          <div className={'h-full rounded-full ' + (quotaPct >= 95 ? 'bg-red-500' : quotaPct >= 80 ? 'bg-yellow-500' : 'bg-green-500')} style={{ width: quotaPct + '%' }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{c.tasks_used || 0}/{c.task_quota || 0} tapşırıq kvotası</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {filteredContracts.length > 0 && (
                <Card className="bg-slate-50">
                  <CardContent className="p-3 flex items-center justify-between">
                    <p className="text-xs font-semibold">Cəmi</p>
                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <span>Dəyər: {fmtMoney(totalContractValue)}</span>
                      <span>İddia: {fmtMoney(filteredContracts.reduce(function(s: number, c: any) { return s + (parseFloat(c.claim_amount) || 0); }, 0))}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            <div className="flex justify-end mt-3">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={function() {
                handleExportAttempt('maliyye.csv', [['Müqavilə', 'Müştəri', 'Dəyər', 'Vəkil haqqı', 'İddia məbləği', 'Ödəniş statusu', 'Kvota (istifadə/limit)']].concat(
                  filteredContracts.map(function(c: any) { return [contractLabel(c), clientLabel(c.client_id), c.value, c.static_lawyer_fee, c.claim_amount, c.payment_status, (c.tasks_used || 0) + '/' + (c.task_quota || 0)]; })
                ));
              }}><Download className="h-3.5 w-3.5" />CSV ixrac et</Button>
            </div>
          </TabsContent>

          {/* === MÜDDƏTLƏR === */}
          <TabsContent value="deadlines" className="flex-1 overflow-y-auto mt-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <Card className="cursor-pointer hover:shadow-md border-red-200" onClick={function() { openDrill('Gecikmiş', deadlineBuckets.overdue); }}>
                <CardContent className="p-4">
                  <p className="text-2xl font-bold text-red-600">{deadlineBuckets.overdue.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Gecikmiş</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md border-amber-200" onClick={function() { openDrill('Bu həftə', deadlineBuckets.thisWeek); }}>
                <CardContent className="p-4">
                  <p className="text-2xl font-bold text-amber-600">{deadlineBuckets.thisWeek.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Bu həftə bitir</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md" onClick={function() { openDrill('Bu ay', deadlineBuckets.thisMonth); }}>
                <CardContent className="p-4">
                  <p className="text-2xl font-bold">{deadlineBuckets.thisMonth.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Bu ay bitir</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md" onClick={function() { openDrill('30 gündən sonra', deadlineBuckets.later); }}>
                <CardContent className="p-4">
                  <p className="text-2xl font-bold text-muted-foreground">{deadlineBuckets.later.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Sonra bitir</p>
                </CardContent>
              </Card>
            </div>
            <ScrollArea className="h-64">
              <div className="space-y-1.5 pr-2">
                {deadlineBuckets.overdue.concat(deadlineBuckets.thisWeek).sort(function(a: any, b: any) { return new Date(a.deadline).getTime() - new Date(b.deadline).getTime(); }).map(function(t: any) {
                  var overdue = daysUntil(t.deadline) < 0;
                  return (
                    <div key={t.id} className={'flex items-center justify-between px-3 py-2 rounded-lg border text-xs ' + (overdue ? 'border-red-200 bg-red-50/40' : 'border-amber-200 bg-amber-50/40')}>
                      <span className="truncate flex-1">{t.title}</span>
                      <span className={'font-medium ml-2 ' + (overdue ? 'text-red-600' : 'text-amber-600')}>{fmtDate(t.deadline)}</span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="flex justify-end mt-3">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={function() {
                var all = deadlineBuckets.overdue.concat(deadlineBuckets.thisWeek, deadlineBuckets.thisMonth, deadlineBuckets.later);
                handleExportAttempt('muddetler.csv', [['Tapşırıq', 'Son tarix', 'Status']].concat(
                  all.map(function(t: any) { return [t.title, fmtDate(t.deadline), getStatusLabel(t.status)]; })
                ));
              }}><Download className="h-3.5 w-3.5" />CSV ixrac et</Button>
            </div>
          </TabsContent>

          {/* === KATEQORİYA ÜZRƏ === */}
          <TabsContent value="category" className="flex-1 overflow-y-auto mt-3">
            <div className="space-y-2">
              {categoryBreakdown.length === 0 ? (
                <p className="text-center py-10 text-sm text-muted-foreground">Məlumat yoxdur</p>
              ) : categoryBreakdown.map(function(row) {
                var pct = filteredTasks.length > 0 ? Math.round((row.count / filteredTasks.length) * 100) : 0;
                return (
                  <Card key={row.key} className="cursor-pointer hover:shadow-md" onClick={function() { openDrill(row.label, row.tasks); }}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-medium">{row.label}</p>
                        <div className="flex items-center gap-3 text-right">
                          <span className="text-xs text-muted-foreground">{row.count} tapşırıq ({pct}%)</span>
                          <span className="text-xs font-medium">{fmtMoney(row.claimSum)}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-violet-600 rounded-full" style={{ width: pct + '%' }} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="flex justify-end mt-3">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={function() {
                handleExportAttempt('kateqoriya-uzre.csv', [['Kateqoriya', 'Say', 'İddia məbləği']].concat(
                  categoryBreakdown.map(function(r) { return [r.label, r.count, r.claimSum]; })
                ));
              }}><Download className="h-3.5 w-3.5" />CSV ixrac et</Button>
            </div>
          </TabsContent>
        </Tabs>
        </>
        )}
      </DialogContent>

      <TaskListModal
        open={drillOpen}
        onOpenChange={setDrillOpen}
        tasks={drillTasks}
        title={drillTitle}
        lawyers={lawyerList}
        onTaskClick={onTaskClick ? function(task: any) { setDrillOpen(false); onOpenChange(false); onTaskClick(task); } : undefined}
      />
    </Dialog>
  );
}
