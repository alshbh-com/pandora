import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sectionGuides } from '@/lib/sectionGuides';

const sectionRoutes: Record<string, string> = {
  dashboard: '/',
  orders: '/orders',
  'unassigned-orders': '/unassigned-orders',
  'closed-orders': '/closed-orders',
  search: '/search',
  offices: '/offices',
  'delivery-prices': '/delivery-prices',
  products: '/products',
  customers: '/customers',
  couriers: '/couriers',
  users: '/users',
  'status-management': '/status-management',
  'courier-collections': '/courier-collections',
  'office-accounts': '/office-accounts',
  advances: '/advances',
  'daily-report': '/daily-report',
  'financial-reports': '/financial-reports',
  'office-report': '/office-report',
  'courier-stats': '/courier-stats',
  'courier-tracking': '/courier-tracking',
  'office-stats': '/office-stats',
  'profit-report': '/profit-report',
  tracking: '/tracking',
  print: '/print',
  'order-notes': '/order-notes',
  chat: '/chat',
  'data-export': '/data-export',
  logs: '/logs',
  settings: '/settings',
  trash: '/trash',
  'accounting-system': '/accounting-system',
};

export default function SystemGuide() {
  const navigate = useNavigate();

  const entries = Object.entries(sectionGuides);

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
        <BookOpen className="h-6 w-6 text-primary" />
        شرح السيستم
      </h1>
      <p className="text-muted-foreground text-sm">اضغط على أي قسم عشان تروحله مباشرة، أو اقرأ الشرح هنا.</p>

      <div className="space-y-3">
        {entries.map(([key, guide]) => (
          <Card key={key} className="bg-card border-border hover:border-primary/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h2 className="font-bold text-base text-primary mb-1">📖 {guide.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{guide.description}</p>

                  {guide.steps && (
                    <div className="mt-2">
                      <p className="text-xs font-bold text-primary mb-1">📌 الخطوات:</p>
                      <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-0.5 pr-2">
                        {guide.steps.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                    </div>
                  )}

                  {guide.formulas && (
                    <div className="mt-2">
                      <p className="text-xs font-bold text-primary mb-1">🔢 المعادلات:</p>
                      <div className="space-y-1 pr-2">
                        {guide.formulas.map((f, i) => (
                          <div key={i} className="text-xs bg-secondary rounded p-1.5">
                            <span className="font-medium">{f.label}: </span>
                            <span className="text-muted-foreground font-mono">{f.formula}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {guide.tips && (
                    <div className="mt-2">
                      <p className="text-xs font-bold text-primary mb-1">💡 نصائح:</p>
                      <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5 pr-2">
                        {guide.tips.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                </div>

                {sectionRoutes[key] && (
                  <button
                    onClick={() => navigate(sectionRoutes[key])}
                    className="shrink-0 mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    اذهب للقسم
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
