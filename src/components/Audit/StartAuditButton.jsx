import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import StartAuditModal from './StartAuditModal';

export default function StartAuditButton({ type, targetId, label = "Start Audit", className = "" }) {
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const navigate = useNavigate();

    const [activeSession, setActiveSession] = useState(null);

    const handleConfirm = async () => {
        setLoading(true);
        try {
            // Cancel existing if one exists (user confirmed overwrite)
            if (activeSession) {
                await api.cancelAudit(activeSession.id);
            }

            const session = await api.startAudit({ type, targetId });
            navigate(`/audit/${session.id}`);
        } catch (err) {
            console.error(err);
            alert('Failed to start audit: ' + err.message);
        } finally {
            setLoading(false);
            setIsModalOpen(false);
            setActiveSession(null);
        }
    };

    const handleOpen = async () => {
        setLoading(true);
        try {
            const active = await api.getActiveAudit();
            if (active) {
                // Check if the active session matches our intent
                // For Deck: type matches AND target_id matches
                // For Collection: type matches
                const isTypeMatch = active.type === type;
                const isTargetMatch = !targetId || String(active.target_id) === String(targetId);

                if (isTypeMatch && isTargetMatch) {
                    navigate(`/audit/${active.id}`);
                    return;
                }

                // Mismatch: User has an active session of a different type/target
                // Prompt to overwrite
                setActiveSession(active);
                setIsModalOpen(true);
                return;
            }
            // No active session, open modal
            setActiveSession(null);
            setIsModalOpen(true);
        } catch (err) {
            console.error(err);
            setIsModalOpen(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={handleOpen}
                className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50 ${className}`}
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                {label}
            </button>

            <StartAuditModal
                isOpen={isModalOpen} // Fixed prop name
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleConfirm}
                type={type}
                loading={loading}
                activeSession={activeSession}
            />
        </>
    );
}
