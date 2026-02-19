import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

export default function ThemePicker() {
    const { theme, setTheme, themes } = useTheme();

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                <span className="text-xl">🎨</span>
                Appearance
            </h3>
            <div className="bg-gray-900/50 p-4 rounded-xl border border-white/5">
                <p className="text-sm text-gray-400 mb-4">Select your preferred mana alignment.</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {themes.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTheme(t.id)}
                            className={`relative group flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${theme === t.id
                                ? 'bg-white/10 border-white/20 shadow-lg'
                                : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10'
                                }`}
                        >
                            <div className="transform transition-transform group-hover:scale-110">
                                <i className={`text-4xl ${t.symbol}`} title={t.label}></i>
                            </div>
                            <span className={`text-xs font-bold uppercase tracking-wider ${theme === t.id ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>
                                {t.label}
                            </span>

                            {theme === t.id && (
                                <div className="absolute top-2 right-2 w-2 h-2 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
