import { useReducer, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Helper to parse mana cost strings like "{2}{U}{B}"
function parseManaCost(costString) {
    if (!costString) return {};
    const costs = { w: 0, u: 0, b: 0, r: 0, g: 0, c: 0, generic: 0 };
    const matches = costString.match(/\{([^}]+)\}/g);
    if (!matches) return costs;

    matches.forEach(match => {
        const symbol = match.slice(1, -1).toLowerCase();
        if (['w', 'u', 'b', 'r', 'g', 'c'].includes(symbol)) {
            costs[symbol]++;
        } else if (!isNaN(symbol)) {
            costs.generic += parseInt(symbol);
        }
    });
    return costs;
}

// Helper to check if mana pool can satisfy a cost
function canAfford(pool, costString) {
    if (!costString) return true;
    const cost = parseManaCost(costString);
    const tempPool = { ...pool };

    // Check colored costs first
    for (const color of ['w', 'u', 'b', 'r', 'g', 'c']) {
        if (tempPool[color] < cost[color]) return false;
        tempPool[color] -= cost[color];
    }

    // Check generic cost using any remaining mana
    const totalRemaining = Object.values(tempPool).reduce((a, b) => a + b, 0);
    return totalRemaining >= cost.generic;
}

// Helper to spend mana from pool
function spendManaForCost(pool, costString) {
    const cost = parseManaCost(costString);
    const newPool = { ...pool };

    // Spend specific colors
    ['w', 'u', 'b', 'r', 'g', 'c'].forEach(color => {
        newPool[color] -= cost[color];
    });

    // Spend generic (priority: colorless -> then others)
    let genericLeft = cost.generic;
    const priority = ['c', 'w', 'u', 'b', 'r', 'g'];
    for (const color of priority) {
        const amount = Math.min(newPool[color], genericLeft);
        newPool[color] -= amount;
        genericLeft -= amount;
        if (genericLeft <= 0) break;
    }

    return newPool;
}

const INITIAL_STATE = {
    zones: {
        library: [],
        hand: [],
        battlefield: [],
        graveyard: [],
        exile: [],
        command: [],
    },
    counters: {
        life: 40,
        poison: 0,
        commanderDamage: {}, // { commanderId: damage }
        energy: 0,
    },
    turn: {
        count: 1,
        phase: 'Untap', // Untap, Upkeep, Draw, Main 1, Combat, Main 2, End
        landsPlayed: 0,
    },
    manaPool: {
        w: 0, u: 0, b: 0, r: 0, g: 0, c: 0
    },
    commanderTax: {}, // { instanceId: count }
    ui: {
        selectedIds: [],
        draggingId: null,
        error: null,
    },
    past: [] // State history for Undo
};

const PHASES = ['Untap', 'Upkeep', 'Draw', 'Main 1', 'Combat', 'Main 2', 'End'];

// Helper to save history
function withHistory(oldState, newState) {
    // Keep only the last 20 states to save memory
    const newPast = [...(oldState.past || []), { ...oldState, past: [] }].slice(-20);
    return { ...newState, past: newPast };
}

// Helper to check if a spell can be played based on turn phase
function canPlayTiming(phase, typeLine) {
    if (!typeLine) return true;
    const isInstant = typeLine.includes('Instant') || (typeLine.includes('Creature') && typeLine.includes('Flash'));
    if (isInstant) return true;
    return phase === 'Main 1' || phase === 'Main 2';
}

function gameReducer(state, action) {
    switch (action.type) {
        case 'UNDO': {
            if (!state.past || state.past.length === 0) return state;
            const previous = state.past[state.past.length - 1];
            return { ...previous, past: state.past.slice(0, -1) };
        }

        case 'LOAD_DECK': {
            const { mainboard, commander } = action.payload;
            // Transform cards into game objects with unique IDs and initial state
            const library = mainboard.map(card => ({
                ...card,
                id: uuidv4(),
                instanceId: uuidv4(), // Unique ID for this specific instance in game
                tapped: false,
                faceDown: true, // Library cards are face down
                summoningSickness: false, // Creatures start without summoning sickness in library
                counters: { p1p1: 0, loyalty: 0, other: 0 },
            }));

            const commandZone = commander ? commander.map(card => ({
                ...card,
                id: uuidv4(),
                instanceId: uuidv4(),
                tapped: false,
                faceDown: false,
                isCommander: true,
                summoningSickness: false, // Commanders start without summoning sickness in command zone
                counters: { p1p1: 0, loyalty: 0, other: 0 },
            })) : [];

            return {
                ...INITIAL_STATE,
                zones: {
                    ...INITIAL_STATE.zones,
                    library: shuffle(library),
                    command: commandZone,
                },
                commanderTax: commandZone.reduce((acc, c) => ({ ...acc, [c.instanceId]: 0 }), {})
            };
        }

        case 'DRAW_CARD': {
            const { count = 1 } = action.payload || {};
            const newLibrary = [...state.zones.library];
            const newHand = [...state.zones.hand];
            let error = null;

            for (let i = 0; i < count; i++) {
                if (newLibrary.length > 0) {
                    const card = newLibrary.pop();
                    card.faceDown = false; // Reveal when drawn
                    newHand.push(card);
                } else {
                    error = "Library is empty! You lose the game (if this were a real game).";
                }
            }

            return withHistory(state, {
                ...state,
                ui: { ...state.ui, error },
                zones: {
                    ...state.zones,
                    library: newLibrary,
                    hand: newHand,
                }
            });
        }

        case 'MOVE_CARD': {
            const { cardId, fromZone, toZone, index, position } = action.payload;

            const sourceZone = [...state.zones[fromZone]];
            const targetZone = [...state.zones[toZone]];

            const cardIndex = sourceZone.findIndex(c => c.instanceId === cardId);
            if (cardIndex === -1) return state;

            const [card] = sourceZone.splice(cardIndex, 1);

            // Gameplay Rule Enforcement
            let newManaPool = state.manaPool;
            let newLandsPlayed = state.turn.landsPlayed;
            let newCommanderTax = { ...state.commanderTax };

            if ((fromZone === 'hand' || fromZone === 'command') && toZone === 'battlefield') {
                const isLand = card.type_line && card.type_line.includes('Land');

                // Check Timing (unless it's a land, which is special but usually main phase)
                if (!canPlayTiming(state.turn.phase, card.type_line)) {
                    return { ...state, ui: { ...state.ui, error: `Can only play ${card.name} during your Main phase.` } };
                }

                if (isLand) {
                    if (newLandsPlayed >= 1) {
                        return { ...state, ui: { ...state.ui, error: "Only one land per turn allowed." } };
                    }
                    newLandsPlayed++;
                } else {
                    // Check mana cost including Commander Tax
                    let cost = card.mana_cost;
                    if (card.isCommander && fromZone === 'command') {
                        const taxCount = newCommanderTax[card.instanceId] || 0;
                        if (taxCount > 0) {
                            // Add {2} for each tax count to the cost string
                            cost = `${cost}{${taxCount * 2}}`;
                        }
                    }

                    if (!canAfford(state.manaPool, cost)) {
                        return { ...state, ui: { ...state.ui, error: `Cannot afford ${card.name}. Cost: ${cost}` } };
                    }
                    newManaPool = spendManaForCost(state.manaPool, cost);

                    if (card.isCommander && fromZone === 'command') {
                        newCommanderTax[card.instanceId] = (newCommanderTax[card.instanceId] || 0) + 1;
                    }
                }
            }

            // Update card state based on zone logic
            const updatedCard = {
                ...card,
                faceDown: toZone === 'library',
                position: position || (toZone === 'battlefield' ? card.position : null),
                // Summoning Sickness: Add if entering battlefield as creature
                summoningSickness: toZone === 'battlefield' && card.type_line?.includes('Creature') ? true : card.summoningSickness
            };

            if (typeof index === 'number') {
                targetZone.splice(index, 0, updatedCard);
            } else {
                targetZone.push(updatedCard);
            }

            return withHistory(state, {
                ...state,
                manaPool: newManaPool,
                turn: { ...state.turn, landsPlayed: newLandsPlayed },
                commanderTax: newCommanderTax,
                ui: { ...state.ui, error: null },
                zones: {
                    ...state.zones,
                    [fromZone]: sourceZone,
                    [toZone]: targetZone,
                }
            });
        }

        case 'TAP_CARD': {
            const { cardId, zone } = action.payload;
            let manaToAdd = [];

            const targetZone = state.zones[zone].map(card => {
                if (card.instanceId === cardId) {
                    // Rule: Cannot tap creatures with Summoning Sickness
                    if (card.summoningSickness && card.type_line?.includes('Creature')) {
                        // We'll return an error via UI state in the next step or just block
                        return card;
                    }

                    const isTapping = !card.tapped;
                    // ... tapping logic unchanged ...
                    if (isTapping) {
                        if (card.produced_mana && card.produced_mana.length > 0) {
                            manaToAdd.push(card.produced_mana[0].toLowerCase());
                        } else if (card.type_line && card.type_line.includes('Land')) {
                            const types = { 'Plains': 'w', 'Island': 'u', 'Swamp': 'b', 'Mountain': 'r', 'Forest': 'g', 'Wastes': 'c' };
                            for (const [type, color] of Object.entries(types)) {
                                if (card.type_line.includes(type)) {
                                    manaToAdd.push(color);
                                    break;
                                }
                            }
                        }
                    }
                    return { ...card, tapped: isTapping };
                }
                return card;
            });

            const newManaPool = { ...state.manaPool };
            manaToAdd.forEach(color => {
                if (newManaPool[color] !== undefined) newManaPool[color]++;
            });

            return withHistory(state, {
                ...state,
                ui: { ...state.ui, error: null },
                zones: {
                    ...state.zones,
                    [zone]: targetZone
                },
                manaPool: newManaPool
            });
        }

        case 'NEXT_PHASE': {
            const currentPhaseIndex = PHASES.indexOf(state.turn.phase);
            let nextPhaseIndex = currentPhaseIndex + 1;
            let nextTurnCount = state.turn.count;
            let shouldUntap = false;
            let newLandsPlayed = state.turn.landsPlayed;

            // Loop to next turn
            if (nextPhaseIndex >= PHASES.length) {
                nextPhaseIndex = 0;
                nextTurnCount++;
                shouldUntap = true;
                newLandsPlayed = 0; // Reset lands per turn
            }

            const nextPhase = PHASES[nextPhaseIndex];

            // Empty mana pool (simplified mana burn rule)
            const emptyManaPool = { w: 0, u: 0, b: 0, r: 0, g: 0, c: 0 };

            // Logic for specific phases
            let newBattlefield = state.zones.battlefield;

            if (shouldUntap || nextPhase === 'Untap') {
                // Clear Summoning Sickness and Untap
                newBattlefield = state.zones.battlefield.map(c => ({
                    ...c,
                    tapped: false,
                    summoningSickness: false
                }));
            }

            return withHistory(state, {
                ...state,
                turn: {
                    count: nextTurnCount,
                    phase: nextPhase,
                    landsPlayed: newLandsPlayed
                },
                manaPool: emptyManaPool,
                ui: { ...state.ui, error: null },
                zones: {
                    ...state.zones,
                    battlefield: newBattlefield
                }
            });
        }

        case 'ADD_MANA': {
            const { color } = action.payload; // 'w', 'u', etc.
            return withHistory(state, {
                ...state,
                ui: { ...state.ui, error: null },
                manaPool: {
                    ...state.manaPool,
                    [color]: state.manaPool[color] + 1
                }
            });
        }

        case 'SPEND_MANA': {
            const { color } = action.payload;
            if (state.manaPool[color] <= 0) return state;
            return withHistory(state, {
                ...state,
                ui: { ...state.ui, error: null },
                manaPool: {
                    ...state.manaPool,
                    [color]: state.manaPool[color] - 1
                }
            });
        }

        case 'UNTAP_ALL': {
            const newBattlefield = state.zones.battlefield.map(c => ({ ...c, tapped: false }));
            // Also untap mana rocks/lands in other implementation details if needed
            return withHistory(state, {
                ...state,
                zones: {
                    ...state.zones,
                    battlefield: newBattlefield
                }
            });
        }

        case 'SHUFFLE_LIBRARY': {
            return withHistory(state, {
                ...state,
                zones: {
                    ...state.zones,
                    library: shuffle([...state.zones.library])
                }
            });
        }

        case 'SET_LIFE': {
            return withHistory(state, {
                ...state,
                counters: {
                    ...state.counters,
                    life: action.payload
                }
            });
        }

        case 'MULLIGAN': {
            // Shuffle hand into library, then draw 7
            const currentHand = state.zones.hand.map(c => ({ ...c, faceDown: true, tapped: false, counters: { p1p1: 0, loyalty: 0, other: 0 } }));
            const currentLibrary = [...state.zones.library, ...currentHand];
            const shuffledLibrary = shuffle(currentLibrary);

            const newHand = [];
            for (let i = 0; i < 7; i++) {
                if (shuffledLibrary.length > 0) {
                    const card = shuffledLibrary.pop();
                    card.faceDown = false;
                    newHand.push(card);
                }
            }

            return withHistory(state, {
                ...state,
                turn: { ...state.turn, landsPlayed: 0 },
                ui: { ...state.ui, error: null },
                zones: {
                    ...state.zones,
                    hand: newHand,
                    library: shuffledLibrary
                }
            });
        }

        case 'RESTART_GAME': {
            const allCards = [
                ...state.zones.hand,
                ...state.zones.battlefield,
                ...state.zones.graveyard,
                ...state.zones.exile
            ].map(c => ({ ...c, tapped: false, faceDown: true, counters: { p1p1: 0, loyalty: 0, other: 0 } }));

            const newLibrary = shuffle([...state.zones.library, ...allCards]);
            // Draw 7
            const newHand = [];
            for (let i = 0; i < 7; i++) {
                if (newLibrary.length > 0) {
                    const card = newLibrary.pop();
                    card.faceDown = false;
                    newHand.push(card);
                }
            }

            return {
                ...INITIAL_STATE,
                zones: {
                    ...INITIAL_STATE.zones,
                    library: newLibrary,
                    hand: newHand,
                    battlefield: [],
                    graveyard: [],
                    exile: [],
                    command: state.zones.command.map(c => ({ ...c, tapped: false, counters: { p1p1: 0, loyalty: 0, other: 0 } })) // Reset commanders
                },
                commanderTax: state.zones.command.reduce((acc, c) => ({ ...acc, [c.instanceId]: 0 }), {})
            };
        }

        case 'ADD_COUNTER': {
            const { cardId, zone, counterType, amount = 1 } = action.payload;
            return withHistory(state, {
                ...state,
                zones: {
                    ...state.zones,
                    [zone]: state.zones[zone].map(c =>
                        c.instanceId === cardId
                            ? { ...c, counters: { ...c.counters, [counterType]: (c.counters[counterType] || 0) + amount } }
                            : c
                    )
                }
            });
        }

        case 'REMOVE_COUNTER': {
            const { cardId, zone, counterType, amount = 1 } = action.payload;
            return withHistory(state, {
                ...state,
                zones: {
                    ...state.zones,
                    [zone]: state.zones[zone].map(c =>
                        c.instanceId === cardId
                            ? { ...c, counters: { ...c.counters, [counterType]: Math.max(0, (c.counters[counterType] || 0) - amount) } }
                            : c
                    )
                }
            });
        }

        case 'CREATE_TOKEN': {
            const { tokenData } = action.payload;
            const token = {
                ...tokenData,
                instanceId: uuidv4(),
                tapped: false,
                faceDown: false,
                isToken: true,
                counters: { p1p1: 0, loyalty: 0, other: 0 }
            };
            return withHistory(state, {
                ...state,
                zones: {
                    ...state.zones,
                    battlefield: [...state.zones.battlefield, token]
                }
            });
        }

        case 'SET_LIFE': {
            return withHistory(state, {
                ...state,
                counters: {
                    ...state.counters,
                    life: action.payload
                }
            });
        }

        default:
            return state;
    }
}

// Fisher-Yates shuffle
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
    return array;
}

export function useGameState() {
    const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);

    const loadDeck = useCallback((deck) => dispatch({ type: 'LOAD_DECK', payload: deck }), []);
    const drawCard = useCallback((count = 1) => dispatch({ type: 'DRAW_CARD', payload: { count } }), []);
    const moveCard = useCallback((cardId, fromZone, toZone, index, position) => dispatch({ type: 'MOVE_CARD', payload: { cardId, fromZone, toZone, index, position } }), []);
    const tapCard = useCallback((cardId, zone) => dispatch({ type: 'TAP_CARD', payload: { cardId, zone } }), []);
    const untapAll = useCallback(() => dispatch({ type: 'UNTAP_ALL' }), []);
    const shuffleLibrary = useCallback(() => dispatch({ type: 'SHUFFLE_LIBRARY' }), []);
    const setLife = useCallback((amount) => dispatch({ type: 'SET_LIFE', payload: amount }), []);
    const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
    const mulligan = useCallback(() => dispatch({ type: 'MULLIGAN' }), []);
    const restartGame = useCallback(() => dispatch({ type: 'RESTART_GAME' }), []);
    const nextPhase = useCallback(() => dispatch({ type: 'NEXT_PHASE' }), []);
    const addMana = useCallback((color) => dispatch({ type: 'ADD_MANA', payload: { color } }), []);
    const spendMana = useCallback((color) => dispatch({ type: 'SPEND_MANA', payload: { color } }), []);
    const addCounter = useCallback((cardId, zone, counterType, amount) => dispatch({ type: 'ADD_COUNTER', payload: { cardId, zone, counterType, amount } }), []);
    const removeCounter = useCallback((cardId, zone, counterType, amount) => dispatch({ type: 'REMOVE_COUNTER', payload: { cardId, zone, counterType, amount } }), []);
    const createToken = useCallback((tokenData) => dispatch({ type: 'CREATE_TOKEN', payload: { tokenData } }), []);

    const actions = useMemo(() => ({
        loadDeck,
        drawCard,
        moveCard,
        tapCard,
        untapAll,
        shuffleLibrary,
        setLife,
        undo,
        mulligan,
        restartGame,
        nextPhase,
        addMana,
        spendMana,
        addCounter,
        removeCounter,
        createToken
    }), [
        loadDeck, drawCard, moveCard, tapCard, untapAll, shuffleLibrary, setLife,
        undo, mulligan, restartGame, nextPhase, addMana, spendMana, addCounter,
        removeCounter, createToken
    ]);

    return { state, actions };
}
