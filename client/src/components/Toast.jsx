export default function Toast({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className={`px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all
          ${t.type === 'error' ? 'bg-red-600 text-white' : t.type === 'success' ? 'bg-green-600 text-white' : 'bg-gray-700 text-white'}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
