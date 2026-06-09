export default function LanguageToggle({ value, onChange }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-600 w-fit">
      {['es', 'en'].map(lang => (
        <button key={lang} onClick={() => onChange(lang)}
          className={`px-4 py-1.5 text-sm font-bold uppercase transition-colors ${value === lang ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
          {lang}
        </button>
      ))}
    </div>
  );
}
