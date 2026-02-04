import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Trophy, Gem, Swords, Layers, ExternalLink, Sparkles } from 'lucide-react';

const SocialCardPreview = ({ type, data, shareUrl, cardRef }) => {
    // Branding Colors (Safe HEX Gradients)
    const branding = {
        vault: 'linear-gradient(to bottom right, #fbbf24, #f59e0b, #d97706)',
        deck: 'linear-gradient(to bottom right, #a855f7, #6366f1, #2563eb)',
        binder: 'linear-gradient(to bottom right, #10b981, #14b8a6, #0891b2)',
        stats: 'linear-gradient(to bottom right, #f43f5e, #f97316, #f59e0b)',
        card: 'linear-gradient(to bottom right, #60a5fa, #6366f1, #9333ea)'
    };

    const gradient = branding[type] || branding.deck;

    const textGray400 = '#9ca3af';
    const textGray500 = '#6b7280';
    const borderWhite10 = '1px solid rgba(255, 255, 255, 0.1)';
    const bgGray900_60 = 'rgba(17, 24, 39, 0.40)'; // More transparent to show background

    return (
        <div
            ref={cardRef}
            style={{
                width: '1200px',
                height: '630px',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px',
                userSelect: 'none',
                fontFamily: "'Inter', sans-serif",
                backgroundColor: '#030712'
            }}
        >
            {/* Background Image - MTG Forge Fixed */}
            <img
                src="/MTG-Forge_Logo_Background.png"
                crossOrigin="anonymous"
                alt=""
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: 0.8, // Increased visibility
                    filter: 'blur(0px)' // Keep it crisp or maybe slight blur? User said "background", usually implies clarity or texture.
                }}
            />

            {/* CSS Noise Texture (CORS Safe) */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.03,
                    pointerEvents: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                }}
            />

            {/* Main Content Card */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    backdropFilter: 'blur(64px)',
                    WebkitBackdropFilter: 'blur(64px)',
                    borderRadius: '48px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    backgroundColor: bgGray900_60,
                    border: borderWhite10,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}
            >

                {/* Header / Branding */}
                <div
                    style={{
                        padding: '40px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                        <div
                            style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundImage: gradient,
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                            }}
                        >
                            {type === 'vault' && <Gem size={40} style={{ color: '#ffffff' }} />}
                            {type === 'deck' && <Layers size={40} style={{ color: '#ffffff' }} />}
                            {type === 'binder' && <Layers size={40} style={{ color: '#ffffff' }} />}
                            {type === 'stats' && <Trophy size={40} style={{ color: '#ffffff' }} />}
                            {type === 'card' && <Sparkles size={40} style={{ color: '#ffffff' }} />}
                        </div>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            padding: '12px 24px',
                            backgroundColor: 'rgba(0, 0, 0, 0.4)',
                            borderRadius: '16px',
                            backdropFilter: 'blur(4px)'
                        }}>
                            <h2
                                style={{
                                    fontSize: '48px',
                                    fontWeight: 900,
                                    color: '#ffffff',
                                    letterSpacing: '-0.05em',
                                    textTransform: 'uppercase',
                                    fontStyle: 'italic',
                                    margin: 0,
                                    lineHeight: 1,
                                    textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                                }}
                            >
                                MTG <span style={{ color: '#9ca3af' }}>FORGE</span>
                            </h2>
                            <p
                                style={{
                                    fontSize: '20px',
                                    fontWeight: 500,
                                    letterSpacing: '0.2em',
                                    textTransform: 'uppercase',
                                    marginTop: '4px',
                                    margin: 0,
                                    color: textGray400,
                                    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                                }}
                            >
                                Advanced Collector Intelligence
                            </p>
                        </div>
                    </div>

                    {/* Win Callout */}
                    {data.win && (
                        <div
                            style={{
                                padding: '12px 32px',
                                borderRadius: '9999px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                border: borderWhite10,
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                            }}
                        >
                            <SparkleIcon size={24} style={{ color: '#fbbf24' }} />
                            <span
                                style={{
                                    fontSize: '24px',
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    fontStyle: 'italic',
                                    letterSpacing: '-0.025em',
                                    color: '#ffffff'
                                }}
                            >
                                {data.win}
                            </span>
                        </div>
                    )}
                </div>

                {/* Body Content */}
                <div
                    style={{
                        flex: 1,
                        padding: '48px',
                        display: 'flex',
                        gap: '64px',
                        alignItems: 'center'
                    }}
                >
                    {/* Data Section */}
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px', // Reduced from 32px to fit content
                        padding: '24px', // Reduced from 32px to fit content
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        borderRadius: '32px',
                        backdropFilter: 'blur(4px)'
                    }}>
                        <div>
                            <p
                                style={{
                                    fontSize: '14px',
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.4em',
                                    marginBottom: '16px',
                                    margin: 0,
                                    color: textGray500
                                }}
                            >
                                Sharing {type}
                            </p>
                            <h1
                                style={{
                                    fontSize: '72px',
                                    fontWeight: 900,
                                    color: '#ffffff',
                                    letterSpacing: '-0.025em',
                                    lineHeight: 1.1,
                                    margin: 0
                                }}
                            >
                                {data.title || 'Untitled'}
                            </h1>
                        </div>

                        <div style={{ display: 'flex', gap: '48px' }}>
                            {data.stats && data.stats.map((stat, i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <p
                                        style={{
                                            fontSize: '16px',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            margin: 0,
                                            color: textGray500
                                        }}
                                    >
                                        {stat.label}
                                    </p>
                                    <p
                                        style={{
                                            fontSize: '36px',
                                            fontWeight: 900,
                                            margin: 0,
                                            color: stat.highlight ? '#f59e0b' : '#ffffff'
                                        }}
                                    >
                                        {stat.value}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {type === 'deck' && data.commander && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                    padding: '24px',
                                    borderRadius: '24px',
                                    width: 'fit-content',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    border: borderWhite10
                                }}
                            >
                                {data.commanderImage && (
                                    <div
                                        style={{
                                            width: '64px',
                                            height: '64px',
                                            borderRadius: '12px',
                                            overflow: 'hidden',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                        }}
                                    >
                                        <img
                                            src={`${data.commanderImage}${data.commanderImage?.includes('?') ? '&' : '?'}cors=social_${Date.now()}`}
                                            crossOrigin="anonymous"
                                            alt=""
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                )}
                                <div>
                                    <p
                                        style={{
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.1em',
                                            marginBottom: '4px',
                                            margin: 0,
                                            color: textGray500
                                        }}
                                    >
                                        Commander
                                    </p>
                                    <h3
                                        style={{
                                            fontSize: '24px',
                                            fontWeight: 900,
                                            textTransform: 'uppercase',
                                            fontStyle: 'italic',
                                            margin: 0,
                                            color: '#ffffff'
                                        }}
                                    >
                                        {data.commander}
                                    </h3>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* QR Section */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                        {type === 'card' && data.cardImage && (
                            <div style={{ position: 'relative', marginBottom: '16px' }}>
                                <img
                                    src={`${data.cardImage}${data.cardImage?.includes('?') ? '&' : '?'}cors=social_${Date.now()}`}
                                    crossOrigin="anonymous"
                                    alt=""
                                    style={{
                                        width: '192px',
                                        borderRadius: '16px',
                                        border: '4px solid rgba(255, 255, 255, 0.1)',
                                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                                    }}
                                />
                                <div
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        borderRadius: '16px',
                                        backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)'
                                    }}
                                />
                            </div>
                        )}
                        <div
                            style={{
                                padding: '32px',
                                borderRadius: '40px',
                                backgroundColor: '#ffffff',
                                boxShadow: '0 0 60px rgba(255,255,255,0.15)',
                                border: '1px solid rgba(255, 255, 255, 0.1)'
                            }}
                        >
                            <QRCodeSVG
                                value={shareUrl}
                                size={180}
                                level="H"
                                marginSize={0}
                            />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <p
                                style={{
                                    fontSize: '18px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    justifyContent: 'center',
                                    margin: 0,
                                    color: '#ffffff'
                                }}
                            >
                                <ExternalLink size={20} style={{ color: '#ffffff' }} /> Scan to view
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Bar */}
                <div style={{ height: '16px', backgroundImage: gradient.replace('bottom right', 'to right') }} />
            </div>
        </div>
    );
};

// Helper Icon
const SparkleIcon = (props) => {
    const { size, ...rest } = props;
    return (
        <svg
            width={size}
            height={size}
            {...rest}
            fill="currentColor"
            viewBox="0 0 24 24"
        >
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
    );
};

export default SocialCardPreview;
