import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { WalletContextProvider } from "./contexts/WalletContext";
import { MobileBottomNav } from './components/MobileBottomNav';

// Critical path -- eagerly loaded (Markets is the landing page)
import Markets from "./pages/Markets";

// Lazy-loaded secondary pages -- only fetched when navigated to
const Terminal = lazy(() => import("./pages/Terminal"));
const Trending = lazy(() => import("./pages/Trending"));
const Assistant = lazy(() => import("./pages/Assistant"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Positions = lazy(() => import("./pages/Positions"));

function PageLoader() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-[11px] text-muted-foreground font-data tracking-wider">LOADING</span>
      </div>
    </div>
  );
}
function isValidTokenRoute(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/assistant" component={Assistant} />
        <Route path="/markets" component={Markets} />
        <Route path="/trending" component={Trending} />
        <Route path="/positions" component={Positions} />
        <Route path="/portfolio" component={Portfolio} />
        <Route path="/404" component={NotFound} />
        <Route path="/terminal/:address" component={Terminal} />
        <Route path="/terminal" component={Terminal} />
        <Route path="/" component={Markets} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <WalletContextProvider>
      <ThemeProvider defaultTheme="0x">
        <TooltipProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
                fontSize: '13px',
              },
            }}
          />
          <Router />
          <MobileBottomNav />
        </TooltipProvider>
      </ThemeProvider>
      </WalletContextProvider>
    </ErrorBoundary>
  );
}

export default App;
