'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { fetchApi, uploadFile, fetchFileBlob } from '../../utils/apiHelper';
import { formatDate as sharedFormatDate } from '../../utils/dateFormat';
import {
  MessageSquare, Send, Users, User, Briefcase, Lock, Clock,
  Paperclip, Image as ImageIcon, Mic, MicOff, X, Play, Pause,
  File, Download, Reply, Smile, Check, CheckCheck, ChevronDown
} from 'lucide-react';

function useAttSrc(att: any) {
  var state = useState(att && att.data ? att.data : '');
  var src = state[0]; var setSrc = state[1];
  useEffect(function() {
    var cancelled = false;
    if (att && !att.data && att.url) {
      fetchFileBlob(att.url).then(function(u) { if (!cancelled) setSrc(u); }).catch(function() {});
    }
    return function() { cancelled = true; };
  }, [att && att.url]);
  return src;
}

function ChatAttachment(props: any) {
  var att = props.att;
  var src = useAttSrc(att);
  if (att.isVoice) {
    return <VoicePlayer data={src} />;
  }
  if (isImageType(att.type || '')) {
    return (
      <div className="mt-1 cursor-pointer" onClick={function() { if (src) props.onPreview(src); }}>
        {src ? <img src={src} alt={att.name} className="rounded-lg max-w-full max-h-[250px] object-cover" /> : <div className="text-[10px] text-muted-foreground p-2">Yüklənir...</div>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 mt-1 p-2 bg-black/5 rounded-lg">
      <File className="h-5 w-5 text-blue-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{att.name}</p>
        <p className="text-[9px] text-muted-foreground">{formatFileSize(att.size || 0)}</p>
      </div>
      <a href={src} download={att.name} className="shrink-0" onClick={function(e) { e.stopPropagation(); }}>
        <Download className="h-4 w-4 text-blue-600" />
      </a>
    </div>
  );
}

function timeAgo(d) {
  if (!d) return '';
  try {
    var dt = new Date(d);
    return sharedFormatDate(dt, '') + ' ' + dt.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

function timeOnly(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

function isImageType(type) {
  return type.startsWith('image/');
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

var EMOJIS = ['👍', '❤️', '😊', '😂', '🙏', '👏', '🎉', '✅', '⚡', '🔥', '💯', '📎', '⚖️', '📋', '🏛️', '📝'];


export function TaskChatModal({ open, onOpenChange, taskId, taskTitle, userRole, userId, userName, onBack }: TaskChatModalProps) {
  var [messages, setMessages] = useState<any[]>([]);
  var [loading, setLoading] = useState(false);
  var [sending, setSending] = useState(false);
  var [text, setText] = useState('');
  var [channel, setChannel] = useState('all');
  var [replyTo, setReplyTo] = useState<any>(null);
  var [showEmoji, setShowEmoji] = useState(false);
  var [showAttachMenu, setShowAttachMenu] = useState(false);
  var [previewImage, setPreviewImage] = useState<string | null>(null);

  // Voice recording
  var [isRecording, setIsRecording] = useState(false);
  var [recordingTime, setRecordingTime] = useState(0);
  var mediaRecorderRef = useRef<MediaRecorder | null>(null);
  var audioChunksRef = useRef<Blob[]>([]);
  var recordingTimerRef = useRef<any>(null);

  var scrollRef = useRef<HTMLDivElement>(null);
  var fileInputRef = useRef<HTMLInputElement>(null);
  var imageInputRef = useRef<HTMLInputElement>(null);

  var channels = userRole === 'manager'
    ? [{ key: 'all', label: 'Hamı', icon: Users }, { key: 'manager_client', label: 'Müştəri ilə', icon: User }, { key: 'manager_lawyer', label: 'Vəkil ilə', icon: Briefcase }]
    : userRole === 'lawyer'
    ? [{ key: 'all', label: 'Hamı', icon: Users }, { key: 'manager_lawyer', label: 'Menecer ilə', icon: Lock }]
    : [{ key: 'all', label: 'Hamı', icon: Users }, { key: 'manager_client', label: 'Menecer ilə', icon: Lock }];

  var fetchMessages = useCallback(function() {
    if (!taskId) return;
    fetchApi('/messages?task_id=' + taskId + '&user_role=' + userRole)
      .then(function(data) { setMessages(Array.isArray(data) ? data : []); })
      .catch(function() { setMessages([]); })
      .finally(function() { setLoading(false); });
  }, [taskId, userRole]);

  useEffect(function() {
    if (open && taskId) {
      setLoading(true);
      fetchMessages();
      var interval = setInterval(fetchMessages, 8000);
      return function() { clearInterval(interval); };
    }
  }, [open, taskId, fetchMessages]);

  useEffect(function() {
    setTimeout(function() {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 100);
  }, [messages, channel]);

  var filteredMessages = messages.filter(function(m) {
    if (userRole === 'manager') return m.channel === channel;
    return m.channel === channel;
  });

  // ============ SEND TEXT ============
  var sendMessage = async function(content, attachments) {
    if ((!content.trim() && !attachments) || !taskId || sending) return;
    setSending(true);
    try {
      var body = {
        task_id: Number(taskId),
        channel: channel,
        sender_id: userId,
        sender_type: userRole,
        sender_name: userName,
        content: content.trim(),
      };
      if (attachments) {
        body.attachments = JSON.stringify(attachments);
      }
      if (replyTo) {
        body.content = '[reply:' + replyTo.id + '] ' + body.content;
      }
      await fetchApi('/messages', { method: 'POST', body: JSON.stringify(body) });
      setText('');
      setReplyTo(null);
      setShowEmoji(false);
      fetchMessages();
    } catch (err) { console.error('Send error:', err); }
    finally { setSending(false); }
  };

  var handleSend = function() { sendMessage(text); };
  var handleKeyDown = function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  var [uploadPct, setUploadPct] = useState<number | null>(null);

  // ============ FILE/IMAGE UPLOAD ============
  var handleFileSelect = async function(e) {
    var file = e.target.files?.[0];
    if (!file) return;
    setShowAttachMenu(false);
    try {
      setUploadPct(0);
      var up = await uploadFile(file, file.name, setUploadPct);
      var attachment = [{ name: file.name, type: file.type, size: file.size, url: up.url }];
      var label = isImageType(file.type) ? '📷 Şəkil' : '📎 ' + file.name;
      await sendMessage(label, attachment);
    } catch (err) { console.error('File upload error:', err); }
    setUploadPct(null);
    e.target.value = '';
  };

  // ============ VOICE RECORDING ============
  var startRecording = async function() {
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      var recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = function(e) { audioChunksRef.current.push(e.data); };
      recorder.onstop = async function() {
        stream.getTracks().forEach(function(t) { t.stop(); });
        var blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        var vname = 'voice_' + Date.now() + '.webm';
        var up = await uploadFile(blob, vname);
        var attachment = [{ name: vname, type: 'audio/webm', size: blob.size, url: up.url, isVoice: true }];
        sendMessage('🎤 Səsli mesaj (' + recordingTime + 's)', attachment);
        setRecordingTime(0);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(function() { setRecordingTime(function(t) { return t + 1; }); }, 1000);
    } catch (err) { console.error('Mic error:', err); }
  };

  var stopRecording = function() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  var cancelRecording = function() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = function() {};
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  var formatRecTime = function(s) {
    var m = Math.floor(s / 60);
    var sec = s % 60;
    return m.toString().padStart(2, '0') + ':' + sec.toString().padStart(2, '0');
  };

  var getSenderColor = function(type) {
    return type === 'manager' ? 'bg-slate-700' : type === 'lawyer' ? 'bg-amber-600' : 'bg-blue-600';
  };
  var getSenderLabel = function(type) {
    return type === 'manager' ? 'Menecer' : type === 'lawyer' ? 'Vəkil' : 'Müştəri';
  };

  // Parse reply reference
  var getReplyContent = function(content) {
    var match = content.match(/^\[reply:(\d+)\]\s*/);
    if (match) return { replyId: parseInt(match[1]), text: content.replace(match[0], '') };
    return { replyId: null, text: content };
  };

  var findMessage = function(id) { return messages.find(function(m) { return m.id === id; }); };

  return (
    <>
    <Dialog open={open} onOpenChange={function(o) { if (!o) { cancelRecording(); setShowEmoji(false); setReplyTo(null); } onOpenChange(o); }}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0" onBack={onBack} backLabel="Geri qayıt">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b shrink-0 bg-gradient-to-r from-slate-50 to-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center"><MessageSquare className="h-4 w-4 text-white" /></div>
              <div className="flex-1 min-w-0"><p className="font-semibold truncate">{taskTitle || 'Tapşırıq #' + taskId}</p><p className="text-[10px] font-normal text-muted-foreground">Tapşırıq chatı</p></div>
            </DialogTitle>
            <DialogDescription className="sr-only">Chat</DialogDescription>
          </DialogHeader>

          {/* Channel tabs */}
          <div className="flex gap-1.5 mt-3">
            {channels.map(function(ch) {
              var Icon = ch.icon;
              var isActive = channel === ch.key;
              var unread = messages.filter(function(m) { return m.channel === ch.key && !m.is_read && m.sender_id !== userId; }).length;
              return (
                <button key={ch.key} className={'flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ' + (isActive ? 'bg-blue-600 text-white shadow-sm' : 'bg-muted/60 text-muted-foreground hover:bg-muted')} onClick={function() { setChannel(ch.key); }}>
                  <Icon className="h-3 w-3" />{ch.label}
                  {unread > 0 && <span className="ml-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center">{unread}</span>}
                </button>
              );
            })}
          </div>
          {channel !== 'all' && (
            <div className="flex items-center gap-1 mt-2 text-[9px] text-amber-700 bg-amber-50 px-2 py-1 rounded"><Lock className="h-2.5 w-2.5" />Şəxsi kanal — yalnız seçilmiş tərəf görür</div>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-1 bg-slate-100" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23d1d5db\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}>
          {loading && messages.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground"><Clock className="h-6 w-6 mx-auto mb-2 animate-spin opacity-30" /><p className="text-sm">Yüklənir...</p></div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground"><MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-15" /><p className="text-sm">Hələ mesaj yoxdur</p><p className="text-[10px] mt-1">İlk mesajı göndərin!</p></div>
          ) : (
            filteredMessages.map(function(msg, idx) {
              var isMine = msg.sender_id === userId;
              var parsed = getReplyContent(msg.content || '');
              var repliedMsg = parsed.replyId ? findMessage(parsed.replyId) : null;
              var attachments = [];
              try { attachments = msg.attachments ? (typeof msg.attachments === 'string' ? JSON.parse(msg.attachments) : msg.attachments) : []; } catch {}
              var showSender = !isMine && (idx === 0 || filteredMessages[idx - 1]?.sender_id !== msg.sender_id);

              return (
                <div key={msg.id} className={'flex ' + (isMine ? 'justify-end' : 'justify-start')}>
                  <div className={'max-w-[80%] group relative ' + (isMine ? 'items-end' : 'items-start')}>
                    {/* Sender label */}
                    {showSender && (
                      <p className={'text-[10px] font-semibold ml-1 mb-0.5 ' + (msg.sender_type === 'manager' ? 'text-slate-600' : msg.sender_type === 'lawyer' ? 'text-amber-600' : 'text-blue-600')}>
                        {msg.sender_name} · {getSenderLabel(msg.sender_type || '')}
                      </p>
                    )}

                    {/* Bubble */}
                    <div className={'relative px-3 py-1.5 rounded-xl text-[13px] leading-relaxed shadow-sm ' + (isMine ? 'bg-emerald-100 rounded-tr-sm' : 'bg-white rounded-tl-sm')}>
                      {/* Reply preview */}
                      {repliedMsg && (
                        <div className="mb-1 px-2 py-1 bg-black/5 rounded border-l-2 border-blue-400 text-[10px]">
                          <p className="font-medium text-blue-700">{repliedMsg.sender_name}</p>
                          <p className="text-muted-foreground truncate">{getReplyContent(repliedMsg.content || '').text}</p>
                        </div>
                      )}

                      {/* Text */}
                      {parsed.text && !parsed.text.startsWith('📷') && !parsed.text.startsWith('🎤') && !parsed.text.startsWith('📎') && (
                        <p className="break-words whitespace-pre-wrap">{parsed.text}</p>
                      )}

                      {/* Attachments */}
                      {attachments.map(function(att, ai) {
                        return <ChatAttachment key={ai} att={att} onPreview={setPreviewImage} />;
                      })}

                      {/* Time + read status */}
                      <div className={'flex items-center justify-end gap-1 mt-0.5 -mb-0.5'}>
                        {channel !== 'all' && <Lock className="h-2 w-2 text-amber-500" />}
                        <span className="text-[9px] text-muted-foreground">{timeOnly(msg.created_at || '')}</span>
                        {isMine && (msg.is_read ? <CheckCheck className="h-3 w-3 text-blue-500" /> : <Check className="h-3 w-3 text-muted-foreground" />)}
                      </div>

                      {/* Reply button on hover */}
                      <button className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-white shadow flex items-center justify-center" onClick={function() { setReplyTo(msg); }}>
                        <Reply className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Reply bar */}
        {replyTo && (
          <div className="px-4 py-2 bg-blue-50 border-t flex items-center gap-2">
            <div className="w-1 h-8 bg-blue-400 rounded-full shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-blue-700">{replyTo.sender_name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{getReplyContent(replyTo.content || '').text}</p>
            </div>
            <button onClick={function() { setReplyTo(null); }}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
        )}

        {/* Emoji picker */}
        {showEmoji && (
          <div className="px-4 py-2 border-t bg-white flex flex-wrap gap-1">
            {EMOJIS.map(function(emoji) {
              return <button key={emoji} className="w-8 h-8 rounded hover:bg-muted flex items-center justify-center text-lg" onClick={function() { setText(text + emoji); setShowEmoji(false); }}>{emoji}</button>;
            })}
          </div>
        )}

        {/* Input area */}
        <div className="border-t bg-white px-3 py-2 shrink-0">
          {isRecording ? (
            <div className="flex items-center gap-3">
              <button onClick={cancelRecording} className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center"><X className="h-4 w-4 text-red-600" /></button>
              <div className="flex-1 flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-mono text-red-600">{formatRecTime(recordingTime)}</span>
                <div className="flex-1 h-1 bg-red-100 rounded-full overflow-hidden"><div className="h-full bg-red-400 animate-pulse" style={{ width: '60%' }} /></div>
              </div>
              <button onClick={stopRecording} className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-lg"><Send className="h-4 w-4 text-white" /></button>
            </div>
          ) : (
            <div className="flex items-end gap-1.5">
              {/* Emoji */}
              <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted shrink-0" onClick={function() { setShowEmoji(!showEmoji); setShowAttachMenu(false); }}>
                <Smile className="h-5 w-5 text-muted-foreground" />
              </button>

              {/* Attach */}
              <div className="relative shrink-0">
                <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted" onClick={function() { setShowAttachMenu(!showAttachMenu); setShowEmoji(false); }}>
                  <Paperclip className="h-5 w-5 text-muted-foreground" />
                </button>
                {showAttachMenu && (
                  <div className="absolute bottom-12 left-0 bg-white rounded-xl shadow-xl border p-2 flex flex-col gap-1 w-40 z-50">
                    <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 text-sm" onClick={function() { imageInputRef.current?.click(); }}>
                      <ImageIcon className="h-4 w-4 text-blue-600" />Şəkil
                    </button>
                    <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-green-50 text-sm" onClick={function() { fileInputRef.current?.click(); }}>
                      <File className="h-4 w-4 text-green-600" />Fayl
                    </button>
                  </div>
                )}
              </div>

              {/* Text input */}
              <div className="flex-1">
                <textarea
                  value={text}
                  onChange={function(e) { setText(e.target.value); }}
                  onKeyDown={handleKeyDown}
                  onFocus={function() { setShowAttachMenu(false); }}
                  placeholder={channel === 'all' ? 'Mesaj yazın...' : '🔒 Şəxsi mesaj...'}
                  className="w-full resize-none rounded-2xl border bg-muted/30 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 min-h-[40px] max-h-[100px]"
                  rows={1}
                />
              </div>

              {/* Send or Voice */}
              {text.trim() ? (
                <button className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shrink-0" onClick={handleSend} disabled={sending}>
                  <Send className="h-4 w-4 text-white" />
                </button>
              ) : (
                <button className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shrink-0" onClick={startRecording}>
                  <Mic className="h-4 w-4 text-white" />
                </button>
              )}
            </div>
          )}
        </div>

        {uploadPct !== null && (
          <div className="px-4 py-1 text-xs text-muted-foreground">Fayl yüklənir... {uploadPct}%</div>
        )}
        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      </DialogContent>
    </Dialog>

    {/* Image preview lightbox */}
    {previewImage && (
      <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center" onClick={function() { setPreviewImage(null); }}>
        <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"><X className="h-6 w-6 text-white" /></button>
        <img src={previewImage} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
      </div>
    )}
    </>
  );
}

// ============ VOICE PLAYER ============
function VoicePlayer({ data }) {
  var [playing, setPlaying] = useState(false);
  var [progress, setProgress] = useState(0);
  var audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(function() {
    var audio = new Audio(data);
    audioRef.current = audio;
    audio.onended = function() { setPlaying(false); setProgress(0); };
    audio.ontimeupdate = function() { if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100); };
    return function() { audio.pause(); };
  }, [data]);

  var toggle = function() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  return (
    <div className="flex items-center gap-2 min-w-[180px] mt-1">
      <button onClick={toggle} className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
        {playing ? <Pause className="h-3 w-3 text-white" /> : <Play className="h-3 w-3 text-white ml-0.5" />}
      </button>
      <div className="flex-1">
        <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: progress + '%' }} />
        </div>
      </div>
      <Mic className="h-3 w-3 text-muted-foreground" />
    </div>
  );
}