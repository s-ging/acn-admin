export function UploadIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g opacity="0.3">
        <path d="M36 9V45" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M51 24L36 9L21 24" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M63 45V57C63 58.5913 62.3679 60.1174 61.2426 61.2426C60.1174 62.3679 58.5913 63 57 63H15C13.4087 63 11.8826 62.3679 10.7574 61.2426C9.63214 60.1174 9 58.5913 9 57V45" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </svg>
  )
}
