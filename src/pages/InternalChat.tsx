import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, User, Search, Check, CheckCheck } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  phone: string;
  role: string;
  unread: number;
  lastMessage?: string;
  lastMessageTime?: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function InternalChat() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadContacts(); }, []);

  useEffect(() => {
    if (!selectedContact) return;
    loadMessages(selectedContact);
    markAsRead(selectedContact);

    // Real-time subscription
    const channel = supabase.channel('messages-' + selectedContact)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user?.id}`,
      }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id === selectedContact) {
          setMessages(prev => [...prev, msg]);
          markAsRead(selectedContact);
        }
        loadContacts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedContact]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadContacts = async () => {
    // Get all couriers and admins
    const { data: roles } = await supabase.from('user_roles').select('user_id, role');
    if (!roles) return;

    const userIds = [...new Set(roles.map(r => r.user_id))].filter(id => id !== user?.id);
    if (userIds.length === 0) return;

    const { data: profiles } = await supabase.from('profiles').select('id, full_name, phone').in('id', userIds);
    if (!profiles) return;

    // Get unread counts
    const { data: unreadMessages } = await supabase
      .from('messages' as any)
      .select('sender_id')
      .eq('receiver_id', user?.id || '')
      .eq('is_read', false);

    const unreadCounts: Record<string, number> = {};
    (unreadMessages || []).forEach((m: any) => {
      unreadCounts[m.sender_id] = (unreadCounts[m.sender_id] || 0) + 1;
    });

    // Get last messages
    const { data: lastMsgs } = await supabase
      .from('messages' as any)
      .select('*')
      .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
      .order('created_at', { ascending: false })
      .limit(500);

    const lastMessageMap: Record<string, { message: string; time: string }> = {};
    (lastMsgs || []).forEach((m: any) => {
      const otherId = m.sender_id === user?.id ? m.receiver_id : m.sender_id;
      if (!lastMessageMap[otherId]) {
        lastMessageMap[otherId] = { message: m.message, time: m.created_at };
      }
    });

    const contactList: Contact[] = profiles.map(p => {
      const role = roles.find(r => r.user_id === p.id)?.role || 'user';
      return {
        id: p.id,
        name: p.full_name || 'بدون اسم',
        phone: p.phone || '',
        role: role === 'courier' ? 'مندوب' : role === 'owner' ? 'مالك' : role === 'admin' ? 'أدمن' : 'مكتب',
        unread: unreadCounts[p.id] || 0,
        lastMessage: lastMessageMap[p.id]?.message,
        lastMessageTime: lastMessageMap[p.id]?.time,
      };
    }).sort((a, b) => {
      if (a.unread !== b.unread) return b.unread - a.unread;
      if (a.lastMessageTime && b.lastMessageTime) return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      return 0;
    });

    setContacts(contactList);
  };

  const loadMessages = async (contactId: string) => {
    const { data } = await supabase
      .from('messages' as any)
      .select('*')
      .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${user?.id})`)
      .order('created_at', { ascending: true })
      .limit(200);
    setMessages(((data as any) || []) as Message[]);
  };

  const markAsRead = async (contactId: string) => {
    await supabase
      .from('messages' as any)
      .update({ is_read: true })
      .eq('sender_id', contactId)
      .eq('receiver_id', user?.id || '')
      .eq('is_read', false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || sending) return;
    setSending(true);
    const { data, error } = await supabase.from('messages' as any).insert({
      sender_id: user?.id,
      receiver_id: selectedContact,
      message: newMessage.trim(),
    }).select().single();

    if (!error && data) {
      setMessages(prev => [...prev, data as any as Message]);
      setNewMessage('');
      loadContacts();
    }
    setSending(false);
  };

  const filteredContacts = contacts.filter(c =>
    c.name.includes(searchTerm) || c.phone.includes(searchTerm) || c.role.includes(searchTerm)
  );

  const selectedContactInfo = contacts.find(c => c.id === selectedContact);
  const totalUnread = contacts.reduce((s, c) => s + c.unread, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          التواصل الداخلي
        </h1>
        {totalUnread > 0 && (
          <Badge variant="destructive">{totalUnread} رسالة جديدة</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-200px)] min-h-[500px]">
        {/* Contacts list */}
        <Card className="bg-card border-border md:col-span-1">
          <CardHeader className="p-3 pb-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pr-9 bg-secondary"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-310px)] min-h-[380px]">
              {filteredContacts.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedContact(c.id)}
                  className={`w-full p-3 flex items-center gap-3 text-right hover:bg-accent/50 transition-colors border-b border-border ${selectedContact === c.id ? 'bg-accent' : ''}`}
                >
                  <div className="rounded-full p-2 bg-primary/10 shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate">{c.name}</p>
                      {c.unread > 0 && (
                        <Badge variant="destructive" className="text-xs mr-1">{c.unread}</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">{c.role}</Badge>
                      {c.lastMessageTime && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(c.lastMessageTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {c.lastMessage && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessage}</p>
                    )}
                  </div>
                </button>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat area */}
        <Card className="bg-card border-border md:col-span-2 flex flex-col">
          {selectedContact ? (
            <>
              <CardHeader className="p-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <div className="rounded-full p-2 bg-primary/10">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{selectedContactInfo?.name}</p>
                    <Badge variant="outline" className="text-xs">{selectedContactInfo?.role}</Badge>
                  </div>
                </div>
              </CardHeader>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">لا توجد رسائل بعد. ابدأ المحادثة!</p>
                )}
                {messages.map(m => {
                  const isMine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${isMine ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${isMine ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                        <p>{m.message}</p>
                        <div className={`flex items-center gap-1 mt-1 text-xs opacity-70 ${isMine ? 'justify-start' : 'justify-end'}`}>
                          <span>{new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMine && (m.is_read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 border-t border-border shrink-0">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="اكتب رسالتك..."
                    className="bg-secondary"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  />
                  <Button onClick={sendMessage} disabled={sending || !newMessage.trim()} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>اختر شخص من القائمة لبدء المحادثة</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
