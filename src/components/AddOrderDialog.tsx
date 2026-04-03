import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';

interface Props {
  onOrderAdded: () => void;
  editOrder?: any;
  onClose?: () => void;
}

export default function AddOrderDialog({ onOrderAdded, editOrder, onClose }: Props) {
  const [open, setOpen] = useState(!!editOrder);
  const [loading, setLoading] = useState(false);
  const [dropdownsLoaded, setDropdownsLoaded] = useState(false);

  const [offices, setOffices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);

  const emptyForm = {
    customer_name: '', customer_phone: '', customer_code: '',
    product_name: '', product_id: '',
    quantity: '', price: '', delivery_price: '',
    office_id: '', status_id: '',
    color: '', size: '', address: '', notes: '',
    priority: 'normal',
  };

  const [form, setForm] = useState(emptyForm);

  const mapOrderToForm = (order: any) => ({
    customer_name: order?.customer_name || '',
    customer_phone: order?.customer_phone || '',
    customer_code: order?.customer_code || '',
    product_name: order?.product_name || '',
    product_id: order?.product_id || '',
    quantity: String(order?.quantity || 1),
    price: String(order?.price || 0),
    delivery_price: String(order?.delivery_price || 0),
    office_id: order?.office_id || '',
    status_id: order?.status_id || '',
    color: order?.color || '',
    size: order?.size || '',
    address: order?.address || '',
    notes: order?.notes || '',
    priority: order?.priority || 'normal',
  });

  useEffect(() => {
    if (!editOrder) return;
    setOpen(true);
    setDropdownsLoaded(false);
    
    // Load dropdowns FIRST, then set form values
    loadDropdowns(editOrder).then(() => {
      setForm(mapOrderToForm(editOrder));
      setDropdownsLoaded(true);
    });
  }, [editOrder]);

  useEffect(() => {
    if (open && !editOrder) {
      loadDropdowns().then(() => setDropdownsLoaded(true));
    }
  }, [open]);

  const loadDropdowns = async (orderForEdit?: any) => {
    const [o, p, s] = await Promise.all([
      supabase.from('offices').select('id, name').order('name'),
      supabase.from('products').select('id, name, quantity').order('name'),
      supabase.from('order_statuses').select('id, name').order('sort_order'),
    ]);

    const loadedOffices = o.data || [];
    const currentOfficeId = orderForEdit?.office_id;

    // Ensure the current office is always in the list
    if (currentOfficeId && !loadedOffices.some((office: any) => office.id === currentOfficeId)) {
      loadedOffices.unshift({
        id: currentOfficeId,
        name: orderForEdit?.offices?.name || 'المكتب الحالي',
      });
    }

    setOffices(loadedOffices);
    setProducts(p.data || []);
    setStatuses(s.data || []);
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId);
    setForm(f => ({ ...f, product_id: productId, product_name: product?.name || '' }));
  };

  const totalCollection = (parseFloat(form.price) || 0) + (parseFloat(form.delivery_price) || 0);

  const handleClose = (v: boolean) => {
    if (!v) { setOpen(false); onClose?.(); }
    else setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      toast.error('اسم العميل ورقم الهاتف مطلوبين');
      return;
    }

    if (!form.office_id) {
      toast.error('اختيار المكتب إجباري');
      return;
    }

    if (form.price === '' || Number(form.price) < 0) {
      toast.error('السعر إجباري');
      return;
    }

    if (form.delivery_price === '' || Number(form.delivery_price) < 0) {
      toast.error('الشحن إجباري');
      return;
    }

    setLoading(true);
    try {
      const qty = parseInt(form.quantity) || 1;
      const price = parseFloat(form.price) || 0;
      const deliveryPrice = parseFloat(form.delivery_price) || 0;

      const orderData: any = {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_code: form.customer_code || null,
        product_name: form.product_name || 'بدون منتج',
        quantity: qty, price, delivery_price: deliveryPrice,
        color: form.color, size: form.size,
        address: form.address,
        notes: form.notes || '',
        priority: form.priority || 'normal',
      };
      orderData.office_id = form.office_id;
      if (form.product_id) orderData.product_id = form.product_id;
      if (form.status_id) orderData.status_id = form.status_id;

      if (editOrder) {
        const { error } = await supabase.from('orders').update(orderData).eq('id', editOrder.id);
        if (error) throw error;
        logActivity('تعديل أوردر', { order_id: editOrder.id, customer: orderData.customer_name });
        toast.success('تم تحديث الأوردر');
      } else {
        const { data: inserted, error } = await supabase.from('orders').insert(orderData).select('barcode').single();
        if (error) throw error;

        if (form.product_id && qty > 0) {
          const product = products.find(p => p.id === form.product_id);
          if (product) {
            await supabase.from('products').update({ quantity: Math.max(0, product.quantity - qty) }).eq('id', form.product_id);
          }
        }
        logActivity('إضافة أوردر جديد', { customer: orderData.customer_name, barcode: inserted?.barcode });
        toast.success('تم إضافة الأوردر بنجاح');
      }

      setForm(emptyForm);
      handleClose(false);
      onOrderAdded();
    } catch (err: any) {
      toast.error(err.message || 'حصل خطأ');
    } finally {
      setLoading(false);
    }
  };

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {!editOrder && (
        <DialogTrigger asChild>
          <Button><Plus className="h-4 w-4 ml-2" />إضافة أوردر</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader><DialogTitle>{editOrder ? 'تعديل الأوردر' : 'إضافة أوردر جديد'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم العميل *</Label>
              <Input required value={form.customer_name} onChange={e => set('customer_name', e.target.value)} className="bg-secondary border-border" placeholder="اسم العميل" />
            </div>
            <div className="space-y-2">
              <Label>رقم الهاتف *</Label>
              <Input required value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} className="bg-secondary border-border" placeholder="01xxxxxxxxx" dir="ltr" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الكود (يدوي - اختياري)</Label>
              <Input value={form.customer_code} onChange={e => set('customer_code', e.target.value)} className="bg-secondary border-border" placeholder="كود المكتب" />
            </div>
            <div className="space-y-2">
              <Label>المكتب *</Label>
              {editOrder && editOrder.offices?.name && (
                <Badge variant="outline" className="mb-1 text-sm font-medium bg-primary/10 text-primary border-primary/30">
                  📍 المكتب الحالي: {editOrder.offices.name}
                </Badge>
              )}
              <Select value={form.office_id} onValueChange={v => set('office_id', v)} disabled={offices.length === 0}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder={offices.length === 0 ? 'جاري التحميل...' : 'اختر مكتب (إجباري)'} /></SelectTrigger>
                <SelectContent>{offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>العنوان</Label>
            <Input value={form.address} onChange={e => set('address', e.target.value)} className="bg-secondary border-border" placeholder="العنوان بالتفصيل" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>المنتج (اختيار من القائمة)</Label>
              <Select value={form.product_id} onValueChange={handleProductSelect}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="اختر منتج" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.quantity} متاح)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>أو اكتب اسم المنتج</Label>
              <Input value={form.product_name} onChange={e => set('product_name', e.target.value)} className="bg-secondary border-border" placeholder="اسم المنتج يدوي" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>الكمية</Label>
              <Input type="number" min={1} value={form.quantity} onChange={e => set('quantity', e.target.value)}
                onFocus={e => { if (e.target.value === '1' || e.target.value === '0') set('quantity', ''); }}
                className="bg-secondary border-border" placeholder="1" />
            </div>
            <div className="space-y-2">
              <Label>السعر (ج.م) *</Label>
              <Input required type="number" min={0} value={form.price} onChange={e => set('price', e.target.value)}
                onFocus={e => { if (e.target.value === '0') set('price', ''); }}
                className="bg-secondary border-border" placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>سعر التوصيل *</Label>
              <Input required type="number" min={0} value={form.delivery_price} onChange={e => set('delivery_price', e.target.value)}
                onFocus={e => { if (e.target.value === '0') set('delivery_price', ''); }}
                className="bg-secondary border-border" placeholder="0" />
            </div>
          </div>

          <div className="p-3 bg-secondary rounded-lg border border-border text-center">
            <span className="text-sm text-muted-foreground">إجمالي التحصيل: </span>
            <span className="text-lg font-bold">{totalCollection} ج.م</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select value={form.status_id} onValueChange={v => set('status_id', v)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="اختر حالة" /></SelectTrigger>
                <SelectContent>{statuses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الأولوية</Label>
              <Select value={form.priority} onValueChange={v => set('priority', v)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">عادي</SelectItem>
                  <SelectItem value="urgent">🔴 عاجل</SelectItem>
                  <SelectItem value="vip">⭐ VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>اللون</Label>
              <Input value={form.color} onChange={e => set('color', e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>المقاس</Label>
            <Input value={form.size} onChange={e => set('size', e.target.value)} className="bg-secondary border-border" />
          </div>

          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="bg-secondary border-border" rows={2} placeholder="أي ملاحظات إضافية..." />
          </div>

          {!editOrder && <p className="text-xs text-muted-foreground">* الباركود يتم توليده تلقائياً (رقمي فقط)</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (editOrder ? 'حفظ التعديلات' : 'إضافة الأوردر')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
