import React, { useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { useAuth } from '../../contexts/AuthContext';
import { GeminiService } from '../../services/gemini';
import { useToast } from '../../contexts/ToastContext';

const modules = {
    toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['clean']
    ],
};

const RichTextEditor = ({ value, onChange, placeholder, type = 'General', height = 'h-40' }) => {
    const { userProfile } = useAuth();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);

    const handleMagic = async () => {
        const apiKey = userProfile?.settings?.geminiApiKey;
        if (!apiKey) {
            addToast('AI API Key missing in settings.', 'error');
            return;
        }
        if (!value || value.replace(/<[^>]*>/g, '').trim().length < 5) {
            addToast('Please write a bit more first!', 'warning');
            return;
        }

        setLoading(true);
        try {
            const spruced = await GeminiService.spruceUpText(apiKey, value, type, userProfile);
            onChange(spruced);
            addToast('Spruced up successfully!', 'success');
        } catch (err) {
            console.error(err);
            addToast('AI failed to enhance text.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative">
            <div className="absolute top-2 right-2 z-10">
                <button
                    type="button"
                    onClick={handleMagic}
                    disabled={loading}
                    className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-indigo-600/80 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-full transition-all backdrop-blur-sm disabled:opacity-50 shadow-lg border border-indigo-400/30"
                    title="Spruce up with AI"
                >
                    {loading ? (
                        <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    )}
                    AI Polish
                </button>
            </div>
            <div className={`bg-gray-900 border border-gray-700 rounded-lg overflow-hidden ${height} flex flex-col`}>
                <ReactQuill
                    theme="snow"
                    value={value || ''}
                    onChange={onChange}
                    modules={modules}
                    placeholder={placeholder}
                    className="flex-1 text-white flex flex-col h-full"
                />
            </div>
            {/* Custom Styles to Dark Modeify Quill & Fix Layout */}
            <style>{`
                .quill { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
                .ql-toolbar.ql-snow { border: none !important; border-bottom: 1px solid #374151 !important; background: #111827; flex-shrink: 0; }
                .ql-container.ql-snow { border: none !important; flex: 1; display: flex; flex-direction: column; overflow: hidden; background: transparent; }
                .ql-editor { color: #e5e7eb; flex: 1; overflow-y: auto; font-family: inherit; padding: 1rem; }
                .ql-editor.ql-blank::before { color: #6b7280; font-style: normal; font-style: italic; }
                
                /* Icon/Picker Colors */
                .ql-snow .ql-stroke { stroke: #9ca3af !important; }
                .ql-snow .ql-fill { fill: #9ca3af !important; }
                .ql-snow .ql-picker { color: #9ca3af !important; }
                .ql-snow .ql-picker-options { background-color: #1f2937 !important; border-color: #374151 !important; color: #e5e7eb !important; }
                .ql-snow .ql-picker-item:hover { color: #818cf8 !important; }
                .ql-snow .ql-picker-item.ql-selected { color: #6366f1 !important; }
            `}</style>
        </div>
    );
};

export default RichTextEditor;
