import React, { useState } from 'react';
import { X, Check, AlertTriangle, Delete } from 'lucide-react';

const CalculatorModal = ({ isOpen, onClose, onApply, currentValue }) => {
    const [input, setInput] = useState('');
    const [mode, setMode] = useState('subtract'); // 'subtract' (Damage) or 'add' (Life)
    const [warning, setWarning] = useState(null);

    if (!isOpen) return null;

    const handleNumberParams = (num) => {
        if (input.length > 3) return; // Cap length
        setInput(prev => prev + num);
        setWarning(null); // Clear warning on edit
    };

    const handleBackspace = () => {
        setInput(prev => prev.slice(0, -1));
        setWarning(null);
    };

    const handleSubmit = () => {
        const val = parseInt(input, 10);
        if (!val || isNaN(val)) {
            onClose();
            return;
        }

        // Warning Logic
        if (!warning && val >= 10) {
            setWarning(`Large change detected (${val}). Confirm?`);
            return;
        }

        const signedVal = mode === 'subtract' ? -val : val;
        onApply(signedVal);
        setInput('');
        setWarning(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center pointer-events-none">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="bg-gray-900 border-t md:border border-gray-700 w-full md:w-[400px] md:rounded-2xl shadow-2xl overflow-hidden pointer-events-auto animate-slide-up md:animate-zoom-in p-6 z-10">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-white uppercase tracking-wider">Quick Math</h3>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Display */}
                <div className="bg-black/40 rounded-xl p-4 mb-6 border border-white/5 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 font-bold uppercase">Current Life</span>
                        <span className="text-2xl font-mono text-gray-300">{currentValue}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`text-4xl font-mono font-black ${mode === 'subtract' ? 'text-red-500' : 'text-green-500'}`}>
                            {mode === 'subtract' ? '-' : '+'}{input || '0'}
                        </div>
                        <span className="text-xs text-gray-500 font-bold uppercase self-end mb-1">
                            = {currentValue + (parseInt(input || 0) * (mode === 'subtract' ? -1 : 1))}
                        </span>
                    </div>
                </div>

                {/* Warning Message */}
                {warning && (
                    <div className="bg-yellow-500/10 text-yellow-500 p-3 rounded-lg border border-yellow-500/20 mb-4 flex items-center justify-center gap-2 animate-pulse">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-bold">{warning}</span>
                    </div>
                )}

                {/* Mode Toggles */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                        onClick={() => setMode('subtract')}
                        className={`py-3 rounded-lg font-bold uppercase tracking-widest transition-all ${mode === 'subtract' ? 'bg-red-500 text-white shadow-lg shadow-red-900/50' : 'bg-gray-800 text-gray-500'}`}
                    >
                        Damage
                    </button>
                    <button
                        onClick={() => setMode('add')}
                        className={`py-3 rounded-lg font-bold uppercase tracking-widest transition-all ${mode === 'add' ? 'bg-green-500 text-white shadow-lg shadow-green-900/50' : 'bg-gray-800 text-gray-500'}`}
                    >
                        Life
                    </button>
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button
                            key={num}
                            onClick={() => handleNumberParams(num)}
                            className="bg-gray-800 hover:bg-gray-700 text-white text-2xl font-bold py-4 rounded-xl transition-colors active:scale-95"
                        >
                            {num}
                        </button>
                    ))}
                    <button
                        onClick={() => handleNumberParams(0)}
                        className="bg-gray-800 hover:bg-gray-700 text-white text-2xl font-bold py-4 rounded-xl transition-colors active:scale-95"
                    >
                        0
                    </button>
                    <button
                        onClick={handleBackspace}
                        className="bg-gray-800 hover:bg-red-900/30 text-gray-400 hover:text-red-400 text-xl font-bold py-4 rounded-xl transition-colors active:scale-95 flex items-center justify-center"
                    >
                        <Delete className="w-6 h-6" />
                    </button>
                    <button
                        onClick={handleSubmit}
                        className={`bg-primary-600 hover:bg-primary-500 text-white text-xl font-bold py-4 rounded-xl transition-colors active:scale-95 flex items-center justify-center ${warning ? 'animate-bounce' : ''}`}
                    >
                        <Check className="w-8 h-8" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CalculatorModal;
