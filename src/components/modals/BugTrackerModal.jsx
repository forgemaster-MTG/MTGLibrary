import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

const BugTrackerModal = ({ isOpen, onClose }) => {
    const [content, setContent] = useState('Loading bugs...');

    useEffect(() => {
        if (isOpen) {
            api.getBugs() // We will add this to api.js
                .then(text => setContent(text))
                .catch(err => setContent('Failed to load bug list: ' + err.message));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                {/* Backdrop */}
                <div className="fixed inset-0 bg-gray-900/75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

                {/* Modal Panel */}
                <div className="inline-block align-bottom bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full border border-gray-700 relative z-10">
                    <div className="bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl leading-6 font-medium text-white" id="modal-title">
                                        Known Bugs & Tasks
                                    </h3>
                                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="mt-2 bg-gray-900 rounded p-4 h-[60vh] overflow-y-auto font-mono text-sm text-gray-300 whitespace-pre-wrap">
                                    {content}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-800 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-700">
                        <a
                            href="https://discord.gg/mtgforge"
                            target="_blank"
                            rel="noreferrer"
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                        >
                            Report New Bug (Discord)
                        </a>
                        <button
                            type="button"
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-600 shadow-sm px-4 py-2 bg-gray-700 text-base font-medium text-gray-300 hover:bg-gray-600 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                            onClick={onClose}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BugTrackerModal;
