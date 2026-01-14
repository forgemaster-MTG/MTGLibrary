import React, { useMemo } from 'react';

// Simple SVG Line Chart Component
const CombatGraph = ({ players, logs }) => {
    // Memoize the calculation to prevent re-renders
    const graphData = useMemo(() => {
        if (!logs || logs.length === 0) return null;

        // Process logs to get data points per turn
        // Start with Turn 0 (Initial Life 40)
        // Structure: { turn: number, [playerId]: life }

        // Determine Max Turn
        const maxTurn = Math.max(...logs.map(l => l.metadata?.turn || l.turn || 0), 0) + 1; // +1 to show current state

        // Determine Player Colors (preset palette)
        // If players already have color assignments, use them? For now, index based.
        const colors = ['#6366f1', '#ec4899', '#22c55e', '#eab308', '#ef4444', '#3b82f6'];
        const playerColorMap = {};
        players.forEach((p, idx) => {
            playerColorMap[p.id] = colors[idx % colors.length];
        });

        // Build data map: turn -> { [playerId]: life }
        // Initialize turn 0
        const turnData = {
            0: {}
        };
        players.forEach(p => turnData[0][p.id] = 40);

        // Initial simulation state
        let currentLife = {};
        players.forEach(p => currentLife[p.id] = 40);

        // Sort logs by time
        const sortedLogs = [...logs].sort((a, b) => new Date(a.created_at || a.timestamp) - new Date(b.created_at || b.timestamp));

        // Iterate through logs
        sortedLogs.forEach(log => {
            if (log.type === 'life' || log.action_type === 'life') {
                const pid = log.playerId || log.actor_participant_id;

                if (pid) {
                    // Use absolute if available (socket logs have it as currentLife, DB logs might store it in metadata)
                    // Socket log: log.currentLife
                    // DB log: log.metadata.currentLife
                    const absoluteLife = log.currentLife ?? log.metadata?.currentLife;

                    if (absoluteLife !== undefined) {
                        currentLife[pid] = absoluteLife;
                    } else {
                        currentLife[pid] = (currentLife[pid] || 40) + (log.change || log.value || 0);
                    }
                }
            }

            // Capture state at this log's turn
            const turn = log.turn || log.metadata?.turn || 1;
            if (!turnData[turn]) turnData[turn] = {};

            // Update the snapshot for this turn with current running totals
            players.forEach(p => {
                turnData[turn][p.id] = currentLife[p.id];
            });
        });

        // Generate points for SVG
        const playerPoints = {};
        players.forEach(p => playerPoints[p.id] = []);

        let minLife = 0;
        let maxLife = 45;

        // Fill gaps - ensure every turn up to maxTurn has a point (conceptually)
        // Actually, SVG just needs points where values change or at turn boundaries.
        // We will plot distinct points for each turn we have data for.

        // Better approach: Points at integer turns + final. 
        // Or just points at every logged turn.

        Object.keys(turnData).forEach(turnStr => {
            const turn = parseInt(turnStr);
            players.forEach(p => {
                // If data exists for this turn, plot it.
                // If not, it means no logs for this turn yet? Or just carry over?
                // The loop above only creates keys for turns encountered in logs.
                // We should backfill gaps to make lines continuous?
                // SVG lines connect points, so we just need ordered points.

                let life = turnData[turn][p.id];
                if (life === undefined) {
                    // Check if previous turn existed?
                    // Simplification: just plot what we have.
                    return;
                }

                playerPoints[p.id].push({ x: turn, y: life });
                if (life > maxLife) maxLife = life;
                if (life < minLife) minLife = life;
            });
        });

        // Ensure final state is plotted for maxTurn
        players.forEach(p => {
            const pPoints = playerPoints[p.id];
            // If they have no points, add start point
            if (pPoints.length === 0) pPoints.push({ x: 0, y: 40 });

            // Check final point
            const lastPoint = pPoints[pPoints.length - 1];
            // If last point isn't at maxTurn, add one holding the value
            // (Stepchart style or Line style? Line style implies interpolation. Magic life is discrete steps.)
            // But usually we just connect the dots.
            if (lastPoint.x < maxTurn) {
                // Use their current final life
                pPoints.push({ x: maxTurn, y: currentLife[p.id] });
            }

            // Re-check bounds
            const finalLife = currentLife[p.id];
            if (finalLife > maxLife) maxLife = finalLife;
            if (finalLife < minLife) minLife = finalLife;
        });


        return { playerPoints, minLife, maxLife, maxTurn, playerColorMap, finalLife: currentLife };
    }, [players, logs]);

    if (!graphData) return null;
    const { playerPoints, minLife, maxLife, maxTurn, playerColorMap, finalLife } = graphData;

    // SVG Dimensions & Layout
    const width = 300; // Increased internal resolution
    const height = 150;
    const padding = { top: 10, right: 10, bottom: 20, left: 25 }; // Explicit padding for axis labels
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    // Helper to map data to SVG coordinates
    const mapX = (turn) => padding.left + ((turn / (maxTurn - 1 || 1)) * innerWidth);
    const mapY = (life) => {
        const range = maxLife - minLife || 1;
        return padding.top + innerHeight - (((life - minLife) / range) * innerHeight);
    };

    // Generate Axis Ticks
    const xTicks = Array.from({ length: maxTurn }, (_, i) => i);
    const yTicks = (() => {
        const ticks = [];
        const range = maxLife - minLife;
        const step = range > 20 ? 10 : 5;
        for (let v = Math.ceil(minLife / step) * step; v <= maxLife; v += step) {
            ticks.push(v);
        }
        if (!ticks.includes(minLife)) ticks.unshift(minLife);
        if (!ticks.includes(maxLife)) ticks.push(maxLife);
        return [...new Set(ticks)].sort((a, b) => a - b);
    })();

    return (
        <div className="w-full h-full flex flex-col relative">
            {/* Legend - Moved outside SVG for better text rendering */}
            <div className="flex flex-wrap gap-3 absolute top-2 right-2 z-10 pointer-events-none">
                {players.map(p => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded backdrop-blur-md border border-white/10 shadow-sm">
                        <div className="w-2 h-2 rounded-full shadow-[0_0_5px]" style={{ backgroundColor: playerColorMap[p.id], boxShadow: `0 0 5px ${playerColorMap[p.id]}` }} />
                        <span className="text-[10px] text-gray-200 font-bold leading-none">
                            {p.name}: <span className="text-white">{finalLife[p.id] ?? '?'}</span>
                        </span>
                    </div>
                ))}
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible font-mono select-none">
                {/* Grid & Axis */}
                <g className="opacity-20">
                    {/* Y Axis Grid */}
                    {yTicks.map(val => (
                        <line
                            key={`y-${val}`}
                            x1={padding.left}
                            y1={mapY(val)}
                            x2={width - padding.right}
                            y2={mapY(val)}
                            stroke="currentColor"
                            strokeWidth="0.5"
                            strokeDasharray="2"
                            className="text-gray-500"
                        />
                    ))}
                    {/* X Axis Grid */}
                    {xTicks.map(val => (
                        <line
                            key={`x-${val}`}
                            x1={mapX(val)}
                            y1={padding.top}
                            x2={mapX(val)}
                            y2={height - padding.bottom}
                            stroke="currentColor"
                            strokeWidth="0.5"
                            className="text-gray-500"
                        />
                    ))}
                </g>

                {/* Axis Labels */}
                <g className="text-[8px] fill-gray-500 font-medium">
                    {/* Y Axis Labels */}
                    {yTicks.map(val => (
                        <text key={`yl-${val}`} x={padding.left - 4} y={mapY(val)} dy="0.3em" textAnchor="end">
                            {val}
                        </text>
                    ))}
                    {/* X Axis Labels */}
                    {xTicks.map(val => (
                        <text key={`xl-${val}`} x={mapX(val)} y={height - padding.bottom + 10} textAnchor="middle">
                            {val}
                        </text>
                    ))}
                </g>

                {/* Player Lines */}
                {players.map(p => {
                    const points = playerPoints[p.id];
                    if (!points || points.length === 0) return null;

                    const d = points.map((pt, i) =>
                        `${i === 0 ? 'M' : 'L'} ${mapX(pt.x)} ${mapY(pt.y)}`
                    ).join(' ');

                    return (
                        <g key={p.id}>
                            <path
                                d={d}
                                fill="none"
                                stroke={playerColorMap[p.id]}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="drop-shadow-md vector-effect-non-scaling-stroke"
                            />
                            {/* Points */}
                            {points.map((pt, i) => (
                                <circle
                                    key={i}
                                    cx={mapX(pt.x)}
                                    cy={mapY(pt.y)}
                                    r="1.5"
                                    fill={playerColorMap[p.id]}
                                    stroke="black"
                                    strokeWidth="0.5"
                                />
                            ))}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

export default CombatGraph;
