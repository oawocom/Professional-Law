'use client';
import { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../../utils/apiHelper';
import { formatDate } from '../../utils/dateFormat';
import { TaskChatModal } from './TaskChatModal';
import { MessageSquare, X, ChevronRight, Circle } from 'lucide-react';

interface Props {
  userRole: 'manager' | 'lawyer' | 'client';
  userId: number;
  userName: string;
  tasks?: any[];
}

function timeAgo(d: any): string {
  if (!d) return '';
  try {
    var dt = new Date(d);
    var diff = Date.now() - dt.getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'indi';
    if (mins < 60) return mins + 'd əvvəl';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 's əvvəl';
    return formatDate(dt, '');
  } catch { return ''; }
}

function getInitials(name: string): string {
  if (!name) return '?';
  var parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function ChatFab({ userRole, userId, userName, tasks = [] }: Props) {
  var [open, setOpen] = useState(false);
  var [chatItems, setChatItems] = useState<any[]>([]);
  var [loading, setLoading] = useState(false);
  var [selectedTask, setSelectedTask] = useState<any>(null);
  var [chatOpen, setChatOpen] = useState(false);
  var [tick, setTick] = useState(0);

  var totalUnread = chatItems.reduce(function(sum, item) { return sum + (item.unread || 0); }, 0);

  // Fetch latest messages for all tasks to build chat list
  var fetchChatList = useCallback(function() {
    if (!tasks || tasks.length === 0) { setChatItems([]); return; }
    setLoading(true);

    // Get messages for all tasks at once
    fetchApi('/messages?user_role=' + userRole + '&user_id=' + userId + '&limit=200')
      .then(function(data: any) {
        var msgs: any[] = Array.isArray(data) ? data : [];

        // Group by task_id
        var byTask: Record<string, any[]> = {};
        msgs.forEach(function(m: any) {
          var tid = String(m.task_id || m.taskId || '');
          if (!tid) return;
          if (!byTask[tid]) byTask[tid] = [];
          byTask[tid].push(m);
        });

        // Build chat items
        var items = tasks
          .filter(function(t: any) { return !t.is_archived && !t.isArchived; })
          .map(function(t: any) {
            var tid = String(t.id);
            var taskMsgs = byTask[tid] || [];

            // Sort by date desc
            taskMsgs.sort(function(a: any, b: any) {
              return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
            });

            var lastMsg = taskMsgs[0] || null;

            // Count unread: messages not sent by me and not read
            var unread = taskMsgs.filter(function(m: any) {
              var senderType = m.sender_type || m.senderType || '';
              var senderId = m.sender_id || m.senderId || 0;
              var isFromMe = senderType === userRole && Number(senderId) === Number(userId);
              return !isFromMe && !m.is_read && !m.isRead;
            }).length;

            var clientName = (t.client && t.client.name) || t.client_name || '';
            var lawyerName = (t.assignee && t.assignee.name) || t.assigned_lawyer || '';
            var taskTitle = t.respondent_name || t.title || ('Tapşırıq #' + (t.task_number || t.id));
            var contractTitle = (t.contract && t.contract.title) || t.contract_title || '';

            var subtitle = '';
            if (userRole === 'manager') subtitle = [clientName, lawyerName].filter(Boolean).join(' · ');
            else if (userRole === 'lawyer') subtitle = clientName;
            else subtitle = lawyerName || 'Menecer';

            var lastText = '';
            if (lastMsg) {
              var content = lastMsg.content || lastMsg.message || '';
              // Strip reply prefix
              content = content.replace(/^\[reply:\d+\]\s*/, '');
              if (content.startsWith('📷') || content.startsWith('📎') || content.startsWith('🎤')) {
                lastText = content;
              } else {
                lastText = content.slice(0, 50) + (content.length > 50 ? '…' : '');
              }
            }

            return {
              task: t,
              taskTitle,
              contractTitle,
              subtitle,
              lastMsg,
              lastText,
              lastTime: lastMsg ? (lastMsg.created_at || lastMsg.createdAt) : null,
              unread,
            };
          })
          .filter(function(item) { return item.lastMsg || item.unread > 0; })
          .sort(function(a, b) {
            // Unread first, then by last message time
            if (b.unread !== a.unread) return b.unread - a.unread;
            var ta = a.lastTime ? new Date(a.lastTime).getTime() : 0;
            var tb = b.lastTime ? new Date(b.lastTime).getTime() : 0;
            return tb - ta;
          });

        setChatItems(items);
      })
      .catch(function() { setChatItems([]); })
      .finally(function() { setLoading(false); });
  }, [tasks, userRole, userId]);

  // Fetch on mount and every 15s
  useEffect(function() {
    fetchChatList();
    var interval = setInterval(function() { setTick(function(n) { return n + 1; }); }, 15000);
    return function() { clearInterval(interval); };
  }, [fetchChatList]);

  useEffect(function() { fetchChatList(); }, [tick]);

  // Refresh after chat closes
  var handleChatClose = function() {
    setChatOpen(false);
    setTimeout(fetchChatList, 500);
  };

  var handleOpenChat = function(item: any) {
    setSelectedTask(item.task);
    setOpen(false);
    setChatOpen(true);
  };

  return (
    <>
      {/* ── Chat panel overlay ── */}
      {open && (
        <div className="fixed inset-0 z-[90]" onClick={function() { setOpen(false); }} />
      )}

      {/* ── Floating panel ── */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-[95] w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
          style={{ maxHeight: '70vh' }}
          onClick={function(e) { e.stopPropagation(); }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-900 shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-white" />
              <span className="text-sm font-semibold text-white">Mesajlar</span>
              {totalUnread > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {totalUnread}
                </span>
              )}
            </div>
            <button className="text-white/70 hover:text-white" onClick={function() { setOpen(false); }}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Chat list */}
          <div className="overflow-y-auto flex-1">
            {loading && chatItems.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-slate-800 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : chatItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <MessageSquare className="h-10 w-10 opacity-20 mb-2" />
                <p className="text-sm">Heç bir mesaj yoxdur</p>
              </div>
            ) : chatItems.map(function(item, idx) {
              var hasUnread = item.unread > 0;
              var initials = item.subtitle ? getInitials(item.subtitle) : '??';
              var colors = [
                'bg-blue-100 text-blue-700',
                'bg-emerald-100 text-emerald-700',
                'bg-violet-100 text-violet-700',
                'bg-amber-100 text-amber-700',
                'bg-rose-100 text-rose-700',
              ];
              var avatarColor = colors[idx % colors.length];

              return (
                <button
                  key={String(item.task.id)}
                  className={'w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 text-left ' + (hasUnread ? 'bg-blue-50/50' : '')}
                  onClick={function() { handleOpenChat(item); }}
                >
                  {/* Avatar */}
                  <div className={'w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ' + avatarColor}>
                    {initials}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className={'text-sm truncate ' + (hasUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700')}>
                        {item.taskTitle}
                      </p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0 mt-0.5">
                        {timeAgo(item.lastTime)}
                      </span>
                    </div>
                    {item.subtitle && (
                      <p className="text-[10px] text-slate-400 truncate">{item.subtitle}</p>
                    )}
                    {item.lastText && (
                      <p className={'text-xs truncate mt-0.5 ' + (hasUnread ? 'text-slate-700' : 'text-slate-400')}>
                        {item.lastText}
                      </p>
                    )}
                  </div>

                  {/* Unread badge */}
                  {hasUnread ? (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0">
                      {item.unread}
                    </span>
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FAB button ── */}
      <button
        className="fixed bottom-6 right-6 z-[95] w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 bg-gradient-to-br from-slate-800 to-slate-900"
        onClick={function() { setOpen(function(o) { return !o; }); }}
      >
        {open ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <>
            <MessageSquare className="h-6 w-6 text-white" />
            {totalUnread > 0 && (
              <span
                className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse"
              >
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </>
        )}
      </button>

      {/* ── TaskChatModal ── */}
      {selectedTask && (
        <TaskChatModal
          open={chatOpen}
          onOpenChange={function(o: boolean) { if (!o) handleChatClose(); else setChatOpen(true); }}
          taskId={selectedTask.id}
          taskTitle={selectedTask.respondent_name || selectedTask.title || String(selectedTask.id)}
          userRole={userRole}
          userId={userId}
          userName={userName}
        />
      )}
    </>
  );
}