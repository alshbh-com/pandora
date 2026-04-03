import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  trigger?: React.ReactNode;
}

export default function BarcodeScanner({ onScan, trigger }: BarcodeScannerProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'barcode-scanner-container';

  useEffect(() => {
    if (!open) return;
    setError('');
    const timer = setTimeout(() => {
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;
      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.5 },
        (decodedText) => {
          onScan(decodedText);
          try { if (scanner.isScanning) scanner.stop().catch(() => {}); } catch {}
          setOpen(false);
        },
        () => {}
      ).catch((err: any) => {
        setError('فشل فتح الكاميرا: ' + (err?.message || err));
      });
    }, 300);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        try { if (scannerRef.current.isScanning) scannerRef.current.stop().catch(() => {}); } catch {}
        scannerRef.current = null;
      }
    };
  }, [open]);

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Camera className="h-4 w-4 ml-1" />📷 مسح باركود
        </Button>
      )}
      <Dialog open={open} onOpenChange={(v) => { if (!v && scannerRef.current) { try { if (scannerRef.current.isScanning) scannerRef.current.stop().catch(() => {}); } catch {} } setOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>مسح باركود</DialogTitle>
          </DialogHeader>
          <div id={containerId} className="w-full min-h-[250px] rounded-lg overflow-hidden bg-black" />
          {error && <p className="text-destructive text-sm text-center">{error}</p>}
          <Button variant="outline" onClick={() => setOpen(false)}>
            <X className="h-4 w-4 ml-1" />إغلاق
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
