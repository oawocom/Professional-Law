import { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  Send,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchApi } from '../../utils/apiHelper';

// BUG DÜZƏLİŞİ (2026-09): `sendMessage` əvvəllər göndərənin adını sabit
// "Menecer" mətni ilə göndərirdi (kim yazırsa yazsın, eyni ad görünürdü).
// İndi ManagerDashboard.tsx-dəki eyni nümunə ilə real giriş edən menecerin
// adı `localStorage`-dan oxunur (yoxdursa, əvvəlki kimi "Menecer"-ə düşür).
function getManagerName(): string {
  if (typeof window === 'undefined') return 'Menecer';
  try {
    var u = JSON.parse(localStorage.getItem('law_user') || 'null');
    return u && u.name ? u.name : 'Menecer';
  } catch { return 'Menecer'; }
}

// QEYD: bu modal əvvəllər tamamilə saxta (hardcode) mesaj massivi göstərirdi
// və "Göndər" düyməsi heç bir backend çağırışı etmirdi (Math.random() ilə
// qondarma cavab simulyasiya edirdi). İndi mövcud real mesajlaşma sisteminə
// (Message modeli, /messages endpoint-i, artıq TaskChatModal-da işlək) qoşulub —
// müştərinin müqaviləsi kanalı ("contract_id") üzərindən real mesajlar oxuyur/yazır.

interface GroupChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: {
    id: string | number;
    name: string;
    company?: string;
  } | null;
  contracts?: any[];
  taskTitle?: string;
}

function fmtTime(d: any): string {
  if (!d) return '';
  try {
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleString('az-AZ');
  } catch { return ''; }
}

function initials(name: string): string {
  return (name || '').split(' ').filter(Boolean).map(function(n) { return n[0]; }).join('').slice(0, 2).toUpperCase() || '?';
}

function roleColor(role: string): string {
  switch (role) {
    case 'client': return 'bg-blue-100 text-blue-800';
    case 'lawyer': return 'bg-green-100 text-green-800';
    case 'manager': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function roleText(role: string): string {
  switch (role) {
    case 'client': return 'Müştəri';
    case 'lawyer': return 'Vəkil';
    case 'manager': return 'Menecer';
    default: return 'İstifadəçi';
  }
}

export function GroupChatModal({ open, onOpenChange, client, contracts = [], taskTitle }: GroupChatModalProps) {
  var [messages, setMessages] = useState<any[]>([]);
  var [newMessage, setNewMessage] = useState('');
  var [loading, setLoading] = useState(false);
  var [sending, setSending] = useState(false);
  var messagesEndRef = useRef<HTMLDivElement>(null);

  // Bu müştərinin qrup söhbəti üçün "kanal" onun (aktiv, yoxdursa istənilən)
  // müqaviləsidir — Message modelində contract_id artıq mövcud, real bir sahədir.
  var contractId = useMemo(function() {
    if (!client) return null;
    var clientContracts = (contracts || []).filter(function(c: any) {
      var cid = c.clientId !== undefined && c.clientId !== null ? c.clientId : c.client_id;
      return String(cid) === String(client.id);
    });
    if (clientContracts.length === 0) return null;
    var active = clientContracts.find(function(c: any) { return c.status === 'active'; });
    return (active || clientContracts[0]).id;
  }, [client, contracts]);

  var loadMessages = function() {
    if (!contractId) { setMessages([]); return; }
    setLoading(true);
    fetchApi('/messages?contract_id=' + contractId)
      .then(function(data: any) { setMessages(Array.isArray(data) ? data : []); })
      .catch(function() { setMessages([]); })
      .finally(function() { setLoading(false); });
  };

  useEffect(function() {
    if (!open) return;
    loadMessages();
    var interval = setInterval(loadMessages, 8000);
    return function() { clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contractId]);

  useEffect(function() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  var sendMessage = async function() {
    var content = newMessage.trim();
    if (!content || !contractId || sending) return;
    setSending(true);
    setNewMessage('');
    try {
      await fetchApi('/messages', {
        method: 'POST',
        body: JSON.stringify({
          contract_id: contractId,
          channel: 'all',
          sender_id: 0,
          sender_type: 'manager',
          sender_name: getManagerName(),
          content: content,
        }),
      });
      loadMessages();
    } catch (err) {
      toast.error('Mesaj göndərilmədi');
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  var handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // İştirakçı sayını real mesajlardan (unikal göndərənlər) çıxarırıq —
  // əvvəllər "3 iştirakçı" hər zaman sabit yazı idi.
  var participants = useMemo(function() {
    var seen: Record<string, { name: string; role: string }> = {};
    messages.forEach(function(m: any) {
      var key = (m.sender_type || 'user') + ':' + (m.sender_name || m.sender_id);
      if (!seen[key]) seen[key] = { name: m.sender_name || roleText(m.sender_type), role: m.sender_type || '' };
    });
    return Object.values(seen);
  }, [messages]);

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl h-[80vh] flex flex-col overflow-hidden"
        data-modal="group-chat"
      >
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{initials(client.name)}</AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-lg">{client.name} - Qrup Chat</DialogTitle>
                <div className="flex items-center gap-2">
                  {client.company && <span className="text-sm text-muted-foreground">{client.company}</span>}
                  {taskTitle && <Badge variant="outline" className="text-xs">{taskTitle}</Badge>}
                </div>
              </div>
            </div>

            {participants.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {participants.length} iştirakçı
              </Badge>
            )}
          </div>
          <DialogDescription className="sr-only">
            {client.name} müştərisi ilə menecer və vəkil arasında qrup chat
          </DialogDescription>
        </DialogHeader>

        {!contractId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
            <MessageSquare className="h-10 w-10 opacity-40" />
            <p className="text-sm">Bu müştərinin hələ müqaviləsi yoxdur.</p>
            <p className="text-xs">Qrup söhbət açmaq üçün əvvəlcə müqavilə yaradılmalıdır.</p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {loading && messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Yüklənir...</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Hələ mesaj yoxdur. İlk mesajı siz yazın.</p>
                ) : (
                  messages.map((message: any) => {
                    var isManager = message.sender_type === 'manager';
                    return (
                      <div key={message.id} className={'flex gap-3 ' + (isManager ? 'justify-end' : 'justify-start')}>
                        {!isManager && (
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarFallback className="text-xs">{initials(message.sender_name)}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className={'max-w-[70%] ' + (isManager ? 'order-first' : '')}>
                          <div className={'flex items-center gap-2 mb-1 ' + (isManager ? 'justify-end' : 'justify-start')}>
                            <span className="text-xs font-medium">{message.sender_name || 'İstifadəçi'}</span>
                            <Badge variant="secondary" className={'text-xs ' + roleColor(message.sender_type)}>
                              {roleText(message.sender_type)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{fmtTime(message.created_at)}</span>
                          </div>
                          <div
                            className={
                              'p-3 rounded-lg ' +
                              (isManager
                                ? 'bg-primary text-primary-foreground ml-auto'
                                : message.sender_type === 'client'
                                ? 'bg-blue-50 border border-blue-200'
                                : 'bg-green-50 border border-green-200')
                            }
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </div>
                        </div>
                        {isManager && (
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarFallback className="text-xs bg-purple-100">M</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t pt-4">
              <div className="flex items-center gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Qrupa mesaj yazın..."
                  className="flex-1"
                  disabled={sending}
                />
                <Button onClick={sendMessage} disabled={!newMessage.trim() || sending}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>Bu qrup chat menecer, vəkil və müştəri arasında paylaşılır</span>
                <span>Enter - göndər, Shift+Enter - yeni sətir</span>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
