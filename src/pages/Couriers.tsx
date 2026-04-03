import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Eye, Lock, StickyNote, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/lib/activityLogger';

export default function Couriers() {
  const { user } = useAuth();
  const [couriers, setCouriers] = useState<any[]>([]);
  const [selectedCourier, setSelectedCourier] = useState<string>('');
  const [courierOrders, setCourierOrders] = useState<any[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [notesDialog, setNotesDialog] = useState<any | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [noteText, setNoteText] = useState('');
  const [editDialog, setEditDialog] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', address: '', coverage_areas: '', notes: '' });

  useEffect(() => { loadCouriers(); }, []);

  const loadCouriers = async () => {
    const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'courier');
    if (roles && roles.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', roles.map(r => r.user_id));
      setCouriers(profiles || []);
    }
  };

  useEffect(() => { if (selectedCourier) loadCourierOrders(); }, [selectedCourier]);

  const loadCourierOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_statuses(name, color), offices(name)')
      .eq('courier_id', selectedCourier)
      .eq('is_courier_closed', false)
      .order('created_at', { ascending: false });
    setCourierOrders(data || []);
    setSelectedOrders(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedOrders(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selectedOrders.size === courierOrders.length) setSelectedOrders(new Set());
    else setSelectedOrders(new Set(courierOrders.map(o => o.id)));
  };
  const closeSelected = async () => {
    if (selectedOrders.size === 0) return;
    if (!confirm(`تقفيل ${selectedOrders.size} أوردر؟`)) return;
    await supabase.from('orders').update({ is_courier_closed: true }).in('id', Array.from(selectedOrders));
    toast.success(`تم تقفيل ${selectedOrders.size} أوردر`);
    loadCourierOrders();
  };

  const viewNotes = async (order: any) => {
    setNotesDialog(order);
    const { data } = await supabase.from('order_notes').select('*').eq('order_id', order.id).order('created_at', { ascending: false });
    setNotes(data || []);
  };
  const addNote = async () => {
    if (!noteText.trim() || !notesDialog) return;
    await supabase.from('order_notes').insert({ order_id: notesDialog.id, user_id: user?.id || '', note: noteText.trim() });
    setNoteText('');
    const { data } = await supabase.from('order_notes').select('*').eq('order_id', notesDialog.id).order('created_at', { ascending: false });
    setNotes(data || []);
    toast.success('تم إضافة الملاحظة');
  };

  const openEditCourier = (c: any) => {
    setEditDialog(c);
    setEditForm({ full_name: c.full_name || '', phone: c.phone || '', address: c.address || '', coverage_areas: c.coverage_areas || '', notes: c.notes || '' });
  };
  const saveEditCourier = async () => {
    if (!editDialog) return;
    await supabase.from('profiles').update(editForm).eq('id', editDialog.id);
    logActivity('تعديل بيانات مندوب', { courier_id: editDialog.id, name: editForm.full_name });
    toast.success('تم التعديل');
    setEditDialog(null);
    loadCouriers();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">المندوبين</h1>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">العنوان</TableHead>
                <TableHead className="text-right">مناطق التغطية</TableHead>
                <TableHead className="text-right">ملاحظات</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {couriers.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا يوجد مندوبين</TableCell></TableRow>
              ) : couriers.map(c => (
                <TableRow key={c.id} className={`border-border ${selectedCourier === c.id ? 'bg-secondary' : ''}`}>
                  <TableCell className="font-medium">{c.full_name}</TableCell>
                  <TableCell dir="ltr">{c.phone || '-'}</TableCell>
                  <TableCell>{c.address || '-'}</TableCell>
                  <TableCell className="max-w-32 truncate">{c.coverage_areas || '-'}</TableCell>
                  <TableCell className="max-w-32 truncate">{c.notes || '-'}</TableCell>
                  <TableCell><Badge variant={c.is_active ? 'default' : 'secondary'}>{c.is_active ? 'نشط' : 'غير نشط'}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant={selectedCourier === c.id ? 'default' : 'outline'} onClick={() => setSelectedCourier(c.id)}>
                        <Eye className="h-4 w-4 ml-1" />أوردرات
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEditCourier(c)}><Pencil className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedCourier && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">أوردرات المندوب</h2>
            {selectedOrders.size > 0 && (
              <Button size="sm" variant="destructive" onClick={closeSelected}>
                <Lock className="h-4 w-4 ml-1" />تقفيل {selectedOrders.size} أوردر
              </Button>
            )}
          </div>
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="w-10"><Checkbox checked={courierOrders.length > 0 && selectedOrders.size === courierOrders.length} onCheckedChange={toggleAll} /></TableHead>
                      <TableHead className="text-right">Tracking</TableHead>
                      <TableHead className="text-right">الكود</TableHead>
                      <TableHead className="text-right">العميل</TableHead>
                      <TableHead className="text-right">المنتج</TableHead>
                      <TableHead className="text-right">الإجمالي</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">ملاحظات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courierOrders.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد أوردرات</TableCell></TableRow>
                    ) : courierOrders.map(order => (
                      <TableRow key={order.id} className="border-border">
                        <TableCell><Checkbox checked={selectedOrders.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} /></TableCell>
                        <TableCell className="font-mono text-xs">{order.tracking_id}</TableCell>
                        <TableCell className="font-mono text-xs">{order.customer_code || '-'}</TableCell>
                        <TableCell>{order.customer_name}</TableCell>
                        <TableCell>{order.product_name}</TableCell>
                        <TableCell className="font-bold">{Number(order.price) + Number(order.delivery_price)} ج.م</TableCell>
                        <TableCell>
                          <Badge style={{ backgroundColor: order.order_statuses?.color || undefined }} className="text-xs">
                            {order.order_statuses?.name || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => viewNotes(order)}><StickyNote className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={!!editDialog} onOpenChange={v => { if (!v) setEditDialog(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>تعديل بيانات المندوب</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>الاسم</Label><Input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} className="bg-secondary border-border" /></div>
            <div className="space-y-2"><Label>الهاتف</Label><Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="bg-secondary border-border" dir="ltr" /></div>
            <div className="space-y-2"><Label>العنوان</Label><Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} className="bg-secondary border-border" /></div>
            <div className="space-y-2"><Label>مناطق التغطية</Label><Input value={editForm.coverage_areas} onChange={e => setEditForm(f => ({ ...f, coverage_areas: e.target.value }))} className="bg-secondary border-border" placeholder="مثال: المعادي، حلوان، التجمع" /></div>
            <div className="space-y-2"><Label>ملاحظات</Label><Textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className="bg-secondary border-border" rows={2} /></div>
            <Button onClick={saveEditCourier} className="w-full">حفظ التعديل</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!notesDialog} onOpenChange={(v) => { if (!v) { setNotesDialog(null); setNoteText(''); } }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>ملاحظات - {notesDialog?.tracking_id}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد ملاحظات</p>
            ) : notes.map(n => (
              <div key={n.id} className="p-2 bg-secondary rounded text-sm">
                <p>{n.note}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString('ar-EG')}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="أضف ملاحظة..." className="bg-secondary border-border" />
            <Button size="sm" onClick={addNote} disabled={!noteText.trim()}>إضافة</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
