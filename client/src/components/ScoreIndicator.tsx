import { ShieldCheck } from 'iconoir-react';

interface ScoreIndicatorProps {
  score: number;
  maxScore?: number;
}

export function ScoreIndicator({ score, maxScore = 100 }: ScoreIndicatorProps) {
  const percentage = (score / maxScore) * 100;

  let colorClass = 'text-destructive';
  let bgClass = 'bg-destructive/8';
  let borderClass = 'border-destructive/15';

  if (percentage >= 80) {
    colorClass = 'text-success';
    bgClass = 'bg-success/8';
    borderClass = 'border-success/15';
  } else if (percentage >= 60) {
    colorClass = 'text-primary';
    bgClass = 'bg-primary/8';
    borderClass = 'border-primary/15';
  } else if (percentage >= 40) {
    colorClass = 'text-warning';
    bgClass = 'bg-warning/8';
    borderClass = 'border-warning/15';
  }

  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${bgClass} ${borderClass}`}>
      <ShieldCheck className={`w-2.5 h-2.5 ${colorClass}`} />
      <span className={`text-[11px] font-data font-semibold ${colorClass}`}>
        {score}/{maxScore}
      </span>
    </div>
  );
}
