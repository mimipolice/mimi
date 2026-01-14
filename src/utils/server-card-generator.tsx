/** @jsxImportSource react */
import React from 'react';
import { ImageResponse } from '@takumi-rs/image-response';
import {
    Crown,
    Globe,
    Eye,
    Lock,
    Calendar,
    Users,
    Gem,
    Smile,
    Hash,
    ShieldCheck,
    Check
} from 'lucide-react';

// ============================================
// Interfaces
// ============================================

export interface ServerData {
    id: string;
    name: string;
    iconUrl: string;
    bannerUrl: string;
    owner: string;
    description: string;
    vanityUrl?: string;
    isVerified?: boolean;
    tags: string[];
    specs: {
        locale: string;
        verificationLevel: string;
        nsfwLevel: string;
        createdDate: string;
    };
    stats: {
        members: number;
        online: number;
        boosts: number;
        boostLevel: number;
        assets: {
            emojis: number;
            stickers: number;
        };
        structure: {
            channels: number;
            roles: number;
        };
    };
}

// ============================================
// Helper Components & Logic
// ============================================

const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
};

// Simplified GlowCard without interactivity for static image generation
const GlowCard = ({
    children,
    glowClass,
    className = "",
}: {
    children: React.ReactNode;
    glowClass: string;
    className?: string;
}) => {
    return (
        <div
            tw={`relative overflow-hidden rounded-2xl border border-white/5 bg-[#2a2b35] p-5 flex flex-col ${className}`}
            style={{
                background: 'linear-gradient(135deg, rgba(42,43,53,0.9), rgba(30,31,38,0.9))',
                boxShadow: '0 10px 20px -5px rgba(0,0,0,0.4)'
            }}
        >
            <div tw="absolute inset-x-0 top-0 h-[1px] bg-white/30 opacity-60 z-20" />

            {/* Static Glow Effect */}
            <div
                tw={`absolute rounded-full opacity-60 ${glowClass}`}
                style={{
                    left: '90%',
                    top: '10%',
                    transform: 'translate(-50%, -50%)',
                }}
            />

            <div tw="relative z-10 flex flex-col h-full justify-between">
                {children}
            </div>
        </div>
    );
};

const ServerCard = ({ data }: { data: ServerData }) => {
    // Shared classes
    const cardHighlight = "absolute inset-x-0 top-0 h-[1px] bg-white/30 opacity-60 z-20";

    return (
        <div
            tw="flex flex-col w-full h-full bg-[#0b0c15] text-white font-sans relative overflow-hidden"
            style={{
                background: 'linear-gradient(to bottom, #1c1d25, #0b0c15)',
            }}
        >
            {/* Top Banner Section */}
            <div tw="flex relative w-full h-64 overflow-hidden">
                <img
                    src={data.bannerUrl}
                    alt="Banner"
                    tw="absolute inset-0 w-full h-full object-cover"
                />
                <div
                    tw="absolute inset-0 bg-black/40"
                    style={{
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent, #1c1d25)'
                    }}
                />

                {/* Top Badges */}
                <div tw="absolute top-6 left-6 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full border border-white/10">
                    <Hash size={12} color="#9ca3af" />
                    <span tw="text-gray-300 text-xs font-mono ml-2">{data.id}</span>
                </div>

                {data.isVerified && (
                    <div tw="absolute top-6 right-6 flex items-center gap-1.5 bg-green-600/90 text-white px-3 py-1.5 rounded-lg border border-white/10">
                        <Check size={14} strokeWidth={4} color="white" />
                        <span tw="text-xs font-bold uppercase ml-1">Verified</span>
                    </div>
                )}
            </div>

            {/* Main Content Body */}
            <div tw="flex flex-col px-8 pb-8 -mt-10 relative z-10 w-full">

                {/* Header: Icon & Title */}
                <div tw="flex flex-row gap-6 items-start mb-10 w-full">
                    <div tw="flex relative shrink-0">
                        {/* Icon Container */}
                        <div tw="flex w-36 h-36 rounded-[2.5rem] p-1.5 bg-[#161720] shadow-2xl relative -mt-16 border border-white/5">
                            <img
                                src={data.iconUrl}
                                alt="Server Icon"
                                tw="w-full h-full rounded-[2rem] object-cover bg-[#1e1f26]"
                            />
                        </div>
                        {/* Online Status Dot */}
                        <div tw="absolute bottom-2 -right-1 w-8 h-8 bg-green-500 rounded-full border-[6px] border-[#161720]" />
                    </div>

                    <div tw="flex flex-col flex-1 mt-4 ml-6">
                        <h1 tw="text-4xl font-black text-white mb-3 tracking-tight drop-shadow-lg m-0">{data.name}</h1>
                        <div tw="flex flex-row items-center gap-4 text-sm font-medium">
                            <div tw="flex items-center gap-1.5 bg-[#2b2d31] px-3 py-1.5 rounded-lg border border-white/5 mr-4">
                                <Crown size={14} color="#fbbf24" />
                                <span tw="text-gray-400 mx-1">Owner:</span>
                                <span tw="text-white">{data.owner}</span>
                            </div>
                            {data.vanityUrl && (
                                <div tw="flex items-center gap-1.5 text-blue-400 px-2 py-1 rounded">
                                    <Globe size={16} color="#60a5fa" />
                                    <span tw="ml-1">{data.vanityUrl}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content Grid: About & Specs */}
                <div tw="flex flex-row gap-8 mb-8 w-full">

                    {/* Left Column: About */}
                    <div tw="flex flex-col flex-[2] space-y-4">
                        <div tw="flex items-center gap-2 mb-2 pl-1">
                            <Eye size={14} color="#949BA4" />
                            <span tw="text-xs font-bold text-[#949BA4] uppercase tracking-widest ml-2">About Server</span>
                        </div>

                        <div tw="flex flex-col relative rounded-2xl border border-white/5 bg-[#23242d] p-6 shadow-lg mb-4">
                            <div className={cardHighlight} />
                            <div tw="text-gray-300 leading-relaxed whitespace-pre-line relative z-10 font-medium text-sm">
                                {data.description}
                            </div>
                        </div>

                        <div tw="flex flex-wrap gap-2 pt-2">
                            {data.tags.map((tag, idx) => (
                                <span key={idx} tw="px-3 py-1.5 bg-[#202228] text-xs font-bold text-gray-300 rounded-md uppercase border border-white/5 border-b-black/50 mr-2 mb-2">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Specs */}
                    <div tw="flex flex-col flex-1 space-y-4 ml-8">
                        <div tw="flex items-center gap-2 mb-2 pl-1">
                            <Lock size={14} color="#949BA4" />
                            <span tw="text-xs font-bold text-[#949BA4] uppercase tracking-widest ml-2">Specs & Safety</span>
                        </div>

                        <div tw="flex flex-col rounded-2xl border border-white/5 bg-[#23242d] overflow-hidden shadow-lg">
                            <div tw="flex flex-col p-5 gap-y-5 text-sm relative">
                                <div className={cardHighlight} />

                                <div tw="flex justify-between items-center mb-4">
                                    <span tw="text-[#949BA4] font-medium">Locale</span>
                                    <span tw="bg-[#0b0c15]/50 px-2 py-1 rounded text-white font-mono text-xs border border-white/10">{data.specs.locale}</span>
                                </div>

                                <div tw="flex justify-between items-center mb-4">
                                    <span tw="text-[#949BA4] font-medium">Verification</span>
                                    <div tw="flex items-center gap-1.5 text-green-400 font-bold">
                                        <ShieldCheck size={14} color="#4ade80" />
                                        <span tw="ml-1">{data.specs.verificationLevel}</span>
                                    </div>
                                </div>

                                <div tw="flex justify-between items-center">
                                    <span tw="text-[#949BA4] font-medium">NSFW Level</span>
                                    <span tw="text-white font-bold">{data.specs.nsfwLevel}</span>
                                </div>
                            </div>

                            <div tw="bg-[#15161c] px-5 py-3 border-t border-white/5 flex items-center gap-2 text-xs text-[#949BA4] relative">
                                <Calendar size={12} color="#949BA4" />
                                <span tw="ml-2">Created {data.specs.createdDate}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Stats Grid */}
                <div tw="flex flex-row gap-4 w-full">

                    {/* Members Card */}
                    <GlowCard glowClass="w-32 h-32 bg-blue-500 blur-[50px]" className="w-1/4">
                        <div tw="flex items-center gap-2 mb-2 relative z-10">
                            <Users size={14} color="#949BA4" />
                            <span tw="text-xs font-bold text-[#949BA4] uppercase ml-2">Members</span>
                        </div>
                        <div tw="text-2xl font-extrabold text-white mb-1 relative z-10">
                            {formatNumber(data.stats.members)}
                        </div>
                        <div tw="flex items-center gap-2 text-xs text-green-400 font-medium relative z-10">
                            <div tw="w-2.5 h-2.5 bg-green-500 rounded-full mr-2" />
                            {formatNumber(data.stats.online)} Online
                        </div>
                    </GlowCard>

                    {/* Boosts Card */}
                    <GlowCard
                        glowClass="w-40 h-40 bg-[#f47fff] opacity-15 blur-[50px]"
                        className="w-1/4 border-t-white/20"
                    >
                        <div tw="flex flex-col relative z-10 h-full">
                            <div tw="flex items-center gap-2 mb-2">
                                <Gem size={14} color="#949BA4" />
                                <span tw="text-xs font-bold text-[#949BA4] uppercase ml-2">Boosts</span>
                            </div>
                            <div tw="text-2xl font-extrabold text-white mb-3">
                                {data.stats.boosts}
                            </div>

                            <div tw="flex mt-auto">
                                <span tw="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide text-[#f47fff] bg-[#f47fff]/10 border border-[#f47fff]/30">
                                    Level {data.stats.boostLevel}
                                </span>
                            </div>
                        </div>
                    </GlowCard>

                    {/* Assets Card */}
                    <GlowCard glowClass="w-32 h-32 bg-yellow-500 blur-[50px]" className="w-1/4">
                        <div tw="flex items-center gap-2 mb-3 relative z-10">
                            <Smile size={14} color="#949BA4" />
                            <span tw="text-xs font-bold text-[#949BA4] uppercase ml-2">Assets</span>
                        </div>
                        <div tw="flex justify-between items-end relative z-10 w-full mt-auto">
                            <div tw="flex flex-col">
                                <div tw="text-2xl font-extrabold text-white">{data.stats.assets.emojis}</div>
                                <div tw="text-xs text-[#949BA4] mt-0.5 font-medium">Emojis</div>
                            </div>
                            <div tw="flex flex-col items-end">
                                <div tw="text-2xl font-extrabold text-white">{data.stats.assets.stickers}</div>
                                <div tw="text-xs text-[#949BA4] mt-0.5 font-medium">Stickers</div>
                            </div>
                        </div>
                    </GlowCard>

                    {/* Structure Card */}
                    <GlowCard glowClass="w-32 h-32 bg-gray-500 blur-[50px]" className="w-1/4">
                        <div tw="flex items-center gap-2 mb-3 relative z-10">
                            <Hash size={14} color="#949BA4" />
                            <span tw="text-xs font-bold text-[#949BA4] uppercase ml-2">Structure</span>
                        </div>
                        <div tw="flex justify-between items-end relative z-10 w-full mt-auto">
                            <div tw="flex flex-col">
                                <div tw="text-2xl font-extrabold text-white">{data.stats.structure.channels}</div>
                                <div tw="text-xs text-[#949BA4] mt-0.5 font-medium">Channels</div>
                            </div>
                            <div tw="flex flex-col items-end">
                                <div tw="text-2xl font-extrabold text-white">{data.stats.structure.roles}</div>
                                <div tw="text-xs text-[#949BA4] mt-0.5 font-medium">Roles</div>
                            </div>
                        </div>
                    </GlowCard>

                </div>
            </div>

            {/* Bottom Gradient Line */}
            <div tw="absolute bottom-0 left-0 right-0 h-[2px] bg-[#5865F2] opacity-80 z-20" />
        </div>
    );
};

// ============================================
// Main Export Function
// ============================================

export async function generateServerCard(data: ServerData): Promise<Buffer> {
    // Use a fixed size that accommodates the layout
    const width = 1000;
    const height = 750;

    const response = new ImageResponse(
        <ServerCard data={data} />,
        {
            width,
            height,
            format: "png",
            // Optional: Add custom fonts here if needed
            // fonts: [...]
        }
    );

    return Buffer.from(await response.arrayBuffer());
}
