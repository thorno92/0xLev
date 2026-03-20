import { useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldLoading } from 'iconoir-react';
import { toast } from 'sonner';

type WlStatus = 'unknown' | 'pending' | 'whitelisted' | 'not_whitelisted';

export function WhitelistStatus() {
  const [status, setStatus] = useState<WlStatus>('not_whitelisted');
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequest = async () => {
    setIsRequesting(true);
    await new Promise((r) => setTimeout(r, 1500));
    setStatus('pending');
    setIsRequesting(false);
    toast.success('Whitelist request submitted');
  };

  if (status === 'whitelisted') {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-success">
        <ShieldCheck className="w-3 h-3" />
        <span>Whitelisted</span>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-warning">
        <ShieldLoading className="w-3 h-3" />
        <span>Whitelist pending</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldAlert className="w-3 h-3" />
        <span>Not whitelisted</span>
      </div>
      <button
        onClick={handleRequest}
        disabled={isRequesting}
        className="text-[11px] text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
      >
        {isRequesting ? (
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
        ) : (
          'Request Access'
        )}
      </button>
    </div>
  );
}
