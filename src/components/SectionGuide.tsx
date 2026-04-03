import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SectionGuideProps {
  title: string;
  description: string;
  steps?: string[];
  tips?: string[];
  formulas?: { label: string; formula: string }[];
}

export default function SectionGuide({ title, description, steps, tips, formulas }: SectionGuideProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="bg-primary/5 border-primary/20 mb-4">
      <CardContent className="p-3 sm:p-4">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-2 text-right"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary shrink-0" />
            <span className="font-bold text-sm sm:text-base text-primary">📖 شرح: {title}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </button>

        {open && (
          <div className="mt-3 space-y-3 text-sm text-foreground animate-in slide-in-from-top-2 duration-200">
            <p className="leading-relaxed">{description}</p>

            {steps && steps.length > 0 && (
              <div>
                <p className="font-bold text-primary mb-1">📌 خطوات الاستخدام:</p>
                <ol className="list-decimal list-inside space-y-1 pr-2">
                  {steps.map((s, i) => <li key={i} className="leading-relaxed">{s}</li>)}
                </ol>
              </div>
            )}

            {formulas && formulas.length > 0 && (
              <div>
                <p className="font-bold text-primary mb-1">🔢 المعادلات:</p>
                <div className="space-y-1 pr-2">
                  {formulas.map((f, i) => (
                    <div key={i} className="bg-card rounded-lg p-2 border border-border">
                      <span className="font-medium">{f.label}: </span>
                      <span className="text-muted-foreground font-mono text-xs">{f.formula}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tips && tips.length > 0 && (
              <div>
                <p className="font-bold text-primary mb-1">💡 نصائح:</p>
                <ul className="list-disc list-inside space-y-1 pr-2">
                  {tips.map((t, i) => <li key={i} className="leading-relaxed">{t}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
