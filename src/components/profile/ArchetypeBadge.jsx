
// Checked code: No obvious "jsx=true" here.
// But let's check `ProfilePage.jsx` where I added the badge.
/* 
 <div className="mt-4 md:absolute md:top-8 md:right-8 md:mt-0">
    <ArchetypeBadge archetype={archetype} />
 </div>
*/
// That looks fine.
// The error `Received 'true' for a non-boolean attribute 'jsx'` usually comes from Styled Components or emotionally confusing props.
// I am NOT using styled components.
// Wait, I see `<style jsx>` in some Next.js projects, but this is Vite.
// Maybe I accidentally added `jsx` prop to an element?
// I will search for it.
import React from 'react';
import { Sparkles, Zap, Shield, Crown, Anchor, Flame, Leaf, Skull } from 'lucide-react';

const ArchetypeBadge = ({ archetype }) => {
    if (!archetype) return null;

    // Helpers for styling based on color
    const getColors = (key) => {
        if (key.includes('W')) return 'from-yellow-100 to-yellow-300 text-yellow-900';
        if (key.includes('U')) return 'from-blue-400 to-blue-600 text-white';
        if (key.includes('B')) return 'from-gray-700 to-black text-white';
        if (key.includes('R')) return 'from-red-500 to-orange-500 text-white';
        if (key.includes('G')) return 'from-green-500 to-emerald-700 text-white';
        return 'from-gray-400 to-gray-600 text-white'; // Colorless
    };

    const bgClass = archetype.colorKey ? getColors(archetype.colorKey) : 'from-indigo-500 to-purple-600 text-white';

    return (
        <div className="relative group cursor-default">
            <div className={`
                relative overflow-hidden
                bg-gradient-to-br ${bgClass}
                rounded-xl p-6 shadow-xl border border-white/10
                transform transition-all duration-500
                hover:scale-105 hover:shadow-2xl
            `}>
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-20 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="mb-2 p-2 bg-white/20 backdrop-blur-sm rounded-full shadow-inner">
                        <Crown className="w-8 h-8 drop-shadow-md" />
                    </div>

                    <h3 className="text-2xl font-black uppercase tracking-tight leading-none mb-1 drop-shadow-lg">
                        {archetype.title}
                    </h3>

                    <div className="h-0.5 w-12 bg-white/40 my-2 rounded-full" />

                    <p className="text-sm font-medium opacity-90 italic">
                        "{archetype.flavor}"
                    </p>
                </div>
            </div>

            {/* Hover Details - appearing below */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-64 bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-xl p-4 shadow-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 translate-y-2 group-hover:translate-y-0">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Collection Analysis</h4>
                <div className="space-y-2 text-sm">
                    {/* Could show bar charts here, for now simple text */}
                    <div className="flex justify-between">
                        <span className="text-gray-400">Creatures</span>
                        <span className="text-white font-mono">{archetype.stats.counts.Creature || 0}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Instants/Sorc</span>
                        <span className="text-white font-mono">{(archetype.stats.counts.Instant || 0) + (archetype.stats.counts.Sorcery || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Artifacts</span>
                        <span className="text-white font-mono">{archetype.stats.counts.Artifact || 0}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ArchetypeBadge;
