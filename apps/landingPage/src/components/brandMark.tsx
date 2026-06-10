export function BrandMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M42 5 5 23.5l14.5 4L24 42 42 5Z" fill="currentColor" />
      <path d="m19.5 27.5 13-12.5L24 42l-4.5-14.5Z" fill="currentColor" opacity=".7" />
      <path d="m19.5 27.5 13-12.5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}
