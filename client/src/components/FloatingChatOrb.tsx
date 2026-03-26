import { useState, useRef, useEffect } from 'react';
import { ChatBubbleSolid, XmarkCircleSolid, SendDiagonalSolid, Compress } from 'iconoir-react';
import { Input } from '@/components/ui/input';
import { useStore } from '@/lib/store';
import { aiSampleResponses } from '@/lib/mockData';

interface MiniMessage {
  id: number;
  role: 'assistant' | 'user';
  content: string;
}

export function FloatingChatOrb() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<MiniMessage[]>([
    { id: 1, role: 'assistant', content: "How can I help you trade today?" },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const { selectedToken } = useStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg: MiniMessage = { id: Date.now(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));

    const lowerInput = input.toLowerCase();
    let response = aiSampleResponses.default;
    if (lowerInput.includes('sentiment') || lowerInput.includes('social')) {
      response = aiSampleResponses.sentiment;
    } else if (lowerInput.includes('holder')) {
      response = aiSampleResponses.holders;
    } else if (lowerInput.includes('volume') || lowerInput.includes('vol')) {
      response = aiSampleResponses.volume;
    }

    const shortResponse = response.length > 200 ? response.slice(0, 200) + '...' : response;

    setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: shortResponse }]);
    setIsTyping(false);
  };

  return (
    <div className="fixed bottom-[80px] right-3 sm:bottom-5 sm:right-4 z-30">
      {/* Chat Panel */}
      {isOpen && (
        <div
          className="mb-3 bg-card border border-border rounded shadow-2xl shadow-black/40 flex flex-col overflow-hidden
            w-[min(calc(100vw-2rem),320px)] sm:w-80"
          style={{ height: 'min(380px, calc(100vh - 120px))' }}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <ChatBubbleSolid className="w-3.5 h-3.5 text-primary" />
              <span className="text-[12px] font-semibold text-foreground">Assistant</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
            >
              <Compress className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto px-3 py-2 space-y-2">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded px-2.5 py-1.5 text-[11px] leading-relaxed ${
                  msg.role === 'assistant'
                    ? 'bg-secondary/50 text-foreground border border-border/50'
                    : 'bg-primary/10 text-foreground border border-primary/15'
                }`}>
                  {msg.content.split('**').map((part, i) =>
                    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-secondary/50 rounded px-2.5 py-1.5 border border-border/50">
                  <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2 border-t border-border shrink-0">
            <div className="flex gap-1.5">
              <Input
                placeholder={`Ask about ${selectedToken?.symbol ?? 'tokens'}...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="h-7 bg-secondary border-border text-[11px] text-foreground"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="h-7 w-7 flex items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
              >
                <SendDiagonalSolid className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orb Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ml-auto ${
          isOpen
            ? 'bg-secondary text-foreground shadow-black/30'
            : 'bg-primary text-primary-foreground shadow-primary/30 hover:shadow-primary/50 hover:scale-105'
        }`}
      >
        {isOpen ? <XmarkCircleSolid className="w-4 h-4" /> : <ChatBubbleSolid className="w-4 h-4 sm:w-5 sm:h-5" />}
      </button>
    </div>
  );
}
