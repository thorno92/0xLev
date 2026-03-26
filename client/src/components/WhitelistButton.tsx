import { useStore } from '@/lib/store';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import type { TokenInfo } from '@/lib/store';
import { useLocation } from 'wouter';

interface WhitelistButtonProps {
  token: TokenInfo;
  compact?: boolean;
}

export function WhitelistButton({ token, compact = false }: WhitelistButtonProps) {
  const walletAddress = useStore((s) => s.walletAddress);
  const walletConnected = useStore((s) => s.walletConnected);
  const setSelectedToken = useStore((s) => s.setSelectedToken);
  const [, navigate] = useLocation();

  const enabled = !!walletAddress && walletConnected;

  const { data: wlStatus } = trpc.leverage.checkWhitelist.useQuery(
    { walletAddress: walletAddress!, contractAddress: token.address },
    { enabled, retry: 1, staleTime: 60_000 },
  );

  const requestMutation = trpc.leverage.requestWhitelist.useMutation({
    onSuccess: (result) => {
      toast.success(result.alreadyWhitelisted ? 'Already whitelisted' : 'Whitelist requested');
    },
    onError: (err) => toast.error(err.message || 'Failed'),
  });

  // Explicit disconnected guard — hooks are all above so React rules are satisfied
  if (!walletConnected || !walletAddress) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          toast.info('Connect your wallet to request whitelist');
        }}
        className={`font-semibold rounded transition-all duration-100 bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15 btn-hover ${
          compact ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1'
        }`}
      >
        Whitelist
      </button>
    );
  }

  // If whitelisted → show "Trade" button that navigates to terminal
  if (wlStatus?.whitelisted) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setSelectedToken(token);
          navigate(`/terminal/${token.address}`);
        }}
        className={`font-semibold rounded transition-all duration-100 bg-success/10 text-success border border-success/20 hover:bg-success/15 btn-hover ${
          compact ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1'
        }`}
      >
        Trade
      </button>
    );
  }

  // If request was just submitted → greyed out "Pending"
  if (requestMutation.isSuccess) {
    return (
      <button
        disabled
        className={`font-semibold rounded bg-secondary text-muted-foreground/50 border border-border cursor-not-allowed ${
          compact ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1'
        }`}
      >
        Pending
      </button>
    );
  }

  // Default → "Whitelist" request button
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!walletAddress) {
          toast.info('Connect your wallet to request whitelist');
          return;
        }
        requestMutation.mutate({ walletAddress, contractAddress: token.address });
      }}
      disabled={requestMutation.isPending}
      className={`font-semibold rounded transition-all duration-100 bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15 disabled:opacity-50 btn-hover ${
        compact ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1'
      }`}
    >
      {requestMutation.isPending ? (
        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
      ) : (
        'Whitelist'
      )}
    </button>
  );
}
