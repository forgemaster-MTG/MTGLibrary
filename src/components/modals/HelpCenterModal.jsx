import React from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HELP_DOCS } from '../../data/helpDocs';

const HelpCenterModal = ({ isOpen, onClose, onStartTour, onOpenChat, initialGuide = null }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [view, setView] = React.useState('home'); // 'home' | 'guide'
    const [activeGuide, setActiveGuide] = React.useState(null);

    // Reset when opening
    React.useEffect(() => {
        if (isOpen) {
            if (initialGuide) {
                setActiveGuide(initialGuide);
                setView('guide');
            } else {
                setView('home');
                setActiveGuide(null);
            }
        }
    }, [isOpen, initialGuide]);

    // Determine relevant quick links based on current path
    const isDeckBuilder = location.pathname.startsWith('/decks/');
    const isCollection = location.pathname === '/collection';

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[100]" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-3xl bg-gray-900 border border-primary-500/30 p-0 text-left align-middle shadow-2xl transition-all h-[80vh] flex flex-col">
                                {/* Header */}
                                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-xl">
                                    <Dialog.Title
                                        as="h3"
                                        className="text-2xl font-black leading-6 text-white flex items-center gap-3"
                                    >
                                        {view === 'guide' ? (
                                            <button
                                                onClick={() => setView('home')}
                                                className="p-2 -ml-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                                <span className="text-sm font-bold uppercase tracking-widest">Back</span>
                                            </button>
                                        ) : (
                                            <>
                                                <span className="text-3xl">🛟</span>
                                                Help Center
                                            </>
                                        )}
                                    </Dialog.Title>
                                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-xl">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                                    {view === 'home' ? (
                                        <>
                                            <div className="mb-8">
                                                <p className="text-base text-gray-400">
                                                    Stuck? Here are a few ways to get moving again.
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Tour Card */}
                                                <button
                                                    onClick={() => { onClose(); onStartTour(); }}
                                                    className="group relative p-8 rounded-3xl bg-gray-800/50 border border-gray-700 hover:border-primary-500 hover:bg-primary-500/5 transition-all text-left"
                                                >
                                                    <div className="absolute top-6 right-6 p-3 bg-primary-500/10 rounded-xl text-primary-400 group-hover:scale-110 transition-transform">
                                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                                                    </div>
                                                    <h4 className="text-xl font-black text-white mb-2">Take a Tour</h4>
                                                    <p className="text-sm text-gray-400">Walk through the features of the current page with interactive highlights.</p>
                                                </button>

                                                {/* AI Chat Card */}
                                                <button
                                                    onClick={() => { onClose(); onOpenChat(); }}
                                                    className="group relative p-8 rounded-3xl bg-gray-800/50 border border-gray-700 hover:border-purple-500 hover:bg-purple-500/5 transition-all text-left"
                                                >
                                                    <div className="absolute top-6 right-6 p-3 bg-purple-500/10 rounded-xl text-purple-400 group-hover:scale-110 transition-transform">
                                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                                    </div>
                                                    <h4 className="text-xl font-black text-white mb-2">Ask AI Helper</h4>
                                                    <p className="text-sm text-gray-400">Chat with the intelligent assistant. It knows exactly what you're looking at.</p>
                                                </button>

                                                {/* Support & Alpha Info Card */}
                                                <button
                                                    onClick={() => { onClose(); navigate('/support'); }}
                                                    className="group relative p-8 rounded-3xl bg-gray-800/50 border border-gray-700 hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left"
                                                >
                                                    <div className="absolute top-6 right-6 p-3 bg-orange-500/10 rounded-xl text-orange-400 group-hover:scale-110 transition-transform">
                                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    </div>
                                                    <h4 className="text-xl font-black text-white mb-2">Support & Alpha</h4>
                                                    <p className="text-sm text-gray-400">Learn about our development phase and how to get in touch.</p>
                                                </button>
                                            </div>

                                            <div className="mt-8 pt-8 border-t border-gray-800">
                                                <h5 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Quick Guides</h5>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                    {[
                                                        { id: '/dashboard', label: '🏠 Dashboard' },
                                                        { id: '/collection', label: '📚 Collection' },
                                                        { id: '/decks', label: '⚔️ Decks' },
                                                        { id: '/binders', label: '📁 Binders' },
                                                        { id: '/social', label: '🤝 Social' },
                                                        { id: '/sets', label: '🧭 Sets Explorer' },
                                                        { id: '/wishlist', label: '💖 Wishlist' },
                                                        { id: '/audit', label: '🛡️ Audit' },
                                                        { id: 'forge-lens', label: '📸 Forge Lens' },
                                                        { id: '/precons', label: '📦 Precons' },
                                                        { id: '/strategy', label: '🧠 Strategy' },
                                                        { id: '/play', label: '🃏 Play' },
                                                        { id: '/trades', label: '🛡️ Armory' },
                                                        { id: '/tournaments', label: '🏆 Tourneys' },
                                                        { id: '/settings', label: '⚙️ Settings' }
                                                    ].map(item => (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => { setActiveGuide(item.id); setView('guide'); }}
                                                            className="p-4 bg-gray-800/30 border border-white/5 rounded-2xl text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-700/50 hover:border-primary-500/30 transition-all text-left flex items-center gap-2"
                                                        >
                                                            {item.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="h-4" />
                                        </>
                                    ) : (
                                        <div className="animate-fade-in">
                                            {(() => {
                                                const doc = activeGuide ? (HELP_DOCS[activeGuide] || (activeGuide.startsWith('/') ? HELP_DOCS[activeGuide] : null)) : null;
                                                // If not found in HELP_DOCS, could be a dynamic route handled by a helper (though here we just check HELP_DOCS)
                                                // Actually let's use a helper if we had one, but let's assume activeGuide is the key.

                                                if (!doc) return (
                                                    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                                                        <span className="text-4xl mb-4">🔍</span>
                                                        <p className="font-bold">Guide content not found.</p>
                                                    </div>
                                                );

                                                return (
                                                    <div className="space-y-8 pb-10">
                                                        {/* Guide Sub-Header */}
                                                        <div className="flex items-center gap-6 mb-10">
                                                            <div className={`p-6 bg-${doc.color}-500/20 rounded-3xl text-4xl`}>
                                                                {doc.icon}
                                                            </div>
                                                            <div>
                                                                <h2 className="text-3xl font-black text-white leading-tight mb-1">{doc.title}</h2>
                                                                <p className="text-base text-gray-400">{doc.subtitle}</p>
                                                            </div>
                                                        </div>

                                                        {/* Sections */}
                                                        {doc.sections?.map((section, idx) => (
                                                            <section key={idx} className="space-y-3">
                                                                <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                                                    <span className={`w-1.5 h-4 bg-${doc.color}-500 rounded-full`} />
                                                                    {section.title}
                                                                </h3>

                                                                {section.type === 'text' && (
                                                                    <div className="text-base text-gray-300 leading-relaxed bg-white/5 p-6 rounded-3xl border border-white/5">
                                                                        {section.content.split('\n').map((line, i) => (
                                                                            <p key={i} className={i > 0 ? 'mt-3' : ''}>
                                                                                {line.split(/(\*\*.*?\*\*)/).map((part, j) => {
                                                                                    if (part.startsWith('**') && part.endsWith('**')) {
                                                                                        return <strong key={j} className="text-white font-black">{part.slice(2, -2)}</strong>;
                                                                                    }
                                                                                    return part;
                                                                                })}
                                                                            </p>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {section.type === 'grid' && (
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                        {section.items.map((item, i) => (
                                                                            <div key={i} className="bg-gray-800/40 p-6 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
                                                                                <div className="flex items-center gap-4 mb-2">
                                                                                    <span className="text-2xl">{item.icon}</span>
                                                                                    <h4 className="font-black text-white text-base">{item.title}</h4>
                                                                                </div>
                                                                                <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {section.type === 'image' && (
                                                                    <div className="space-y-2">
                                                                        <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                                                                            <img src={section.src} alt={section.title} className="w-full h-auto object-cover" />
                                                                        </div>
                                                                        {section.caption && (
                                                                            <p className="text-xs text-center text-gray-500 italic px-2">{section.caption}</p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </section>
                                                        ))}

                                                        {/* Pro Tips */}
                                                        {doc.tips && (
                                                            <div className={`bg-gradient-to-br from-${doc.color}-900/40 to-gray-950 p-6 rounded-3xl border border-${doc.color}-500/20`}>
                                                                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                    <span>💡</span> Pro Tips
                                                                </h3>
                                                                <div className="space-y-4">
                                                                    {doc.tips.map((tip, i) => (
                                                                        <div key={i} className="flex gap-6">
                                                                            <div className="text-3xl shrink-0 mt-1">{tip.icon}</div>
                                                                            <div>
                                                                                <h5 className="text-white font-black text-base mb-1">{tip.title}</h5>
                                                                                <p className="text-sm text-gray-300 leading-relaxed">{tip.text}</p>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Footer Action */}
                                                        {doc.footer && (
                                                            <div className="pt-4 flex justify-end">
                                                                <button
                                                                    onClick={() => {
                                                                        if (activeGuide.startsWith('/')) {
                                                                            onClose();
                                                                            navigate(activeGuide);
                                                                        } else {
                                                                            onClose();
                                                                        }
                                                                    }}
                                                                    className={`px-8 py-3 bg-${doc.color}-600 hover:bg-${doc.color}-500 text-white rounded-xl transition-all font-black text-sm shadow-xl shadow-${doc.color}-900/20 active:scale-95`}
                                                                >
                                                                    {doc.footer.text}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition >
    );
};

export default HelpCenterModal;
