'use client';
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  Search, Users, Mail, Phone, Building2, ChevronRight,
} from 'lucide-react';
import { isTerminalStatus } from '../../utils/taskStatusConstants';

interface ClientsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: any[];
  tasks?: any[];
  onClientClick: (client: any) => void;
}

// Normalize raw API client (snake_case) into a display-friendly shape.
function n(c: any) {
  return {
    id: c.id,
    name: c.name || '',
    companyName: c.company_name || c.companyName || '',
    email: c.email || '',
    phone: c.phone || '',
    address: c.address || '',
    status: c.status || 'active',
    notes: c.notes || '',
    joinDate: c.created_at || c.createdAt || '',
    isArchived: !!(c.is_archived || c.isArchived),
    _raw: c,
  };
}

export function ClientsModal({ open, onOpenChange, clients: rawClients, tasks, onClientClick }: ClientsModalProps) {
  var clients = useMemo(function() { return (rawClients || []).map(n); }, [rawClients]);
  var [searchTerm, setSearchTerm] = useState('');

  var taskCountByClient = useMemo(function() {
    var map: Record<string, { active: number; total: number }> = {};
    (tasks || []).forEach(function(t: any) {
      var cid = t.clientId !== undefined && t.clientId !== null ? t.clientId : t.client_id;
      if (cid === undefined || cid === null) return;
      var key = String(cid);
      if (!map[key]) map[key] = { active: 0, total: 0 };
      map[key].total++;
      if (!isTerminalStatus(t.status || '')) {
        map[key].active++;
      }
    });
    return map;
  }, [tasks]);

  var filteredClients = clients.filter(function(c) {
    if (!searchTerm) return true;
    var term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.companyName.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      c.phone.toLowerCase().includes(term)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col" data-modal="lawyer-clients">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />Müştərilərim
            <span className="text-sm text-muted-foreground font-normal ml-1">({filteredClients.length} müştəri)</span>
          </DialogTitle>
          <DialogDescription>Üzərində işlədiyiniz tapşırıqlara aid müştərilər</DialogDescription>
        </DialogHeader>

        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Müştəri axtar (ad, şirkət, email, telefon)..."
            value={searchTerm}
            onChange={function(e) { setSearchTerm(e.target.value); }}
            className="pl-9"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {filteredClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mb-3 opacity-30" />
              {clients.length === 0 ? (
                <>
                  <p className="text-sm font-medium">Hələ heç bir müştəriniz yoxdur</p>
                  <p className="text-xs mt-1">Sizə tapşırıq təhkim edildikdə müştəri burada görünəcək</p>
                </>
              ) : (
                <p className="text-sm">"{searchTerm}" üçün nəticə tapılmadı</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-1">
              {filteredClients.map(function(client) {
                var initials = (client.companyName || client.name || '?').split(' ').map(function(w: string) { return w[0]; }).join('').slice(0, 2).toUpperCase();
                var counts = taskCountByClient[String(client.id)] || { active: 0, total: 0 };
                return (
                  <div
                    key={client.id}
                    className="border rounded-xl p-4 hover:shadow-md hover:border-amber-300 transition-all cursor-pointer bg-white"
                    onClick={function() { onClientClick(client._raw); onOpenChange(false); }}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="bg-amber-100 text-amber-800 text-sm">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm truncate">{client.name}</h4>
                          {client.isArchived && <Badge className="bg-gray-200 text-gray-600 text-[10px]">Passiv</Badge>}
                        </div>
                        {client.companyName && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Building2 className="h-3 w-3 shrink-0" /><span className="truncate">{client.companyName}</span>
                          </div>
                        )}
                        <div className="flex flex-col gap-0.5 mt-1.5 text-[11px] text-muted-foreground">
                          {client.email && <div className="flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" />{client.email}</div>}
                          {client.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{client.phone}</div>}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                    <div className="flex items-center gap-3 mt-3 pt-2 border-t text-xs">
                      <span className="font-medium text-amber-700">{counts.active}</span>
                      <span className="text-muted-foreground -ml-2">aktiv tapşırıq</span>
                      <span className="font-medium ml-auto">{counts.total}</span>
                      <span className="text-muted-foreground -ml-2">cəmi</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
