import { fetchApi, getApiBase, getLawToken } from '../../utils/apiHelper';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import {
  Users, Plus, Search, Mail, Phone, Building2, Eye, MoreHorizontal, Pencil, UserX, UserCheck, AlertTriangle, Loader2, Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { NewClientModal } from './NewClientModal';
import { ClientDetailModal } from './ClientDetailModal';
import { toast } from 'sonner';

interface ClientDatabaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: any[];
  onRefresh?: () => void;
}

function normalizeClientType(t: string): string {
  if (t === 'company' || t === 'legal') return 'legal';
  return 'individual';
}

// Backend/hook-lar bəzən raw API cavabını (snake_case: is_archived) birbaşa
// ötürür, bəzən mapClient() ilə UI formasına (camelCase: isArchived) çevrilmiş
// obyekt gəlir — hər iki halı dəstəkləmək üçün hər iki sahəyə baxılır.
function isClientArchived(c: any): boolean {
  return !!(c && (c.isArchived || c.is_archived));
}

export function ClientDatabaseModal({ open, onOpenChange, clients, onRefresh }: ClientDatabaseModalProps) {
  var [searchTerm, setSearchTerm] = useState('');
  var [statusFilter, setStatusFilter] = useState('all');
  var [typeFilter, setTypeFilter] = useState('all');
  var [newClientOpen, setNewClientOpen] = useState(false);
  var [clientDetailOpen, setClientDetailOpen] = useState(false);
  var [selectedClient, setSelectedClient] = useState<any>(null);
  var [editClientOpen, setEditClientOpen] = useState(false);
  var [editingClient, setEditingClient] = useState<any>(null);
  var [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  var [dirty, setDirty] = useState(false);
  var [deactivateTarget, setDeactivateTarget] = useState<any>(null);
  var [deactivating, setDeactivating] = useState(false);
  var [deleteTarget, setDeleteTarget] = useState<any>(null);
  var [deleteConfirmText, setDeleteConfirmText] = useState('');
  var [deleting, setDeleting] = useState(false);

  var visibleClients = clients.filter(function(c) { return !deletedIds.has(String(c.id)); });

  var filteredClients = visibleClients.filter(function(client) {
    var archived = isClientArchived(client);
    var matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && !archived) ||
      (statusFilter === 'passive' && archived);
    if (!matchesStatus) return false;
    var matchesType = typeFilter === 'all' || normalizeClientType(client.type) === typeFilter;
    if (!matchesType) return false;
    if (!searchTerm) return true;
    var term = searchTerm.toLowerCase();
    return (
      (client.name || '').toLowerCase().includes(term) ||
      (client.email || '').toLowerCase().includes(term) ||
      (client.phone || '').toLowerCase().includes(term) ||
      (client.company || '').toLowerCase().includes(term) ||
      (client.companyName || '').toLowerCase().includes(term) ||
      (client.company_name || '').toLowerCase().includes(term)
    );
  });

  var linkedChildrenCount = function(client: any) {
    return visibleClients.filter(function(c) { return String(c.parentClientId || c.parent_client_id || '') === String(client.id); }).length;
  };

  var clientStatusCounts = {
    all: visibleClients.length,
    active: visibleClients.filter(function(c) { return !isClientArchived(c); }).length,
    passive: visibleClients.filter(function(c) { return isClientArchived(c); }).length,
  };

  var getStatusLabel = function(status: string) {
    switch (status) {
      case 'active': return 'Aktiv';
      case 'inactive': return 'Deaktiv';
      case 'archived': return 'Arxiv';
      default: return status;
    }
  };

  var getStatusColor = function(status: string) {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'archived': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  var handleViewDetails = function(client: any) {
    setSelectedClient(client);
    setClientDetailOpen(true);
  };

  var handleEditClient = function(client: any) {
    setEditingClient(client);
    setEditClientOpen(true);
  };

  // "Sil" düyməsi "Deaktiv et"-lə əvəz olunub — məlumat itirilmir, müştəri arxivə köçürülür.
  // Hüquqi şəxsdirsə, bağlı Fərdi hesablar da; hər iki halda müqavilə/tapşırıqlar da
  // avtomatik deaktiv olunur (backend kaskadı: ArchiveClient).
  var handleToggleArchive = async function(client: any) {
    if (!isClientArchived(client)) {
      setDeactivateTarget(client);
      return;
    }
    // Bərpa — xəbərdarlıq lazım deyil
    try {
      await fetchApi('/clients/' + client.id + '/archive', { method: 'PUT', body: JSON.stringify({ is_archived: false }) });
      setDirty(true);
      toast.success(client.name + ' bərpa edildi');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Restore client error:', err);
      toast.error('Müştəri bərpa edilmədi');
    }
  };

  var confirmDeactivate = async function() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await fetchApi('/clients/' + deactivateTarget.id + '/archive', { method: 'PUT', body: JSON.stringify({ is_archived: true }) });
      setDirty(true);
      toast.success(deactivateTarget.name + ' deaktiv edildi');
      setDeactivateTarget(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Archive client error:', err);
      toast.error('Müştəri deaktiv edilmədi');
    } finally {
      setDeactivating(false);
    }
  };

  // Həmişəlik silmə — backend (DeleteClient) müştəriyə aid bütün müqavilə/tapşırıqları
  // da silir. Bu geri qaytarıla bilməyən əməliyyatdır, ona görə ayrıca, güclü
  // xəbərdarlıqlı təsdiq tələb olunur ("Deaktiv et"dən fərqli olaraq).
  var confirmDelete = async function() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetchApi('/clients/' + deleteTarget.id, { method: 'DELETE' });
      setDeletedIds(function(prev) { var next = new Set(prev); next.add(String(deleteTarget.id)); return next; });
      setDirty(true);
      toast.success(deleteTarget.name + ' həmişəlik silindi');
      setDeleteTarget(null);
      setDeleteConfirmText('');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Delete client error:', err);
      toast.error('Müştəri silinmədi');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={function(isOpen) {
        if (!isOpen && dirty) {
          setDeletedIds(new Set());
          setDirty(false);
          if (onRefresh) onRefresh();
        }
        onOpenChange(isOpen);
      }}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] h-[90vh] overflow-hidden flex flex-col" data-modal="client-database">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Müştəri bazası
            </DialogTitle>
            <DialogDescription>Bütün müştəriləri idarə edin</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Axtar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 h-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Hamısı ({clientStatusCounts.all})</SelectItem>
                  <SelectItem value="active">Aktiv ({clientStatusCounts.active})</SelectItem>
                  <SelectItem value="passive">Passiv ({clientStatusCounts.passive})</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Bütün tiplər</SelectItem>
                  <SelectItem value="individual">Fiziki şəxs</SelectItem>
                  <SelectItem value="legal">Hüquqi şəxs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="shrink-0" onClick={function() { setNewClientOpen(true); }} type="button">
              <Plus className="h-4 w-4 mr-2" />Yeni müştəri
            </Button>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2 pr-4">
              {filteredClients.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  {searchTerm ? (
                    <p>"{searchTerm}" üçün nəticə tapılmadı</p>
                  ) : (
                    <div>
                      <p>Hələ heç bir müştəri yoxdur</p>
                      <Button className="mt-4" onClick={function() { setNewClientOpen(true); }} type="button">
                        <Plus className="h-4 w-4 mr-2" />İlk müştərini yarat
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                filteredClients.map(function(client) {
                  var initials = (client.name || '?').split(' ').map(function(n: string) { return n[0]; }).join('').slice(0, 2).toUpperCase();
                  var companyName = client.companyName || client.company || client.company_name || '';
                  var isLegal = normalizeClientType(client.type) === 'legal';
                  var childCount = isLegal ? linkedChildrenCount(client) : 0;
                  var archived = isClientArchived(client);

                  return (
                    <Card key={client.id} className="hover:shadow-sm transition-all">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start sm:items-center justify-between gap-2">
                          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                            <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 mt-0.5 sm:mt-0">
                              <AvatarFallback className="text-xs sm:text-sm">{initials}</AvatarFallback>
                            </Avatar>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-medium text-sm">{client.name}</h3>
                                <Badge variant="outline" className="text-[10px]">{isLegal ? 'Hüquqi şəxs' : 'Fiziki şəxs'}</Badge>
                                {childCount > 0 && (
                                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">{childCount} bağlı hesab</Badge>
                                )}
                                {archived && (
                                  <Badge className="bg-gray-200 text-gray-600 text-[11px]">Passiv</Badge>
                                )}
                                <Badge className={getStatusColor(client.status) + ' text-[11px]'}>
                                  {getStatusLabel(client.status)}
                                </Badge>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1 text-xs text-muted-foreground">
                                {client.email && (
                                  <div className="flex items-center gap-1 truncate">
                                    <Mail className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{client.email}</span>
                                  </div>
                                )}
                                {client.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3 shrink-0" />
                                    <span>{client.phone}</span>
                                  </div>
                                )}
                                {companyName && (
                                  <div className="flex items-center gap-1 truncate">
                                    <Building2 className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{companyName}</span>
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
                                <DropdownMenuItem onClick={function() { handleViewDetails(client); }}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ətraflı bax
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={function() { handleEditClient(client); }}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Redaktə et
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={function() { handleToggleArchive(client); }}
                                  className={archived ? '' : 'text-red-600 focus:text-red-600'}
                                >
                                  {archived ? <UserCheck className="h-4 w-4 mr-2" /> : <UserX className="h-4 w-4 mr-2" />}
                                  {archived ? 'Aktivləşdir' : 'Deaktiv et'}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={function() { setDeleteTarget(client); setDeleteConfirmText(''); }}
                                  className="text-red-700 focus:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Həmişəlik sil
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
        </DialogContent>
      </Dialog>

      <NewClientModal
        open={newClientOpen}
        onOpenChange={function(isOpen) { setNewClientOpen(isOpen); }}
        onClientCreated={function() { setDirty(true); }}
      />

      <NewClientModal
        open={editClientOpen}
        editClient={editingClient}
        onOpenChange={function(isOpen) { setEditClientOpen(isOpen); if (!isOpen) setEditingClient(null); }}
        onClientUpdated={function() { setDirty(true); setEditClientOpen(false); setEditingClient(null); }}
      />

      <ClientDetailModal
        open={clientDetailOpen}
        onOpenChange={setClientDetailOpen}
        client={selectedClient}
        onEditClient={function(c: any) { setClientDetailOpen(false); handleEditClient(c); }}
        onRefresh={function() { setDirty(true); if (onRefresh) onRefresh(); }}
      />

      {/* Deaktiv etmə xəbərdarlığı — kaskad təsirini əvvəlcədən göstərir */}
      <Dialog open={!!deactivateTarget} onOpenChange={function(o) { if (!o) setDeactivateTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700"><AlertTriangle className="h-5 w-5" />Müştərini deaktiv et</DialogTitle>
            <DialogDescription className="space-y-2 pt-1">
              <span className="block"><strong>{deactivateTarget?.name}</strong> arxivə köçürüləcək.</span>
              <span className="block">Bununla birgə avtomatik deaktiv olunacaq:</span>
              <span className="block">• Bu müştəriyə aid BÜTÜN müqavilələr</span>
              <span className="block">• Bu müqavilələrə aid BÜTÜN tapşırıqlar</span>
              {normalizeClientType(deactivateTarget?.type) === 'legal' && linkedChildrenCount(deactivateTarget || {}) > 0 && (
                <span className="block">• Bu Hüquqi şəxsə bağlı {linkedChildrenCount(deactivateTarget || {})} Fərdi hesab (və onların müqavilə/tapşırıqları)</span>
              )}
              <span className="block text-xs pt-1">İstənilən vaxt arxivdən bərpa edə bilərsiniz.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={function() { setDeactivateTarget(null); }} disabled={deactivating}>Ləğv et</Button>
            <Button variant="destructive" onClick={confirmDeactivate} disabled={deactivating}>
              {deactivating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deaktiv et
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Həmişəlik silmə xəbərdarlığı — geri qaytarıla bilməz, kaskad təsirini göstərir */}
      <Dialog open={!!deleteTarget} onOpenChange={function(o) { if (!o) { setDeleteTarget(null); setDeleteConfirmText(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700"><AlertTriangle className="h-5 w-5" />Müştərini həmişəlik sil</DialogTitle>
            <DialogDescription className="space-y-2 pt-1">
              <span className="block"><strong>{deleteTarget?.name}</strong> verilənlər bazasından HƏMİŞƏLİK silinəcək. Bu əməliyyat GERİ QAYTARILA BİLMƏZ.</span>
              <span className="block">Bununla birgə həmişəlik silinəcək:</span>
              <span className="block">• Bu müştəriyə aid BÜTÜN müqavilələr</span>
              <span className="block">• Bu müqavilələrə aid BÜTÜN tapşırıqlar</span>
              {normalizeClientType(deleteTarget?.type) === 'legal' && linkedChildrenCount(deleteTarget || {}) > 0 && (
                <span className="block">• Bu Hüquqi şəxsə bağlı {linkedChildrenCount(deleteTarget || {})} Fərdi hesab (və onların müqavilə/tapşırıqları)</span>
              )}
              <span className="block text-xs pt-1">Əgər sadəcə müştərini siyahıdan gizlətmək istəyirsinizsə, "Deaktiv et" seçimindən istifadə edin — o, bərpa oluna bilər.</span>
              <span className="block pt-2">Təsdiq üçün aşağıya <strong>SIL</strong> yazın:</span>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={function(e) { setDeleteConfirmText(e.target.value); }}
            placeholder="SIL"
            className="mt-1"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={function() { setDeleteTarget(null); setDeleteConfirmText(''); }} disabled={deleting}>Ləğv et</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting || deleteConfirmText.trim().toUpperCase() !== 'SIL'}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Həmişəlik sil
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
export default ClientDatabaseModal;