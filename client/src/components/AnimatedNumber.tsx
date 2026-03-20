/**
 * AnimatedNumber — smooth digit-by-digit transitions for price/volume displays
 * Uses @number-flow/react (inspired by 21st.dev Number Flow component)
 */

import NumberFlow, { type Format } from '@number-flow/react';
import { type ComponentProps } from 'react';

type NumberFlowProps = ComponentProps<typeof NumberFlow>;

const TIMING = {
  transformTiming: { duration: 500, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  spinTiming: { duration: 500, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  opacityTiming: { duration: 300, easing: 'ease-out' },
} as const;

export function AnimatedNumber({
  value,
  prefix,
  suffix,
  format,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  format?: NumberFlowProps['format'];
  className?: string;
}) {
  return (
    <NumberFlow
      value={value}
      prefix={prefix}
      suffix={suffix}
      format={format}
      className={className}
      {...TIMING}
      willChange
    />
  );
}

/** Price format with $ prefix */
export function AnimatedPrice({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const decimals = value >= 1 ? 2 : value >= 0.01 ? 4 : 6;
  return (
    <NumberFlow
      value={value}
      prefix="$"
      format={{ minimumFractionDigits: decimals, maximumFractionDigits: decimals }}
      className={className}
      {...TIMING}
      willChange
    />
  );
}

/** Percent format with sign */
export function AnimatedPercent({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <NumberFlow
      value={value / 100}
      format={{ style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' }}
      className={className}
      {...TIMING}
      willChange
    />
  );
}
