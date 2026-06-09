export default function LoadingSpinner({ size = 'md' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6';
  return <div className={`${s} border-2 border-indigo-500 border-t-transparent rounded-full animate-spin`} />;
}
