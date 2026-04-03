import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LogOut, Eye, Phone, MessageSquare, Send, MapPin, AlertTriangle, Search, Camera } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';
import { useCourierLocation } from '@/hooks/useCourierLocation';
import { Badge } from '@/components/ui/badge';

export default function CourierOrders() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const [savingNote, setSavingNote] = useState(false);
  const [shippingDialog, setShippingDialog] = useState<any | null>(null);
  const [shippingAmount, setShippingAmount] = useState('');
  const [partialDialog, setPartialDialog] = useState<any | null>(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatContacts, setChatContacts] = useState<any[]>([]);
  const [chatTarget, setChatTarget] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatMsg, setChatMsg] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [search, setSearch] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // GPS tracking - mandatory, auto-prompt
  useCourierLocation(user?.id);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationGranted(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setLocationGranted(true),
      (err) => {
        console.error('GPS denied:', err);
        setLocationGranted(false);
        // Re-prompt after 3 seconds
        setTimeout(requestLocation, 3000);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  useEffect(() => {
    load();
    loadChatContacts();
    supabase.from('order_statuses').select('*').order('sort_order').then(({ data }) => setStatuses(data || []));
  }, []);

  // Chat realtime
  useEffect(() => {
    if (!chatTarget) return;
    loadChatMsgs(chatTarget);
    markChatRead(chatTarget);
    const ch = supabase.channel('courier-chat-' + chatTarget)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user?.id}` }, (p) => {
        const msg = p.new as any;
        if (msg.sender_id === chatTarget) { setChatMessages(prev => [...prev, msg]); markChatRead(chatTarget); }
        loadChatContacts();
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [chatTarget]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages]);

  const loadChatContacts = async () => {
    const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['owner', 'admin']);
    if (!roles) return;
    const ids = roles.map(r => r.user_id).filter(id => id !== user?.id);
    if (ids.length === 0) return;
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);
    const { data: unread } = await supabase.from('messages' as any).select('sender_id').eq('receiver_id', user?.id || '').eq('is_read', false);
    const unreadMap: Record<string, number> = {};
    (unread || []).forEach((m: any) => { unreadMap[m.sender_id] = (unreadMap[m.sender_id] || 0) + 1; });
    setChatContacts((profiles || []).map(p => ({
      id: p.id, name: p.full_name || 'الإدارة', unread: unreadMap[p.id] || 0,
      role: roles.find(r => r.user_id === p.id)?.role === 'owner' ? 'مالك' : 'أدمن',
    })));
  };

  const loadChatMsgs = async (cid: string) => {
    const { data } = await supabase.from('messages' as any).select('*')
      .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${cid}),and(sender_id.eq.${cid},receiver_id.eq.${user?.id})`)
      .order('created_at', { ascending: true }).limit(100);
    setChatMessages(data || []);
  };

  const markChatRead = async (cid: string) => {
    await supabase.from('messages' as any).update({ is_read: true }).eq('sender_id', cid).eq('receiver_id', user?.id || '').eq('is_read', false);
  };

  const sendChatMsg = async () => {
    if (!chatMsg.trim() || !chatTarget || chatSending) return;
    setChatSending(true);
    const { data } = await supabase.from('messages' as any).insert({ sender_id: user?.id, receiver_id: chatTarget, message: chatMsg.trim() }).select().single();
    if (data) { setChatMessages(prev => [...prev, data]); setChatMsg(''); loadChatContacts(); }
    setChatSending(false);
  };

  const load = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_statuses(name, color), offices(name)')
      .eq('courier_id', user?.id || '')
      .eq('is_courier_closed', false)
      .order('created_at', { ascending: false });
    setOrders(data || []);
  };

  const syncCollectionForOrder = async (orderId: string, amount: number) => {
    await supabase.from('courier_collections').delete().eq('order_id', orderId);
    if (amount > 0) {
      await supabase.from('courier_collections').insert({
        courier_id: user?.id || '',
        order_id: orderId,
        amount,
        collected_by: user?.id,
      });
    }
  };

  const totalPrice = orders.reduce((sum, o) => sum + Number(o.price) + Number(o.delivery_price), 0);

  const rejectWithShipStatus = statuses.find(s => s.name === 'رفض ودفع شحن');
  const postponedStatus = statuses.find(s => s.name === 'مؤجل');
  const partialDeliveryStatus = statuses.find(s => s.name === 'تسليم جزئي');
  const receivedHalfShipStatus = statuses.find(s => s.name === 'استلم ودفع نص الشحن');

  const updateStatus = async (orderId: string, statusId: string) => {
    if (statusId === rejectWithShipStatus?.id || statusId === receivedHalfShipStatus?.id) {
      const type = statusId === receivedHalfShipStatus?.id ? 'half_ship' : 'reject';
      setShippingDialog({ orderId, statusId, type });
      setShippingAmount('');
      return;
    }

    if (statusId === partialDeliveryStatus?.id) {
      const order = orders.find(o => o.id === orderId);
      setPartialDialog({ orderId, statusId, order });
      setPartialAmount('');
      return;
    }

    await supabase.from('orders').update({ status_id: statusId, shipping_paid: 0, partial_amount: 0 }).eq('id', orderId);
    await syncCollectionForOrder(orderId, 0);
    logActivity('مندوب غيّر حالة أوردر', { order_id: orderId, status_id: statusId });

    if (statusId === postponedStatus?.id) {
      // Keep the status as "مؤجل" but remove from courier
      await supabase.from('orders').update({ courier_id: null }).eq('id', orderId);
    }

    toast.success('تم تحديث الحالة');
    load();
  };

  const confirmShippingPaid = async () => {
    if (!shippingDialog) return;
    const amount = parseFloat(shippingAmount) || 0;
    if (amount <= 0) {
      toast.error('اكتب مبلغ الشحن المحصل');
      return;
    }

    await supabase.from('orders').update({
      status_id: shippingDialog.statusId,
      shipping_paid: amount,
      partial_amount: 0,
    }).eq('id', shippingDialog.orderId);

    await syncCollectionForOrder(shippingDialog.orderId, amount);

    logActivity('مندوب - تحصيل شحن', {
      order_id: shippingDialog.orderId,
      status_id: shippingDialog.statusId,
      amount,
    });

    toast.success(`تم تسجيل مبلغ الشحن: ${amount} ج.م`);
    setShippingDialog(null);
    setShippingAmount('');
    load();
  };

  const confirmPartialDelivery = async () => {
    if (!partialDialog) return;
    const orderPrice = Number(partialDialog.order?.price || 0);
    const received = parseFloat(partialAmount) || 0;

    if (received <= 0) {
      toast.error('اكتب المبلغ المحصل');
      return;
    }

    if (received > orderPrice) {
      toast.error('المبلغ المحصل لا يمكن أن يكون أكبر من سعر الأوردر');
      return;
    }

    await supabase.from('orders').update({
      status_id: partialDialog.statusId,
      partial_amount: received,
      shipping_paid: 0,
    }).eq('id', partialDialog.orderId);

    await syncCollectionForOrder(partialDialog.orderId, received);

    logActivity('مندوب - تسليم جزئي', {
      order_id: partialDialog.orderId,
      received,
      returned: orderPrice - received,
    });

    toast.success(`تم تسجيل التحصيل الجزئي: ${received} ج.م`);
    setPartialDialog(null);
    load();
  };

  const openDetails = async (order: any) => {
    setSelectedOrder(order);
    const { data } = await supabase.from('order_notes').select('*').eq('order_id', order.id).order('created_at', { ascending: false });
    setNotes(data || []);
  };

  const addNote = async () => {
    if (!noteText.trim() || !selectedOrder) return;
    setSavingNote(true);
    await supabase.from('order_notes').insert({ order_id: selectedOrder.id, user_id: user?.id || '', note: noteText.trim() });
    setNoteText('');
    const { data } = await supabase.from('order_notes').select('*').eq('order_id', selectedOrder.id).order('created_at', { ascending: false });
    setNotes(data || []);
    setSavingNote(false);
    toast.success('تم إضافة الملاحظة');
  };

  const moveOrder = (index: number, direction: number) => {
    const newOrders = [...orders];
    const [item] = newOrders.splice(index, 1);
    newOrders.splice(index + direction, 0, item);
    setOrders(newOrders);
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold">أوردراتي</h1>
          <div className="flex items-center gap-2">
            {locationGranted === true && (
              <Badge variant="default" className="text-xs gap-1">
                <MapPin className="h-3 w-3" /> الموقع مفعّل
              </Badge>
            )}
            <Button variant="ghost" className="text-destructive" onClick={logout}>
              <LogOut className="h-4 w-4 ml-2" />خروج
            </Button>
          </div>
        </div>

        {locationGranted === false && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-3 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-sm text-destructive">تفعيل الموقع مطلوب!</p>
                <p className="text-xs text-muted-foreground">اضغط "سماح" في نافذة المتصفح لتفعيل الموقع. لن تتمكن من العمل بدون تفعيل GPS.</p>
              </div>
              <Button size="sm" variant="destructive" onClick={requestLocation} className="shrink-0">
                <MapPin className="h-3 w-3 ml-1" />إعادة المحاولة
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="bg-card border-border">
          <CardContent className="p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">إجمالي الأوردرات: {orders.length}</span>
              <span className="font-bold text-lg">{totalPrice} ج.م</span>
            </div>
            {(() => {
              const deliveredTotal = orders
                .filter(o => o.order_statuses?.name === 'تم التسليم')
                .reduce((sum, o) => sum + Number(o.price) + Number(o.delivery_price), 0);
              const partialTotal = orders
                .filter(o => o.order_statuses?.name === 'تسليم جزئي')
                .reduce((sum, o) => sum + Number(o.partial_amount || 0), 0);
              const rejectShipTotal = orders
                .filter(o => ['رفض ودفع شحن', 'استلم ودفع نص الشحن'].includes(o.order_statuses?.name))
                .reduce((sum, o) => sum + Number(o.shipping_paid || 0), 0);
              const totalCollection = deliveredTotal + partialTotal + rejectShipTotal;
              return (
                <div className="flex justify-between items-center border-t border-border pt-2">
                  <span className="text-sm font-medium text-emerald-600">إجمالي التحصيل</span>
                  <span className="font-bold text-lg text-emerald-600">{totalCollection} ج.م</span>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو الهاتف أو الكود..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 bg-secondary border-border" />
          </div>
          <BarcodeScanner onScan={(barcode) => { setSearch(barcode); const found = orders.find(o => o.barcode === barcode); if (found) openDetails(found); }} />
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="w-10">ترتيب</TableHead>
                    <TableHead className="text-right">الكود</TableHead>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-right">العنوان</TableHead>
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">تفاصيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const filtered = orders.filter(o => {
                      if (!search) return true;
                      const s = search.toLowerCase();
                      return o.customer_name?.toLowerCase().includes(s) ||
                        o.customer_phone?.includes(search) ||
                        o.customer_code?.includes(search) ||
                        o.barcode?.includes(search) ||
                        o.address?.toLowerCase().includes(s);
                    });
                    return filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد أوردرات</TableCell></TableRow>
                  ) : filtered.map((order, idx) => (
                    <TableRow key={order.id} className="border-border">
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {idx > 0 && <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveOrder(idx, -1)}>↑</Button>}
                          {idx < orders.length - 1 && <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveOrder(idx, 1)}>↓</Button>}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {order.customer_code || '-'}
                        {order.priority === 'urgent' && <Badge variant="destructive" className="mr-1 text-xs">عاجل</Badge>}
                        {order.priority === 'vip' && <Badge className="mr-1 text-xs bg-amber-500">VIP</Badge>}
                      </TableCell>
                      <TableCell className="text-sm">{order.customer_name}</TableCell>
                      <TableCell className="text-sm truncate max-w-[120px]">{order.address || '-'}</TableCell>
                      <TableCell className="text-sm">{order.product_name}</TableCell>
                      <TableCell className="font-bold text-sm">{Number(order.price) + Number(order.delivery_price)} ج.م</TableCell>
                      <TableCell>
                        <Select value={order.status_id || ''} onValueChange={(v) => updateStatus(order.id, v)}>
                          <SelectTrigger className="w-32 sm:w-36 bg-secondary border-border text-xs"><SelectValue placeholder="الحالة" /></SelectTrigger>
                          <SelectContent>
                            {statuses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => openDetails(order)}><Eye className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ));
                  })()}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!shippingDialog} onOpenChange={v => { if (!v) setShippingDialog(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {shippingDialog?.type === 'half_ship' ? 'استلم ودفع نص الشحن' : 'رفض ودفع شحن'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="number"
              value={shippingAmount}
              onChange={e => setShippingAmount(e.target.value)}
              placeholder="اكتب مبلغ الشحن المحصل"
              className="bg-secondary border-border"
            />
            <Button onClick={confirmShippingPaid} className="w-full">تأكيد</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!partialDialog} onOpenChange={v => { if (!v) setPartialDialog(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>تسليم جزئي - أدخل المبلغ المحصل</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">سعر الأوردر: {partialDialog?.order?.price || 0} ج.م</p>
            <Input type="number" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder="المبلغ المحصل" className="bg-secondary border-border" />
            {partialAmount && (
              <p className="text-sm">المرتجع الجزئي: <strong className="text-destructive">{Number(partialDialog?.order?.price || 0) - (parseFloat(partialAmount) || 0)} ج.م</strong></p>
            )}
            <Button onClick={confirmPartialDelivery} className="w-full">تأكيد</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedOrder} onOpenChange={(v) => { if (!v) setSelectedOrder(null); }}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>تفاصيل الأوردر - {selectedOrder?.tracking_id}</DialogTitle></DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">العميل:</span> <strong>{selectedOrder.customer_name}</strong></div>
                <div><span className="text-muted-foreground">الهاتف:</span> <strong dir="ltr">{selectedOrder.customer_phone}</strong></div>
                <div><span className="text-muted-foreground">الكود:</span> <strong>{selectedOrder.customer_code || '-'}</strong></div>
                <div><span className="text-muted-foreground">المنتج:</span> <strong>{selectedOrder.product_name}</strong></div>
                <div><span className="text-muted-foreground">الكمية:</span> <strong>{selectedOrder.quantity}</strong></div>
                <div><span className="text-muted-foreground">المكتب:</span> <strong>{selectedOrder.offices?.name || '-'}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">العنوان:</span> <strong>{selectedOrder.address || '-'}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">الإجمالي:</span> <strong className="text-lg">{Number(selectedOrder.price) + Number(selectedOrder.delivery_price)} ج.م</strong></div>
                <div><span className="text-muted-foreground">اللون:</span> <strong>{selectedOrder.color || '-'}</strong></div>
                <div><span className="text-muted-foreground">المقاس:</span> <strong>{selectedOrder.size || '-'}</strong></div>
                {selectedOrder.notes && <div className="col-span-2"><span className="text-muted-foreground">ملاحظات:</span> <strong>{selectedOrder.notes}</strong></div>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" asChild>
                  <a href={`tel:${selectedOrder.customer_phone}`}><Phone className="h-4 w-4 ml-1" />اتصال</a>
                </Button>
                <Button size="sm" variant="outline" className="flex-1" asChild>
                  <a href={`sms:${selectedOrder.customer_phone}`}><MessageSquare className="h-4 w-4 ml-1" />رسالة</a>
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-emerald-500" asChild>
                  <a href={`https://wa.me/${selectedOrder.customer_phone?.replace(/^0/, '20')}`} target="_blank" rel="noopener noreferrer"><Send className="h-4 w-4 ml-1" />واتساب</a>
                </Button>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">الملاحظات</h3>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {notes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">لا توجد ملاحظات</p>
                  ) : notes.map(n => (
                    <div key={n.id} className="p-2 bg-secondary rounded text-sm">
                      <p>{n.note}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString('ar-EG')}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="أضف ملاحظة..." className="bg-secondary border-border" />
                  <Button size="sm" onClick={addNote} disabled={savingNote || !noteText.trim()}>إضافة</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Floating Chat Button */}
      {!showChat && (
        <button
          onClick={() => setShowChat(true)}
          className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-[hsl(142,70%,28%)] text-white shadow-lg hover:bg-[hsl(142,70%,22%)] transition-all flex items-center justify-center"
        >
          <MessageSquare className="h-6 w-6" />
          {chatContacts.reduce((s, c) => s + (c.unread || 0), 0) > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {chatContacts.reduce((s: number, c: any) => s + (c.unread || 0), 0)}
            </span>
          )}
        </button>
      )}

      {/* Chat Panel - WhatsApp Style */}
      {showChat && (
        <div className="fixed bottom-6 left-6 z-50 w-[340px] sm:w-[380px] h-[480px] rounded-2xl overflow-hidden shadow-2xl border border-border flex flex-col bg-card">
          {/* Header */}
          <div className="bg-[hsl(142,70%,28%)] text-white p-3 flex items-center justify-between shrink-0">
            {chatTarget ? (
              <div className="flex items-center gap-2">
                <button onClick={() => setChatTarget(null)} className="hover:bg-white/20 rounded p-1">←</button>
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                  {chatContacts.find(c => c.id === chatTarget)?.name?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold">{chatContacts.find(c => c.id === chatTarget)?.name}</p>
                  <p className="text-[10px] opacity-80">{chatContacts.find(c => c.id === chatTarget)?.role}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                <span className="font-bold text-sm">الدردشة مع الإدارة</span>
              </div>
            )}
            <button onClick={() => { setShowChat(false); setChatTarget(null); }} className="hover:bg-white/20 rounded p-1.5">
              ✕
            </button>
          </div>

          {!chatTarget ? (
            /* Contact list */
            <div className="flex-1 overflow-y-auto">
              {chatContacts.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-12">لا يوجد جهات اتصال</p>
              )}
              {chatContacts.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => setChatTarget(c.id)}
                  className={`w-full p-3 flex items-center gap-3 text-right hover:bg-accent/40 transition-colors ${i < chatContacts.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <div className="w-10 h-10 rounded-full bg-[hsl(142,70%,28%)]/10 flex items-center justify-center shrink-0 text-[hsl(142,70%,28%)] font-bold">
                    {c.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{c.name}</span>
                      {c.unread > 0 && (
                        <span className="bg-[hsl(142,70%,28%)] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{c.unread}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{c.role}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <>
              {/* Messages */}
              <div
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto p-3 space-y-1"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}
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
                      <div className={`relative max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                        isMine
                          ? 'bg-[hsl(142,60%,85%)] text-[hsl(142,70%,15%)] rounded-tl-none'
                          : 'bg-card text-card-foreground rounded-tr-none border border-border'
                      }`}>
                        <p className="leading-relaxed">{m.message}</p>
                        <div className={`flex items-center gap-1 mt-0.5 text-[10px] opacity-50 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <span>{new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMine && (m.is_read
                            ? <span className="text-[hsl(217,91%,60%)]">✓✓</span>
                            : <span>✓</span>
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
                  value={chatMsg}
                  onChange={e => setChatMsg(e.target.value)}
                  placeholder="اكتب رسالة..."
                  className="bg-card text-sm h-9 rounded-full border-border"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMsg(); } }}
                />
                <button
                  onClick={sendChatMsg}
                  disabled={chatSending || !chatMsg.trim()}
                  className="h-9 w-9 shrink-0 rounded-full bg-[hsl(142,70%,28%)] hover:bg-[hsl(142,70%,22%)] text-white flex items-center justify-center disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
