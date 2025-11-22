import { openModal, closeModal, showToast } from '../lib/ui.js';
import { askNextQuestion, synthesizeStructuredPlaystyle, playstyleState } from '../settings/playstyleLogic.js';

let currentWizardState = {
    isOpen: false,
    answers: [],
    loading: false,
    questionCount: 0,
    maxQuestions: 7 // Ask enough to get a full picture
};

export function initPlaystyleWizard() {
    // Wire up global listeners if needed, though mostly handled by openPlaystyleWizard
    const closeBtn = document.getElementById('close-playstyle-wizard-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => closePlaystyleWizard());
}

export function openPlaystyleWizard() {
    currentWizardState = {
        isOpen: true,
        answers: [], // Start fresh
        loading: false,
        questionCount: 0,
        maxQuestions: 7
    };
    openModal('playstyle-wizard-modal');
    renderWizardStep();
}

export function closePlaystyleWizard() {
    currentWizardState.isOpen = false;
    closeModal('playstyle-wizard-modal');
}

async function renderWizardStep() {
    const container = document.getElementById('playstyle-wizard-content');
    if (!container) return;

    // Loading State
    if (currentWizardState.loading) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 space-y-4">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                <p class="text-gray-400 animate-pulse">Consulting the archives...</p>
            </div>
        `;
        return;
    }

    // Completion State
    if (currentWizardState.questionCount >= currentWizardState.maxQuestions) {
        renderCompletionScreen(container);
        return;
    }

    // Fetch Next Question
    currentWizardState.loading = true;
    renderWizardStep(); // Show loader

    try {
        const nextQ = await askNextQuestion(currentWizardState.answers);
        currentWizardState.loading = false;

        if (!nextQ) {
            throw new Error('Failed to generate question');
        }

        renderQuestionScreen(container, nextQ);
    } catch (err) {
        console.error('Wizard Error:', err);
        currentWizardState.loading = false;
        container.innerHTML = `
            <div class="text-center p-6">
                <p class="text-red-400 mb-4">Something went wrong contacting the oracle.</p>
                <button id="wizard-retry-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded">Retry</button>
            </div>
        `;
        document.getElementById('wizard-retry-btn')?.addEventListener('click', () => renderWizardStep());
    }
}

function renderQuestionScreen(container, questionData) {
    const progress = Math.round((currentWizardState.questionCount / currentWizardState.maxQuestions) * 100);

    container.innerHTML = `
        <div class="space-y-6">
            <!-- Progress Bar -->
            <div class="w-full bg-gray-700 rounded-full h-2.5">
                <div class="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" style="width: ${progress}%"></div>
            </div>
            <div class="flex justify-between text-xs text-gray-400 uppercase tracking-wider">
                <span>Question ${currentWizardState.questionCount + 1} of ${currentWizardState.maxQuestions}</span>
                <span>${progress}% Complete</span>
            </div>

            <!-- Question -->
            <div class="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50 shadow-inner">
                <h3 class="text-xl md:text-2xl font-bold text-white leading-relaxed">
                    ${questionData.question}
                </h3>
            </div>

            <!-- Options -->
            <div class="grid grid-cols-1 gap-3">
                ${questionData.choices.map((choice, idx) => `
                    <button class="wizard-option-btn text-left p-4 rounded-lg bg-gray-700 hover:bg-indigo-600 hover:text-white transition-all duration-200 border border-gray-600 hover:border-indigo-500 group">
                        <span class="inline-block w-6 h-6 rounded-full bg-gray-800 text-gray-400 text-center text-sm leading-6 mr-3 group-hover:bg-white group-hover:text-indigo-600 font-bold">${String.fromCharCode(65 + idx)}</span>
                        <span class="font-medium">${choice}</span>
                    </button>
                `).join('')}
            </div>
            
            <!-- Skip/Custom (Optional, maybe add later if requested) -->
        </div>
    `;

    // Attach listeners
    container.querySelectorAll('.wizard-option-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const answer = btn.querySelector('span:last-child').textContent;
            handleAnswer(questionData.question, answer);
        });
    });
}

function handleAnswer(question, answer) {
    currentWizardState.answers.push({
        questionId: currentWizardState.questionCount + 1,
        question: question,
        answer: answer
    });
    currentWizardState.questionCount++;
    renderWizardStep();
}

async function renderCompletionScreen(container) {
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full space-y-6 text-center py-10">
            <div class="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                <svg class="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h3 class="text-2xl font-bold text-white">Profile Complete!</h3>
            <p class="text-gray-300 max-w-md">
                We've gathered enough information to build your unique playstyle profile. 
                This will help our AI provide better deck suggestions and advice.
            </p>
            <button id="wizard-finish-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transform hover:scale-105 transition-all">
                Generate Profile
            </button>
        </div>
    `;

    document.getElementById('wizard-finish-btn').addEventListener('click', async () => {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 space-y-4">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                <p class="text-gray-400 animate-pulse">Synthesizing your magical identity...</p>
            </div>
        `;

        await synthesizeStructuredPlaystyle(currentWizardState.answers);
        closePlaystyleWizard();
        showToast('Playstyle profile updated!', 'success');
    });
}
