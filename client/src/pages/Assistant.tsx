/*
 * ASSISTANT -- Swiss Precision Design
 * Clean chat interface, monospace labels, flat surfaces, no emoji.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { PageTransition, StaggerContainer } from '@/components/PageTransition';
import { Header } from '@/components/Header';
import { useStore } from '@/lib/store';
import { marketMetrics, aiWelcomeMessage, aiSampleResponses } from '@/lib/mockData';
import { SendSolid } from 'iconoir-react';
import { Input } from '@/components/ui/input';
import { TokenLogo } from '@/components/TokenLogo';
import { MiniSparkline, generateSparklineData } from '@/components/MiniSparkline';
import { formatPrice, formatPercent, formatCompact } from '@/lib/format';
import { toast } from 'sonner';

interface ChatMessage {
  id: number;
  role: 'assistant' | 'user';
  content: string;
  timestamp: number;
}

const suggestedPrompts = [
  { label: 'SENTIMENT', query: 'What is the current sentiment for this token?', desc: 'Social signals, community mood, market psychology' },
  { label: 'HOLDERS', query: 'Show me the holder distribution and whale activity', desc: 'Top holders, whale movements, concentration risk' },
  { label: 'VOLUME', query: 'Analyze the trading volume and buy/sell ratio', desc: 'Volume trends, buy pressure, liquidity depth' },
  { label: 'RISK', query: 'What are the risks of trading this token?', desc: 'Rug pull indicators, contract risks, red flags' },
  { label: 'PRICE', query: 'What is the short-term price outlook?', desc: 'Technical analysis, support/resistance, momentum' },
  { label: 'SMART MONEY', query: 'Are smart money wallets accumulating this token?', desc: 'Institutional flows, insider activity, alpha signals' },
];

const capabilities = [
  { title: 'ON-CHAIN ANALYSIS', desc: 'Real-time blockchain data parsing and pattern recognition' },
  { title: 'TECHNICAL ANALYSIS', desc: 'Chart patterns, indicators, and trend identification' },
  { title: 'WHALE TRACKING', desc: 'Monitor large wallet movements and smart money flows' },
  { title: 'RISK SCORING', desc: 'Contract audits, liquidity analysis, and rug detection' },
];

export default function Assistant() {
  const { selectedToken } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, role: 'assistant', content: aiWelcomeMessage, timestamp: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const tokenSparkline = useMemo(
    () => generateSparklineData(selectedToken?.address ?? 'default', 30),
    [selectedToken?.address]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const msg = text ?? input;
    if (!msg.trim()) return;
    if (!selectedToken) {
      toast.error('No Token Selected', { description: 'Please select a token first.' });
      return;
    }

    const userMsg: ChatMessage = { id: Date.now(), role: 'user', content: msg, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));

    const lower = msg.toLowerCase();
    let response = aiSampleResponses.default;
    if (lower.includes('sentiment') || lower.includes('social')) response = aiSampleResponses.sentiment;
    else if (lower.includes('holder') || lower.includes('distribution') || lower.includes('whale')) response = aiSampleResponses.holders;
    else if (lower.includes('volume') || lower.includes('vol') || lower.includes('ratio')) response = aiSampleResponses.volume;

    setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: response, timestamp: Date.now() }]);
    setIsTyping(false);
  };

  const showSuggestions = messages.length <= 2 && !isTyping;

  return (
    <div className="h-screen-safe w-full flex flex-col overflow-hidden bg-background">
      <Header />
      <PageTransition className="flex-1 flex overflow-hidden relative">
        {/* == CHAT == */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="px-4 sm:px-6 py-3 border-b border-border shrink-0 flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 border border-primary/30 flex items-center justify-center shrink-0">
                  <span className="font-mono text-[8px] font-bold text-primary">0x</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-foreground">ASSISTANT</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                  </div>
                  <span className="font-mono text-[9px] text-muted-foreground/50">
                    On-chain analysis
                    {selectedToken && <> / <span className="text-primary">{selectedToken.symbol}</span></>}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="lg:hidden font-mono text-[9px] tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground px-2 py-1 border border-transparent hover:border-border transition-all"
              >
                {showSidebar ? 'CHAT' : 'CONTEXT'}
              </button>
              <button
                onClick={() => {
                  setMessages([{ id: 1, role: 'assistant', content: aiWelcomeMessage, timestamp: Date.now() }]);
                  toast.info('Chat cleared');
                }}
                className="font-mono text-[9px] tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground px-2 py-1 border border-transparent hover:border-border transition-all"
              >
                CLEAR
              </button>
            </div>
          </div>

          {/* Mobile sidebar overlay */}
          {showSidebar && (
            <div className="lg:hidden flex-1 overflow-auto">
              <SidebarContent selectedToken={selectedToken} tokenSparkline={tokenSparkline} />
            </div>
          )}

          {/* Messages */}
          <div className={`flex-1 overflow-auto px-4 sm:px-6 py-4 space-y-4 ${showSidebar ? 'hidden lg:block' : ''}`}>
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-6 h-6 shrink-0 flex items-center justify-center font-mono text-[8px] font-bold border ${
                  msg.role === 'assistant' ? 'border-primary/30 text-primary' : 'border-border text-muted-foreground'
                }`}>
                  {msg.role === 'assistant' ? '0x' : 'U'}
                </div>
                <div className={`max-w-[85%] sm:max-w-[70%] px-4 py-3 text-[12px] leading-relaxed border ${
                  msg.role === 'assistant'
                    ? 'border-border/40 bg-card/30 text-foreground'
                    : 'border-primary/15 bg-primary/5 text-foreground'
                }`}>
                  {renderMessageContent(msg.content)}
                  <div className="font-mono text-[8px] text-muted-foreground/45 mt-2">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing */}
            {isTyping && (
              <div className="flex gap-3">
                <div className="w-6 h-6 shrink-0 flex items-center justify-center font-mono text-[8px] font-bold border border-primary/30 text-primary">0x</div>
                <div className="border border-border/40 bg-card/30 px-4 py-3">
                  <div className="flex gap-1.5 items-center">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="font-mono text-[9px] text-muted-foreground/50 ml-1">Analyzing...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Suggestions */}
            {showSuggestions && (
              <div className="pt-4 space-y-8">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">QUERIES</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px border border-border overflow-hidden">
                    {suggestedPrompts.map(p => (
                      <button
                        key={p.label}
                        onClick={() => handleSend(p.query)}
                        className="p-4 text-left bg-card/20 hover:bg-secondary/20 transition-colors border border-border/20 group"
                      >
                        <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-foreground group-hover:text-primary transition-colors mb-1.5">
                          {p.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground/50 leading-relaxed">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">CAPABILITIES</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border border-border overflow-hidden">
                    {capabilities.map(c => (
                      <div key={c.title} className="p-4 border border-border/20 bg-card/20">
                        <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-foreground mb-1.5">{c.title}</div>
                        <div className="text-[9px] text-muted-foreground/40 leading-relaxed">{c.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className={`px-4 sm:px-6 py-3 pb-20 md:py-3 border-t border-border shrink-0 bg-background ${showSidebar ? 'hidden lg:block' : ''}`}>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  placeholder={`Ask about ${selectedToken?.symbol ?? 'any token'}...`}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  className="h-9 bg-transparent border-border font-mono text-[11px] text-foreground placeholder:text-muted-foreground/45"
                />
              </div>
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                className="h-9 w-9 flex items-center justify-center border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all disabled:opacity-30 shrink-0"
              >
                <SendSolid className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="font-mono text-[8px] text-muted-foreground/45">ENTER TO SEND</span>
              <span className="font-mono text-[8px] text-muted-foreground/45">{messages.length - 1} MESSAGES</span>
            </div>
          </div>
        </div>

        {/* == SIDEBAR == */}
        <div className="hidden lg:flex w-[300px] shrink-0 overflow-auto flex-col border-l border-border">
          <SidebarContent selectedToken={selectedToken} tokenSparkline={tokenSparkline} />
        </div>
      </PageTransition>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SIDEBAR                                                            */
/* ------------------------------------------------------------------ */
function SidebarContent({
  selectedToken,
  tokenSparkline,
}: {
  selectedToken: import('@/lib/store').TokenInfo | null;
  tokenSparkline: number[];
}) {
  return (
    <div className="p-4 space-y-6">
      {/* Token context */}
      {selectedToken && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">ACTIVE TOKEN</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="border border-border p-4 space-y-3">
            <div className="flex items-center gap-2.5">
              <TokenLogo symbol={selectedToken.symbol} size={28} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground">{selectedToken.symbol}</span>
                  <span className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground/40">{selectedToken.chain}</span>
                </div>
                <div className="font-mono text-[9px] text-muted-foreground/40 truncate">{selectedToken.name}</div>
              </div>
              <MiniSparkline data={tokenSparkline} width={56} height={24} strokeWidth={1} />
            </div>
            <div className="h-px bg-border" />
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: 'PRICE', v: formatPrice(selectedToken.price) },
                { l: '24H', v: formatPercent(selectedToken.change24h), c: selectedToken.change24h >= 0 ? 'text-success' : 'text-destructive' },
                { l: 'VOLUME', v: formatCompact(selectedToken.volume24h) },
                { l: 'MCAP', v: formatCompact(selectedToken.marketCap) },
                { l: 'LIQUIDITY', v: formatCompact(selectedToken.liquidity) },
              ].map(s => (
                <div key={s.l}>
                  <div className="font-mono text-[8px] tracking-[0.15em] uppercase text-muted-foreground/50">{s.l}</div>
                  <div className={`font-data text-[12px] font-medium mt-0.5 ${s.c || 'text-foreground'}`}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Market overview */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">MARKET</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <StaggerContainer className="space-y-1" staggerDelay={60}>
          {marketMetrics.map((metric, i) => (
            <MetricRow key={i} {...metric} index={i} />
          ))}
        </StaggerContainer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  METRIC ROW                                                         */
/* ------------------------------------------------------------------ */
function MetricRow({
  label, value, change, color, index,
}: {
  label: string; value: string; subLabel: string; change: string;
  color: 'success' | 'destructive' | 'warning'; index: number;
}) {
  const colorMap = { success: 'text-success', destructive: 'text-destructive', warning: 'text-warning' };
  const glowMap = { success: 'var(--success)', destructive: 'var(--destructive)', warning: 'var(--warning)' };
  const sparkData = useMemo(() => generateSparklineData(`metric-${index}`, 15), [index]);

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/20">
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[8px] tracking-[0.15em] uppercase text-muted-foreground/50">{label}</div>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="font-data text-sm font-semibold text-foreground">{value}</span>
          <span className={`font-mono text-[9px] ${colorMap[color]}`}>{change}</span>
        </div>
      </div>
      <MiniSparkline data={sparkData} width={44} height={18} strokeWidth={1} color={glowMap[color]} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MESSAGE RENDERER                                                   */
/* ------------------------------------------------------------------ */
function renderMessageContent(content: string) {
  const parts: (string | React.ReactElement)[] = [];
  const segments = content.split('**');
  segments.forEach((segment, i) => {
    if (i % 2 === 1) {
      parts.push(<strong key={i} className="text-foreground font-semibold">{segment}</strong>);
    } else {
      const lines = segment.split('\n');
      lines.forEach((line, j) => {
        if (j > 0) parts.push(<br key={`br-${i}-${j}`} />);
        if (line.startsWith('- ')) {
          parts.push(
            <span key={`li-${i}-${j}`} className="flex items-start gap-2 ml-1">
              <span className="w-1 h-1 rounded-full bg-primary/50 mt-1.5 shrink-0" />
              <span>{line.slice(2)}</span>
            </span>
          );
        } else {
          parts.push(line);
        }
      });
    }
  });
  return <>{parts}</>;
}
