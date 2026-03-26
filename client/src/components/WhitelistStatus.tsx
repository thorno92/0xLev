import { useStore } from '@/lib/store';
import { trpc } from '@/lib/trpc';
import { ShieldCheck, ShieldAlert } from 'iconoir-react';
import { toast } from 'sonner';

export function WhitelistStatus() {
  const walletAddress = useStore((s) => s.walletAddress);
  const walletConnected = useStore((s) => s.walletConnected);
  const selectedToken = useStore((s) => s.selectedToken);

  const enabled = !!walletAddress && walletConnected && !!selectedToken?.address;

  const { data, isLoading } = trpc.leverage.checkWhitelist.useQuery(
    { walletAddress: walletAddress!, contractAddress: selectedToken?.address ?? '' },
    { enabled, retry: 1, staleTime: 60_000 },
  );

  const requestMutation = trpc.leverage.requestWhitelist.useMutation({
    onSuccess: (result) => {
      toast.success(result.alreadyWhitelisted ? 'Token is already whitelisted' : 'Whitelist request submitted');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to request whitelist');
    },
  });

  const handleRequest = () => {
    if (!walletAddress || !selectedToken?.address) return;
    requestMutation.mutate({ walletAddress, contractAddress: selectedToken.address });
  };

  if (!enabled) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
        <span>Checking whitelist...</span>
      </div>
    );
  }

  if (data?.whitelisted) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-success">
        <ShieldCheck className="w-3 h-3" />
        <span>Whitelisted</span>
      </div>
    );
  }

  if (requestMutation.isSuccess && requestMutation.data?.alreadyWhitelisted) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-success">
        <ShieldCheck className="w-3 h-3" />
        <span>Whitelisted</span>
      </div>
    );
  }

  if (requestMutation.isSuccess) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
        <ShieldAlert className="w-3 h-3" />
        <span>Whitelist Pending</span>
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
        disabled={requestMutation.isPending}
        className="text-[11px] text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
      >
        {requestMutation.isPending ? (
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
        ) : (
          'Request Access'
        )}
      </button>
    </div>
  );
}
