import { Button } from "@/components/ui/button";
import { WarningCircleSolid, NavArrowLeft } from "iconoir-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="h-screen w-full flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-4">
          <WarningCircleSolid className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="text-[40px] sm:text-[48px] font-data font-bold text-foreground mb-1">404</div>
        <p className="text-[13px] text-muted-foreground mb-6">
          Page not found. This route doesn't exist.
        </p>
        <Button
          onClick={() => setLocation("/")}
          variant="outline"
          size="sm"
          className="text-[12px] gap-1.5 border-border text-foreground hover:bg-secondary"
        >
          <NavArrowLeft className="w-3.5 h-3.5" />
          Back to Terminal
        </Button>
      </div>
    </div>
  );
}
