import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function ActivityLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      const [logsRes, profilesRes] = await Promise.all([
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('profiles').select('id, full_name'),
      ]);

      if (logsRes.error) {
        console.error('Failed loading activity logs:', logsRes.error);
        setLogs([]);
        return;
      }

      setLogs(logsRes.data || []);
      const map: Record<string, string> = {};
      (profilesRes.data || []).forEach(p => { map[p.id] = p.full_name; });
      setProfiles(map);
    };
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">سجل الحركات</h1>
      <p className="text-sm text-muted-foreground">يعرض آخر 200 حركة - يتم حذف السجلات تلقائياً بعد 7 أيام</p>
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-right">المستخدم</TableHead>
                  <TableHead className="text-right">الإجراء</TableHead>
                  <TableHead className="text-right">التفاصيل</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">لا توجد سجلات بعد</TableCell></TableRow>
                ) : logs.map((l) => (
                  <TableRow key={l.id} className="border-border">
                    <TableCell className="text-sm font-medium">{l.user_id ? (profiles[l.user_id] || 'مجهول') : '-'}</TableCell>
                    <TableCell className="font-medium text-sm">{l.action}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {typeof l.details === 'object' ? JSON.stringify(l.details) : l.details}
                    </TableCell>
                    <TableCell className="text-sm">{new Date(l.created_at).toLocaleString('ar-EG')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
