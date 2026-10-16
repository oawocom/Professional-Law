import { fetchApi } from '../../utils/apiHelper';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import {
  UserCheck, Plus, Search, MoreHorizontal, Eye, Trash2, Phone, Mail, Award, Users,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { toast } from 'sonner';
import { LawyerReassignDeleteDialog } from './LawyerReassignDeleteDialog';

interface LawyerListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lawyers: any[];
  onNewLawyer: () => void;
  onRefresh?: () => void;
  onSelectLawyer?: (lawyer: any) => void;
}

// Raw API cavabı (snake_case: is_archived) və UI-formalı obyekt (camelCase:
// isArchived) hər ikisini dəstəkləmək üçün — bax: ClientDatabaseModal-dakı
// eyni problemin izahı.
function isLawyerArchived(l: any): boolean {
  return !!(l && (l.isArchived || l.is_archived));
}

export function LawyerListModal({ open, onOpenChange, lawyers, onNewLawyer, onRefresh, onSelectLawyer }: LawyerListModalProps) {
  var [searchTerm, setSearchTerm] = useState('');
  var [statusFilter, setStatusFilter] = useState('all');
  var [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  var [dirty, setDirty] = useState(false);
  var [reassignOpen, setReassignOpen] = useState(false);
  var [reassignLawyer, setReassignLawyer] = useState<any>(null);
  var [reassignTasks, setReassignTasks] = useState<any[]>([]);

  var visibleLawyers = lawyers.filter(function(l) { return !deletedIds.has(String(l.id)); });

  var filteredLawyers = visibleLawyers
    .filter(function(lawyer) {
      var term = searchTerm.toLowerCase();
      var matchesSearch = !term ||
        (lawyer.name || '').toLowerCase().includes(term) ||
        (lawyer.specialization || '').toLowerCase().includes(term) ||
        (lawyer.email || '').toLowerCase().includes(term) ||
        (lawyer.phone || '').includes(term);
      // aktiv = arxivlənməmiş, passiv = arxivlənmiş
      var matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !isLawyerArchived(lawyer)) ||
        (statusFilter === 'passive' && isLawyerArchived(lawyer));
      return matchesSearch && matchesStatus;
    })
    .sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });

  var statusCounts = {
    all: visibleLawyers.length,
    active: visibleLawyers.filter(function(l) { return !isLawyerArchived(l); }).length,
    passive: visibleLawyers.filter(function(l) { return isLawyerArchived(l); }).length,
  };

  var getStatusColor = function(status: string) {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  var getStatusLabel = function(status: string) {
    switch (status) {
      case 'active': return 'Aktiv';
      case 'inactive': return 'Deaktiv';
      default: return status || 'Aktiv';
    }
  };

  var handleViewDetails = function(lawyer: any) {
    if (onSelectLawyer) {
      onSelectLawyer(lawyer);
      onOpenChange(false);
    }
  };

  var handleDelete = async function(lawyer: any) {
    if (!confirm(lawyer.name + ' vəkilini silmək istədiyinizə əminsiniz?')) return;
    try {
      await fetchApi('/lawyers/' + lawyer.id, { method: 'DELETE' });
      setDeletedIds(function(prev) {
        var next = new Set(prev);
        next.add(String(lawyer.id));
        return next;
      });
      setDirty(true);
      toast.success(lawyer.name + ' vəkili silindi');
    } catch (err: any) {
      // 409 — vəkilin hələ tamamlanmamış tapşırıqları var, yenidən-təhkim tələb olunur
      try {
        var parsed = JSON.parse(err.message || '{}');
        if (parsed && parsed.pending_tasks) {
          setReassignLawyer(lawyer);
          setReassignTasks(parsed.pending_tasks);
          setReassignOpen(true);
          return;
        }
      } catch { /* JSON deyil */ }
      console.error('Delete lawyer error:', err);
      toast.error('Vəkil silinmədi');
    }
  };

  var handleReassignConfirm = async function(reassignments: Record<string, number>) {
    if (!reassignLawyer) return;
    try {
      await fetchApi('/lawyers/' + reassignLawyer.id, { method: 'DELETE', body: JSON.stringify({ reassignments: reassignments }) });
      setDeletedIds(function(prev) {
        var next = new Set(prev);
        next.add(String(reassignLawyer.id));
        return next;
      });
      setDirty(true);
      toast.success(reassignLawyer.name + ' vəkili silindi, tapşırıqlar yenidən təhkim edildi');
      setReassignOpen(false);
      setReassignLawyer(null);
      setReassignTasks([]);
    } catch (err) {
      console.error('Reassign+delete lawyer error:', err);
      toast.error('Əməliyyat uğursuz oldu');
    }
  };

  var handleClose = function(isOpen: boolean) {
    if (!isOpen && dirty) {
      setDeletedIds(new Set());
      setDirty(false);
      if (onRefresh) onRefresh();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] h-[90vh] overflow-hidden flex flex-col" data-modal="lawyer-list">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Vəkil komandası
          </DialogTitle>
          <DialogDescription>Vəkil komandası üzvlərini idarə edin</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Axtar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 h-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Hamısı ({statusCounts.all})</SelectItem>
                  <SelectItem value="active">Aktiv ({statusCounts.active})</SelectItem>
                  <SelectItem value="passive">Passiv ({statusCounts.passive})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="shrink-0" onClick={function() { onNewLawyer(); }} type="button">
              <Plus className="h-4 w-4 mr-2" />Yeni vəkil
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            {filteredLawyers.length} / {visibleLawyers.length} vəkil
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2 pr-4">
              {filteredLawyers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  {searchTerm || statusFilter !== 'all' ? (
                    <p>Axtarışa uyğun vəkil tapılmadı</p>
                  ) : (
                    <div>
                      <p>Hələ heç bir vəkil yoxdur</p>
                      <Button className="mt-4" onClick={function() { onNewLawyer(); }} type="button">
                        <Plus className="h-4 w-4 mr-2" />İlk vəkili əlavə et
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                filteredLawyers.map(function(lawyer) {
                  var initials = (lawyer.name || '?').split(' ').map(function(n: string) { return n[0]; }).join('').slice(0, 2).toUpperCase();

                  return (
                    <Card key={lawyer.id} className="hover:shadow-sm transition-all">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start sm:items-center justify-between gap-2">
                          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                            <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 mt-0.5 sm:mt-0">
                              <AvatarFallback className="text-xs sm:text-sm">{initials}</AvatarFallback>
                            </Avatar>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-medium text-sm">{lawyer.name}</h3>
                                {isLawyerArchived(lawyer) && (
                                  <Badge className="bg-gray-200 text-gray-600 text-[11px]">Passiv</Badge>
                                )}
                                <Badge className={getStatusColor(lawyer.status) + ' text-[11px]'}>
                                  {getStatusLabel(lawyer.status)}
                                </Badge>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1 text-xs text-muted-foreground">
                                {lawyer.specialization && (
                                  <div className="flex items-center gap-1">
                                    <Award className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{lawyer.specialization}</span>
                                  </div>
                                )}
                                {lawyer.email && (
                                  <div className="flex items-center gap-1 truncate">
                                    <Mail className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{lawyer.email}</span>
                                  </div>
                                )}
                                {lawyer.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3 shrink-0" />
                                    <span>{lawyer.phone}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" type="button">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={function() { handleViewDetails(lawyer); }}>
                                  <Eye className="h-4 w-4 mr-2" />Ətraflı bax
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={function() { handleDelete(lawyer); }}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />Sil
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
      </DialogContent>

      <LawyerReassignDeleteDialog
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        lawyer={reassignLawyer}
        pendingTasks={reassignTasks}
        otherLawyers={visibleLawyers.filter(function(l) { return !reassignLawyer || String(l.id) !== String(reassignLawyer.id); })}
        onConfirm={handleReassignConfirm}
      />
    </Dialog>
  );
}