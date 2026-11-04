import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

export function BrandWaveformIcon(props: IconProps) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      {...props}
    >
      <rect x="2" y="2" width="20" height="20" stroke="currentColor" fill="none" strokeWidth="1.5" />
      <path d="M4 14h3v-6h4v8h4v-5h5" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <polygon points="4,2 14,8 4,14" />
    </svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="2" width="4" height="12" />
      <rect x="9" y="2" width="4" height="12" />
    </svg>
  );
}

export function StepIcon(props: IconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <polygon points="3,2 10,8 3,14" />
      <rect x="11" y="2" width="2.5" height="12" />
    </svg>
  );
}

export function ResetIcon(props: IconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden="true"
      {...props}
    >
      <path d="M2 3v5h5" />
      <path d="M2.5 8a6 6 0 1 1 1.7 4.2" />
    </svg>
  );
}

export function SaveIcon(props: IconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 2h8l3 3v9H3z" />
      <rect x="5" y="2" width="5" height="4" />
      <rect x="5" y="9" width="6" height="5" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden="true"
      {...props}
    >
      <polyline points="2,8 6,12 14,4" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 8h10" />
      <polyline points="8,3 13,8 8,13" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden="true"
      {...props}
    >
      <path d="M13 8H3" />
      <polyline points="8,3 3,8 8,13" />
    </svg>
  );
}

export function SwapIcon(props: IconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden="true"
      {...props}
    >
      <path d="M14 5H2M5 2L2 5l3 3M2 11h12m-3-3l3 3-3 3" />
    </svg>
  );
}

