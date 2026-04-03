import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePermissions, urlToSectionKey } from '@/hooks/usePermissions';
import {
  Package, PackageSearch, Archive, Search, Building2, MapPin, Box,
  Truck, Wallet, Building, DollarSign, Printer, ScrollText, Settings, Users,
  BarChart3, UserCheck, TrendingUp, Calendar, Locate, MessageSquare, FileSpreadsheet,
  CircleDot, Calculator, Contact, Clock, CheckCircle2, XCircle, FileBarChart, Trash2,
  Send, User, Check, CheckCheck, X
} from 'lucide-react';

const sections = [
  { title: 'الأوردرات', url: '/orders', icon: Package, color: 'hsl(217,91%,60%)' },
  { title: 'جميع الأوردرات', url: '/unassigned-orders', icon: PackageSearch, color: 'hsl(38,92%,50%)' },
  { title: 'الأوردرات القديمة', url: '/closed-orders', icon: Archive, color: 'hsl(215,20%,60%)' },
  { title: 'بحث شامل', url: '/search', icon: Search, color: 'hsl(217,91%,60%)' },
  { title: 'المكاتب', url: '/offices', icon: Building2, color: 'hsl(142,76%,36%)' },
  { title: 'أسعار التوصيل', url: '/delivery-prices', icon: MapPin, color: 'hsl(38,92%,50%)' },
  { title: 'المنتجات', url: '/products', icon: Box, color: 'hsl(0,72%,51%)' },
  { title: 'العملاء', url: '/customers', icon: Contact, color: 'hsl(200,70%,50%)' },
  { title: 'المندوبين', url: '/couriers', icon: Truck, color: 'hsl(38,92%,50%)' },
  { title: 'المستخدمين', url: '/users', icon: Users, color: 'hsl(200,70%,50%)' },
  { title: 'إدارة الحالات', url: '/status-management', icon: CircleDot, color: 'hsl(270,60%,60%)' },
  { title: 'تحصيلات المندوبين', url: '/courier-collections', icon: Wallet, color: 'hsl(217,91%,60%)' },
  { title: 'حسابات المكاتب', url: '/office-accounts', icon: Building, color: 'hsl(142,76%,36%)' },
  { title: 'السلفات والخصومات', url: '/advances', icon: DollarSign, color: 'hsl(0,72%,51%)' },
  { title: 'التقرير اليومي', url: '/daily-report', icon: Calendar, color: 'hsl(142,76%,36%)' },
  { title: 'التقارير المالية', url: '/financial-reports', icon: BarChart3, color: 'hsl(217,91%,60%)' },
  { title: 'إحصائيات المناديب', url: '/courier-stats', icon: UserCheck, color: 'hsl(38,92%,50%)' },
  { title: 'إحصائيات المكاتب', url: '/office-stats', icon: TrendingUp, color: 'hsl(142,76%,36%)' },
  { title: 'تقرير الأرباح', url: '/profit-report', icon: Calculator, color: 'hsl(0,72%,51%)' },
  { title: 'تتبع الشحنات', url: '/tracking', icon: Locate, color: 'hsl(270,60%,60%)' },
  { title: 'تتبع المناديب', url: '/courier-tracking', icon: Truck, color: 'hsl(142,76%,36%)' },
  { title: 'الطباعة', url: '/print', icon: Printer, color: 'hsl(215,20%,60%)' },
  { title: 'ملاحظات الأوردرات', url: '/order-notes', icon: MessageSquare, color: 'hsl(200,70%,50%)' },
  { title: 'تصدير البيانات', url: '/data-export', icon: FileSpreadsheet, color: 'hsl(142,76%,36%)' },
  { title: 'سجل الحركات', url: '/logs', icon: ScrollText, color: 'hsl(215,20%,60%)' },
  { title: 'الإعدادات', url: '/settings', icon: Settings, color: 'hsl(215,20%,60%)' },
  { title: 'تقرير المكاتب الجديد', url: '/office-report', icon: FileBarChart, color: 'hsl(217,91%,60%)' },
  { title: 'سلة المحذوفات', url: '/trash', icon: Trash2, color: 'hsl(0,72%,51%)' },
  { title: 'سيستم الحسابات', url: '/accounting-system', icon: Calculator, color: 'hsl(270,60%,60%)' },
];

interface ChatContact {
  id: string; name: string; role: string; unread: number;
  lastMessage?: string; lastTime?: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canView } = usePermissions();
  const [stats, setStats] = useState({ total: 0, open: 0, delivered: 0, returned: 0, todayCount: 0, todayShipping: 0 });

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatContacts, setChatContacts] = useState<ChatContact[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const visibleSections = useMemo(
    () => sections.filter((section) => canView(urlToSectionKey(section.url))),
    [canView]
  );

  useEffect(() => {
    loadStats();
    loadChatContacts();
  }, []);

  // Chat realtime
  useEffect(() => {
    if (!selectedChat) return;
    loadChatMessages(selectedChat);
    markRead(selectedChat);

    const channel = supabase.channel('dash-chat-' + selectedChat)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${user?.id}`,
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id === selectedChat) {
          setChatMessages(prev => [...prev, msg]);
          markRead(selectedChat);
        }
        loadChatContacts();
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedChat]);

  // Refresh unread count periodically
  useEffect(() => {
    const interval = setInterval(loadChatContacts, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages]);

  const loadStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    const [allRes, statusRes] = await Promise.all([
      supabase.from('orders').select('id, is_closed, status_id, price, delivery_price, shipping_paid, created_at'),
      supabase.from('order_statuses').select('id, name'),
    ]);
    const all = allRes.data || [];
    const sts = statusRes.data || [];
    const deliveredIds = sts.filter(s => s.name === 'تم التسليم' || s.name === 'تسليم جزئي').map(s => s.id);
    const returnedIds = sts.filter(s => ['مرتجع', 'رفض ودفع شحن', 'رفض ولم يدفع شحن', 'تهرب', 'ملغي', 'لم يرد'].includes(s.name)).map(s => s.id);
    const rejectPaidShipId = sts.find(s => s.name === 'رفض ودفع شحن')?.id;
    const halfShipId = sts.find(s => s.name === 'استلم ودفع نص الشحن')?.id;
    const todayOrders = all.filter(o => o.created_at.startsWith(today));
    const todayShipping = todayOrders.reduce((s, o) => {
      if (deliveredIds.includes(o.status_id)) return s + Number(o.delivery_price);
      if (o.status_id === rejectPaidShipId || o.status_id === halfShipId) return s + Number(o.shipping_paid || 0);
      return s;
    }, 0);
    setStats({ total: all.length, open: all.filter(o => !o.is_closed).length, delivered: all.filter(o => deliveredIds.includes(o.status_id)).length, returned: all.filter(o => returnedIds.includes(o.status_id)).length, todayCount: todayOrders.length, todayShipping });
  };

  const loadChatContacts = async () => {
    const { data: roles } = await supabase.from('user_roles').select('user_id, role');
    if (!roles) return;
    const userIds = [...new Set(roles.map(r => r.user_id))].filter(id => id !== user?.id);
    if (userIds.length === 0) return;
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, phone').in('id', userIds);
    if (!profiles) return;

    const { data: unread } = await supabase.from('messages' as any).select('sender_id').eq('receiver_id', user?.id || '').eq('is_read', false);
    const unreadMap: Record<string, number> = {};
    (unread || []).forEach((m: any) => { unreadMap[m.sender_id] = (unreadMap[m.sender_id] || 0) + 1; });

    const { data: lastMsgs } = await supabase.from('messages' as any).select('*').or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`).order('created_at', { ascending: false }).limit(300);
    const lastMap: Record<string, { msg: string; time: string }> = {};
    (lastMsgs || []).forEach((m: any) => {
      const oid = m.sender_id === user?.id ? m.receiver_id : m.sender_id;
      if (!lastMap[oid]) lastMap[oid] = { msg: m.message, time: m.created_at };
    });

    const contacts: ChatContact[] = profiles.map(p => {
      const role = roles.find(r => r.user_id === p.id)?.role || '';
      return {
        id: p.id, name: p.full_name || 'بدون اسم',
        role: role === 'courier' ? 'مندوب' : role === 'owner' ? 'مالك' : role === 'admin' ? 'أدمن' : 'مكتب',
        unread: unreadMap[p.id] || 0,
        lastMessage: lastMap[p.id]?.msg, lastTime: lastMap[p.id]?.time,
      };
    }).sort((a, b) => b.unread - a.unread || (b.lastTime || '').localeCompare(a.lastTime || ''));
    setChatContacts(contacts);
  };

  const loadChatMessages = async (contactId: string) => {
    const { data } = await supabase.from('messages' as any).select('*')
      .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${user?.id})`)
      .order('created_at', { ascending: true }).limit(100);
    setChatMessages(data || []);
  };

  const markRead = async (contactId: string) => {
    await supabase.from('messages' as any).update({ is_read: true }).eq('sender_id', contactId).eq('receiver_id', user?.id || '').eq('is_read', false);
  };

  const sendMsg = async () => {
    if (!newMsg.trim() || !selectedChat || sending) return;
    setSending(true);
    const { data } = await supabase.from('messages' as any).insert({ sender_id: user?.id, receiver_id: selectedChat, message: newMsg.trim() }).select().single();
    if (data) { setChatMessages(prev => [...prev, data]); setNewMsg(''); loadChatContacts(); }
    setSending(false);
  };

  const totalUnread = chatContacts.reduce((s, c) => s + c.unread, 0);
  const selectedContactInfo = chatContacts.find(c => c.id === selectedChat);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">لوحة التحكم</h1>

      {/* Stats cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <Package className="h-5 w-5 mx-auto mb-1 text-primary" />
          <p className="text-[10px] text-muted-foreground">إجمالي</p>
          <p className="text-lg font-bold">{stats.total}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <Clock className="h-5 w-5 mx-auto mb-1 text-warning" />
          <p className="text-[10px] text-muted-foreground">مفتوح</p>
          <p className="text-lg font-bold text-warning">{stats.open}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-success" />
          <p className="text-[10px] text-muted-foreground">تسليم</p>
          <p className="text-lg font-bold text-success">{stats.delivered}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <XCircle className="h-5 w-5 mx-auto mb-1 text-destructive" />
          <p className="text-[10px] text-muted-foreground">مرتجع</p>
          <p className="text-lg font-bold text-destructive">{stats.returned}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <Calendar className="h-5 w-5 mx-auto mb-1 text-primary" />
          <p className="text-[10px] text-muted-foreground">اليوم</p>
          <p className="text-lg font-bold">{stats.todayCount}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <DollarSign className="h-5 w-5 mx-auto mb-1 text-success" />
          <p className="text-[10px] text-muted-foreground">إيراد اليوم</p>
          <p className="text-lg font-bold">{stats.todayShipping.toLocaleString()}</p>
        </CardContent></Card>
      </div>

      {/* Section shortcuts */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visibleSections.map((s) => (
          <Card key={s.url} className="bg-card border-border cursor-pointer hover:bg-secondary/50 transition-colors active:scale-95" onClick={() => navigate(s.url)}>
            <CardContent className="flex flex-col items-center gap-2 p-3 sm:p-4">
              <div className="rounded-xl p-2.5" style={{ backgroundColor: s.color + '20' }}>
                <s.icon className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: s.color }} />
              </div>
              <span className="text-xs sm:text-sm font-medium text-center leading-tight">{s.title}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Floating Chat Button */}
      <div className="fixed bottom-6 left-6 z-50">
        {!chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            className="relative w-14 h-14 rounded-full bg-[hsl(142,70%,28%)] text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
          >
            <MessageSquare className="h-6 w-6" />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {totalUnread}
              </span>
            )}
          </button>
        )}

        {/* Chat Window */}
        {chatOpen && (
          <div className="w-[340px] sm:w-[380px] h-[480px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-200">
            {!selectedChat ? (
              <>
                {/* Contacts Header */}
                <div className="bg-[hsl(142,70%,28%)] text-white p-3 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    <span className="font-bold text-sm">المحادثات</span>
                    {totalUnread > 0 && (
                      <span className="bg-white text-[hsl(142,70%,28%)] text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{totalUnread}</span>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-7 w-7" onClick={() => setChatOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {/* Contacts List */}
                <ScrollArea className="flex-1">
                  {chatContacts.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-12">لا يوجد محادثات</p>
                  )}
                  {chatContacts.map((c, i) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedChat(c.id)}
                      className={`w-full p-3 flex items-center gap-3 text-right hover:bg-accent/40 transition-colors ${i < chatContacts.length - 1 ? 'border-b border-border' : ''}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-[hsl(142,70%,28%)]/10 flex items-center justify-center shrink-0">
                        <User className="h-5 w-5 text-[hsl(142,70%,28%)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm truncate">{c.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {c.lastTime && new Date(c.lastTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {c.lastMessage || c.role}
                          </p>
                          {c.unread > 0 && (
                            <span className="bg-[hsl(142,70%,28%)] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{c.unread}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </ScrollArea>
              </>
            ) : (
              <>
                {/* Chat Header */}
                <div className="bg-[hsl(142,70%,28%)] text-white flex items-center gap-2 p-2.5 shrink-0">
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-7 w-7" onClick={() => setSelectedChat(null)}>
                    ←
                  </Button>
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{selectedContactInfo?.name}</p>
                    <p className="text-[10px] opacity-80">{selectedContactInfo?.role}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-7 w-7" onClick={() => setChatOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {/* Messages */}
                <div
                  ref={chatScrollRef}
                  className="flex-1 overflow-y-auto p-3 space-y-1"
                  style={{ backgroundColor: 'hsl(var(--muted) / 0.3)', backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}
                >
                  {chatMessages.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                      <span className="bg-accent/80 text-muted-foreground text-xs px-3 py-1 rounded-full">ابدأ المحادثة 💬</span>
                    </div>
                  )}
                  {chatMessages.map((m: any) => {
                    const isMine = m.sender_id === user?.id;
                    return (
                      <div key={m.id} className={`flex ${isMine ? 'justify-start' : 'justify-end'} mb-1`}>
                        <div className={`relative max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs shadow-sm ${
                          isMine
                            ? 'bg-[hsl(142,60%,85%)] text-[hsl(142,70%,15%)] rounded-tl-none'
                            : 'bg-card text-card-foreground rounded-tr-none border border-border'
                        }`}>
                          <p className="leading-relaxed">{m.message}</p>
                          <div className={`flex items-center gap-1 mt-0.5 text-[10px] opacity-50 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <span>{new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMine && (m.is_read
                              ? <CheckCheck className="h-3 w-3 text-[hsl(217,91%,60%)]" />
                              : <Check className="h-3 w-3" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Input */}
                <div className="p-2 bg-muted/30 border-t border-border shrink-0 flex gap-2 items-center">
                  <Input
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    placeholder="اكتب رسالة..."
                    className="bg-card text-xs h-9 rounded-full border-border"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                  />
                  <Button
                    onClick={sendMsg}
                    disabled={sending || !newMsg.trim()}
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full bg-[hsl(142,70%,28%)] hover:bg-[hsl(142,70%,22%)]"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
