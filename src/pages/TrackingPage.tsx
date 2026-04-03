import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package, MapPin, Phone, Building2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function TrackingPage() {
  const [trackingId, setTrackingId] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const doTrack = async () => {
    if (!trackingId.trim()) { toast.error('أدخل رقم التتبع أو الباركود'); return; }
    setLoading(true);
    const term = trackingId.trim();
    const { data } = await supabase
      .from('orders')
      .select('*, offices(name)')
      .or(`tracking_id.eq.${term},barcode.eq.${term}`)
      .limit(1)
      .single();

    if (!data) {
      toast.error('لم يتم العثور على الشحنة');
      setOrder(null);
      setLoading(false);
      return;
    }
    setOrder(data);

    if (data.status_id) {
      const { data: st } = await supabase.from('order_statuses').select('*').eq('id', data.status_id).single();
      setStatus(st);
    } else {
      setStatus(null);
    }
    setLoading(false);
  };

  const getStatusIcon = () => {
    if (!status) return <Clock className="h-8 w-8 text-muted-foreground" />;
    const name = status.name || '';
    if (name.includes('تسليم') || name.includes('مسلم')) return <CheckCircle2 className="h-8 w-8 text-success" />;
    if (name.includes('مرتجع') || name.includes('رفض')) return <XCircle className="h-8 w-8 text-destructive" />;
    return <Clock className="h-8 w-8 text-warning" />;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">تتبع الشحنات</h1>

      <Card className="bg-card border-border max-w-xl mx-auto">
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground text-center">أدخل رقم التتبع أو الباركود لتتبع شحنتك</p>
          <div className="flex gap-2">
            <Input
              placeholder="رقم التتبع أو الباركود..."
              value={trackingId}
              onChange={e => setTrackingId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doTrack()}
              className="bg-secondary border-border flex-1"
            />
            <Button onClick={doTrack} disabled={loading}>
              <Search className="h-4 w-4 ml-1" />تتبع
            </Button>
          </div>
        </CardContent>
      </Card>

      {order && (
        <Card className="bg-card border-border max-w-xl mx-auto">
          <CardContent className="p-6 space-y-4">
            {/* Status Header */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50">
              {getStatusIcon()}
              <div>
                <p className="text-lg font-bold">{status?.name || 'قيد المعالجة'}</p>
                <p className="text-xs text-muted-foreground">آخر تحديث: {new Date(order.updated_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>

            {/* Order Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Package className="h-4 w-4 text-primary shrink-0" />
                <span className="text-muted-foreground">رقم التتبع:</span>
                <span className="font-mono font-bold">{order.tracking_id}</span>
              </div>
              {order.barcode && (
                <div className="flex items-center gap-3 text-sm">
                  <Package className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">الباركود:</span>
                  <span className="font-mono font-bold">{order.barcode}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-primary shrink-0" />
                <span className="text-muted-foreground">العميل:</span>
                <span className="font-medium">{order.customer_name}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <span className="text-muted-foreground">العنوان:</span>
                <span>{order.address || order.governorate || '-'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-muted-foreground">المكتب:</span>
                <span>{order.offices?.name || '-'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Package className="h-4 w-4 text-primary shrink-0" />
                <span className="text-muted-foreground">المنتج:</span>
                <span>{order.product_name} (×{order.quantity})</span>
              </div>

              <div className="border-t border-border pt-3 mt-3">
                <div className="flex justify-between text-sm">
                  <span>السعر</span><span>{Number(order.price).toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>الشحن</span><span>{Number(order.delivery_price).toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between font-bold text-base mt-1 pt-1 border-t border-border">
                  <span>الإجمالي</span><span className="text-primary">{(Number(order.price) + Number(order.delivery_price)).toLocaleString()} ج.م</span>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="border-t border-border pt-3">
              <p className="text-sm font-bold mb-2">المراحل</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <span>تم إنشاء الطلب - {new Date(order.created_at).toLocaleDateString('ar-EG')}</span>
                </div>
                {order.courier_id && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full bg-warning" />
                    <span>تم التعيين على مندوب</span>
                  </div>
                )}
                {status && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ background: status.color || '#6b7280' }} />
                    <span>{status.name} - {new Date(order.updated_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
