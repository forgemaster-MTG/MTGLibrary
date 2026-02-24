import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { GeminiService } from '../../services/gemini';

const AIPersonasManager = () => {
    const { userProfile } = useAuth();
    const [personas, setPersonas] = useState([]);
    const [loadingPersonas, setLoadingPersonas] = useState(false);
    const [newPersona, setNewPersona] = useState({ name: '', type: '', personality: '', price_usd: 0, avatar_url: '', is_active: true, sample_responses: [] });
    const [editingPersona, setEditingPersona] = useState(null);
    const [generatingAvatar, setGeneratingAvatar] = useState(false);
    const [generatingSamples, setGeneratingSamples] = useState(false);
    const [isFormCollapsed, setIsFormCollapsed] = useState(false);

    const fetchPersonas = async () => {
        setLoadingPersonas(true);
        try {
            const data = await api.getAdminPersonas();
            setPersonas(data || []);
        } catch (err) { console.error(err); } finally { setLoadingPersonas(false); }
    };

    const handleCreatePersona = async (e) => {
        e.preventDefault();
        try {
            await api.createPersona(newPersona);
            setNewPersona({ name: '', type: '', personality: '', price_usd: 0, avatar_url: '', is_active: true, sample_responses: [] });
            fetchPersonas();
            alert('Persona created!');
        } catch (err) { alert('Creation failed: ' + err.message); }
    };

    const handleUpdatePersona = async (e) => {
        e.preventDefault();
        try {
            await api.updatePersona(editingPersona.id, editingPersona);
            setEditingPersona(null);
            fetchPersonas();
            alert('Persona updated!');
        } catch (err) { alert('Update failed: ' + err.message); }
    };

    const handleDeletePersona = async (id) => {
        if (!window.confirm('Are you sure you want to permanently delete this persona? Consider deactivating it instead.')) return;
        try {
            await api.deletePersona(id);
            fetchPersonas();
        } catch (err) { alert('Delete failed: ' + err.message); }
    };

    const handleGenerateAvatar = async (personaContext) => {
        if (!userProfile?.settings?.geminiApiKey) {
            alert('You need a Gemini API key set in your personal settings to generate avatars.');
            return;
        }
        setGeneratingAvatar(true);
        try {
            const imageStr = await GeminiService.generateImagen(personaContext.name, 'AI Helper Persona', personaContext.type, null, userProfile, personaContext.personality);
            if (editingPersona) {
                setEditingPersona({ ...editingPersona, avatar_url: imageStr });
            } else {
                setNewPersona({ ...newPersona, avatar_url: imageStr });
            }
        } catch (err) {
            alert('Avatar generation failed: ' + err.message);
        } finally {
            setGeneratingAvatar(false);
        }
    };

    const handleGenerateSamples = async (personaContext) => {
        if (!userProfile?.settings?.geminiApiKey) {
            alert('You need a Gemini API key set in your personal settings to generate samples.');
            return;
        }
        setGeneratingSamples(true);
        try {
            const samples = await GeminiService.generatePersonaSamples(
                userProfile.settings.geminiApiKey,
                personaContext,
                userProfile
            );
            if (editingPersona) {
                setEditingPersona({ ...editingPersona, sample_responses: samples });
            } else {
                setNewPersona({ ...newPersona, sample_responses: samples });
            }
        } catch (err) {
            alert('Sample generation failed: ' + err.message);
        } finally {
            setGeneratingSamples(false);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            if (editingPersona) {
                setEditingPersona({ ...editingPersona, avatar_url: base64 });
            } else {
                setNewPersona({ ...newPersona, avatar_url: base64 });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSampleChange = (index, field, value) => {
        const target = editingPersona || newPersona;
        const currentSamples = Array.isArray(target.sample_responses) ? [...target.sample_responses] : [];
        if (!currentSamples[index]) currentSamples[index] = { userContent: '', aiContent: '' };
        currentSamples[index][field] = value;

        if (editingPersona) {
            setEditingPersona({ ...editingPersona, sample_responses: currentSamples });
        } else {
            setNewPersona({ ...newPersona, sample_responses: currentSamples });
        }
    };

    const addEmptySample = () => {
        const target = editingPersona || newPersona;
        const currentSamples = Array.isArray(target.sample_responses) ? [...target.sample_responses] : [];
        currentSamples.push({ userContent: '', aiContent: '' });

        if (editingPersona) {
            setEditingPersona({ ...editingPersona, sample_responses: currentSamples });
        } else {
            setNewPersona({ ...newPersona, sample_responses: currentSamples });
        }
    };

    const removeSample = (index) => {
        const target = editingPersona || newPersona;
        const currentSamples = Array.isArray(target.sample_responses) ? [...target.sample_responses] : [];
        currentSamples.splice(index, 1);

        if (editingPersona) {
            setEditingPersona({ ...editingPersona, sample_responses: currentSamples });
        } else {
            setNewPersona({ ...newPersona, sample_responses: currentSamples });
        }
    };

    useEffect(() => {
        fetchPersonas();
    }, []);

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-semibold text-white">AI Personas Manager</h2>
            <p className="text-gray-400 text-sm">Create and manage curated and custom AI personas for the Character Select screen.</p>

            {/* Create / Edit Form */}
            <div className={`bg-gray-800/50 rounded-xl border transition-all duration-300 ${editingPersona ? 'border-primary-500/50 shadow-lg shadow-primary-500/10' : 'border-white/10'}`}>
                <div
                    className="flex justify-between items-center p-6 cursor-pointer select-none"
                    onClick={() => setIsFormCollapsed(!isFormCollapsed)}
                >
                    <div className="flex items-center gap-3">
                        <svg className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isFormCollapsed ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        <h3 className="text-lg font-medium text-white">{editingPersona ? 'Edit Persona' : 'Create New Persona'}</h3>
                    </div>
                    <div className="flex items-center gap-4">
                        {editingPersona && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setEditingPersona(null); }}
                                className="text-xs text-gray-400 hover:text-white underline"
                            >
                                Cancel Edit
                            </button>
                        )}
                        <span className="text-xs text-gray-500 uppercase font-bold tracking-widest">{isFormCollapsed ? 'Expand' : 'Collapse'}</span>
                    </div>
                </div>

                {!isFormCollapsed && (
                    <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-300">
                        <form onSubmit={editingPersona ? handleUpdatePersona : handleCreatePersona} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                                    <input
                                        type="text" required
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
                                        value={editingPersona ? editingPersona.name : newPersona.name}
                                        onChange={e => editingPersona ? setEditingPersona({ ...editingPersona, name: e.target.value }) : setNewPersona({ ...newPersona, name: e.target.value })}
                                        placeholder="e.g. Krenko, Mob Boss"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Type/Class</label>
                                    <input
                                        type="text" required
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
                                        value={editingPersona ? editingPersona.type : newPersona.type}
                                        onChange={e => editingPersona ? setEditingPersona({ ...editingPersona, type: e.target.value }) : setNewPersona({ ...newPersona, type: e.target.value })}
                                        placeholder="e.g. Goblin Kingpin"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Personality Prompt</label>
                                    <textarea
                                        required rows="3"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
                                        value={editingPersona ? editingPersona.personality : newPersona.personality}
                                        onChange={e => editingPersona ? setEditingPersona({ ...editingPersona, personality: e.target.value }) : setNewPersona({ ...newPersona, personality: e.target.value })}
                                        placeholder="You are greedy, chaotic, and obsessed with generating tokens..."
                                    ></textarea>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Price (USD)</label>
                                    <select
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
                                        value={editingPersona ? editingPersona.price_usd : newPersona.price_usd}
                                        onChange={e => {
                                            const val = parseFloat(e.target.value);
                                            editingPersona ? setEditingPersona({ ...editingPersona, price_usd: val }) : setNewPersona({ ...newPersona, price_usd: val })
                                        }}
                                    >
                                        <option value={0}>Free ($0.00)</option>
                                        <option value={0.99}>Standard ($0.99)</option>
                                        <option value={1.99}>Epic ($1.99)</option>
                                        <option value={4.99}>Legendary ($4.99)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                                    <label className="flex items-center gap-2 mt-2">
                                        <input
                                            type="checkbox"
                                            checked={editingPersona ? editingPersona.is_active : newPersona.is_active}
                                            onChange={e => editingPersona ? setEditingPersona({ ...editingPersona, is_active: e.target.checked }) : setNewPersona({ ...newPersona, is_active: e.target.checked })}
                                            className="form-checkbox bg-gray-900 border-gray-700 text-primary-500"
                                        />
                                        <span className="text-white text-sm">Active / Available in Store</span>
                                    </label>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Avatar Image (Base64 URL)</label>
                                    <div className="flex gap-4 items-start">
                                        {(editingPersona ? editingPersona.avatar_url : newPersona.avatar_url) ? (
                                            <div className="w-16 h-16 rounded overflow-hidden shrink-0 border border-gray-700 bg-black">
                                                <img src={editingPersona ? editingPersona.avatar_url : newPersona.avatar_url} alt="Avatar Preview" className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="w-16 h-16 rounded shrink-0 border border-dashed border-gray-600 bg-gray-800 flex items-center justify-center text-xs text-gray-500 text-center p-1">
                                                No Avatar
                                            </div>
                                        )}
                                        <div className="flex-1 space-y-3">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500 font-mono text-xs"
                                                    value={editingPersona ? editingPersona.avatar_url || '' : newPersona.avatar_url || ''}
                                                    onChange={e => editingPersona ? setEditingPersona({ ...editingPersona, avatar_url: e.target.value }) : setNewPersona({ ...newPersona, avatar_url: e.target.value })}
                                                    placeholder="data:image/png;base64,... OR image URL"
                                                />
                                                <label className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4-4m4 4V4" /></svg>
                                                    Upload PNG
                                                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                                                </label>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleGenerateAvatar(editingPersona || newPersona)}
                                                disabled={generatingAvatar || !(editingPersona ? editingPersona.name : newPersona.name)}
                                                className="flex items-center gap-2 text-xs bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/50 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                                            >
                                                ✨ {generatingAvatar ? 'Generating Image...' : 'AI Generate based on Name/Personality'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-2 mt-4 border-t border-gray-700 pt-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-medium text-gray-400">Sample Responses / Example Interactions</label>
                                        <button
                                            type="button"
                                            onClick={() => handleGenerateSamples(editingPersona || newPersona)}
                                            disabled={generatingSamples || !(editingPersona ? editingPersona.name : newPersona.name)}
                                            className="flex items-center gap-2 text-xs bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/50 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                                        >
                                            ✨ {generatingSamples ? 'Generating...' : 'AI Generate Samples'}
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {((editingPersona ? editingPersona.sample_responses : newPersona.sample_responses) || []).map((sample, idx) => (
                                            <div key={idx} className="bg-gray-900/50 border border-gray-700 p-3 rounded-lg flex gap-3 items-start">
                                                <div className="flex-1 space-y-2">
                                                    <input
                                                        type="text"
                                                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500"
                                                        placeholder="User Prompt (e.g. Should I add more lands?)"
                                                        value={sample.userContent || ''}
                                                        onChange={(e) => handleSampleChange(idx, 'userContent', e.target.value)}
                                                    />
                                                    <textarea
                                                        rows="2"
                                                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500"
                                                        placeholder="AI Response in character..."
                                                        value={sample.aiContent || ''}
                                                        onChange={(e) => handleSampleChange(idx, 'aiContent', e.target.value)}
                                                    ></textarea>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeSample(idx)}
                                                    className="text-gray-500 hover:text-red-400 mt-1"
                                                    title="Remove Sample"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                        {((editingPersona ? editingPersona.sample_responses : newPersona.sample_responses) || []).length === 0 && (
                                            <div className="text-gray-500 text-sm italic py-2">No sample responses added yet.</div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={addEmptySample}
                                            className="text-xs text-primary-400 border border-primary-500/30 hover:bg-primary-500/10 px-3 py-1.5 rounded"
                                        >
                                            + Add Manual Sample
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <button type="submit" className={`px-6 py-2 font-bold rounded-lg shadow-lg transition-all text-white ${editingPersona ? 'bg-green-600 hover:bg-green-500' : 'bg-primary-600 hover:bg-primary-500'}`}>
                                    {editingPersona ? 'Save Updates' : 'Create Persona'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* List */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium text-white">Preset Personas List</h3>
                {loadingPersonas ? <div className="text-gray-500">Loading...</div> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {personas.map(persona => (
                            <div key={persona.id} className={`bg-gray-800 rounded-xl border p-4 flex gap-4 ${!persona.is_active ? 'opacity-50 border-gray-700' : 'border-white/10'}`}>
                                <div className="w-16 h-16 rounded overflow-hidden shrink-0 border border-gray-700 bg-black flex items-center justify-center text-xs text-gray-500">
                                    {persona.avatar_url ? <img src={persona.avatar_url} alt={persona.name} className="w-full h-full object-cover" /> : 'No IMG'}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-bold text-white truncate text-sm" title={persona.name}>{persona.name}</h4>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${parseFloat(persona.price_usd) > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>
                                                {parseFloat(persona.price_usd) === 0 ? 'Free' : `$${persona.price_usd}`}
                                            </span>
                                        </div>
                                        <p className="text-xs text-primary-400 truncate">{persona.type}</p>
                                    </div>
                                    <div className="flex justify-between items-end mt-2">
                                        <span className={`text-[10px] ${persona.is_active ? 'text-green-400' : 'text-red-400'}`}>
                                            {persona.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setEditingPersona(persona); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-gray-400 hover:text-white" title="Edit">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                            <button onClick={() => handleDeletePersona(persona.id)} className="text-gray-400 hover:text-red-400" title="Delete">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {personas.length === 0 && <div className="text-gray-500 italic md:col-span-2">No personas found.</div>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIPersonasManager;
