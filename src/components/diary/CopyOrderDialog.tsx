import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
  currentDiaryId: string;
  officeId: string;
}

export default function CopyOrderDialog({ open, onOpenChange, orderId, currentDiaryId, officeId }: Props) {
  const qc = useQueryClient();

  // Get existing open diaries for same office
  const { data: diaries = [] } = useQuery({
    queryKey: ['diaries-for-copy', officeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diaries')
        .select('*')
        .eq('office_id', officeId)
        .eq('is_closed', false)
        .eq('is_archived', false)
        .neq('id', currentDiaryId)
        .order('diary_number', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!officeId,
  });

  const copyToExisting = useMutation({
    mutationFn: async (diaryId: string) => {
      const { error } = await supabase
        .from('diary_orders')
        .insert({
          order_id: orderId!,
          diary_id: diaryId,
          copied_from_diary_id: currentDiaryId,
        });
      if (error) throw error;
      await logActivity('نسخ أوردر إلى يومية قائمة', {
        order_id: orderId,
        from_diary: currentDiaryId,
        to_diary: diaryId,
      });
    },
    onSuccess: () => {
      toast.success('تم نسخ الأوردر بنجاح');
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ['diary-orders'] });
    },
    onError: () => toast.error('الأوردر موجود بالفعل في هذه اليومية'),
  });

  const copyToNew = useMutation({
    mutationFn: async () => {
      // Create new diary for same office
      const { data: newDiary, error: diaryErr } = await supabase
        .from('diaries')
        .insert({ office_id: officeId, diary_date: new Date().toISOString().split('T')[0] })
        .select()
        .single();
      if (diaryErr) throw diaryErr;

      // Copy order to new diary
      const { error } = await supabase
        .from('diary_orders')
        .insert({
          order_id: orderId!,
          diary_id: newDiary.id,
          copied_from_diary_id: currentDiaryId,
        });
      if (error) throw error;
      await logActivity('نسخ أوردر إلى يومية جديدة', {
        order_id: orderId,
        from_diary: currentDiaryId,
        new_diary: newDiary.id,
      });
    },
    onSuccess: () => {
      toast.success('تم إنشاء يومية جديدة ونسخ الأوردر');
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ['diary-orders'] });
      qc.invalidateQueries({ queryKey: ['diaries'] });
    },
    onError: () => toast.error('فشل النسخ'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>نسخ إلى يومية أخرى</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Copy to new */}
          <Button
            variant="default"
            className="w-full"
            onClick={() => copyToNew.mutate()}
            disabled={copyToNew.isPending}
          >
            <Plus className="h-4 w-4 ml-1" />
            نسخ إلى يومية جديدة
          </Button>

          {/* Divider */}
          {diaries.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 border-t" />
              <span className="text-xs text-muted-foreground">أو اختر يومية قائمة</span>
              <div className="flex-1 border-t" />
            </div>
          )}

          {/* Copy to existing */}
          <div className="space-y-2 max-h-60 overflow-auto">
            {diaries.length === 0 ? (
              <p className="text-center text-muted-foreground py-2 text-sm">لا توجد يوميات مفتوحة أخرى</p>
            ) : (
              diaries.map((d: any) => (
                <Button
                  key={d.id}
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => copyToExisting.mutate(d.id)}
                  disabled={copyToExisting.isPending}
                >
                  <span>يومية رقم {d.diary_number}</span>
                  <div className="flex items-center gap-2">
                    {d.lock_status_updates && <Badge variant="destructive" className="text-xs">مقفل</Badge>}
                    <span className="text-muted-foreground text-sm">{format(new Date(d.diary_date), 'dd/MM/yyyy')}</span>
                  </div>
                </Button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
