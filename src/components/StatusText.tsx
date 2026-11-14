import { CheckCircle2, Clock, AlertTriangle, XCircle, Wrench, ShieldCheck } from 'lucide-react';

export function StatusText({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  if (['completed', 'verified', 'paid', 'approved', 'confirmed', 'resolved'].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        {status}
      </span>
    );
  }

  if (['in progress', 'accepted', 'investigating'].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 whitespace-nowrap">
        <Wrench className="w-3.5 h-3.5 shrink-0" />
        {status}
      </span>
    );
  }

  if (['pending', 'awaiting approval', 'quotation sent', 'pending approval', 'created', 'open'].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        {status}
      </span>
    );
  }

  if (['cancelled', 'rejected', 'failed', 'refunded'].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5 shrink-0" />
        {status}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      {status}
    </span>
  );
}

export function VerifiedBadgeText({ status }: { status: 'pending' | 'verified' | 'rejected' }) {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 whitespace-nowrap">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        Verified Pro
      </span>
    );
  }
  if (status === 'rejected') {
    return <span className="text-xs font-medium text-rose-700 whitespace-nowrap">Verification Declined</span>;
  }
  return <span className="text-xs font-medium text-amber-700 whitespace-nowrap">Verification Pending</span>;
}
