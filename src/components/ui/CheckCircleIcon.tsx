interface CheckCircleIconProps {
  size?: number
}

export function CheckCircleIcon({ size = 64 }: CheckCircleIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1.5" y="1.5" width="69" height="69" rx="34.5" stroke="currentColor" strokeWidth="3" />
      <path d="M52 24L30 46L20 36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
