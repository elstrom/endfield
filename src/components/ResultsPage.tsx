import { useState } from "react";
import { ChevronLeft, Zap, TrendingUp, Layers, MousePointer2, Plus } from "lucide-react";

interface LayoutCandidate {
    id: string;
    facilities: Array<{
        facility_id: string;
        x: number;
        y: number;
        rotation: number;
    }>;
    score: number;
    power_consumption: number;
    items_per_hour: Record<string, number>;
    efficiency: number;
}

interface ResultsPageProps {
    layouts: LayoutCandidate[];
    onBack: () => void;
}

export function ResultsPage({ layouts, onBack }: ResultsPageProps) {
    const [selectedLayout, setSelectedLayout] = useState<LayoutCandidate | null>(
        layouts[0] || null
    );

    return (
        <div className="w-screen h-screen bg-[#f8fafc] flex flex-col text-slate-900">
            {/* Header */}
            <div className="px-10 py-6 bg-white border-b border-slate-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <button
                            onClick={onBack}
                            className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl transition-all active:scale-95"
                        >
                            <ChevronLeft className="text-slate-600" size={20} />
                        </button>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                                <Zap className="text-brand" size={20} fill="currentColor" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase italic">
                                    Optimal Layout Rankings
                                </h1>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Select candidate to preview</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 px-5 py-2 bg-slate-50 rounded-full border border-slate-100">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            {layouts.length} Candidates Solved
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - Ranked Candidates */}
                <div className="w-96 bg-white border-r border-slate-200 flex flex-col">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                            Evaluation Results
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {layouts.map((layout, index) => (
                            <button
                                key={layout.id}
                                onClick={() => setSelectedLayout(layout)}
                                className={`w-full text-left p-6 rounded-3xl border transition-all relative overflow-hidden group ${selectedLayout?.id === layout.id
                                        ? "bg-slate-900 border-slate-900 shadow-xl shadow-slate-200 scale-[1.02] z-10"
                                        : "bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50/50"
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-4 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${selectedLayout?.id === layout.id
                                                    ? "bg-brand text-white"
                                                    : "bg-slate-100 text-slate-400"
                                                }`}
                                        >
                                            {index + 1}
                                        </div>
                                        <div className={`text-[10px] font-black uppercase tracking-widest ${selectedLayout?.id === layout.id ? "text-slate-400" : "text-slate-300"
                                            }`}>
                                            Layout Node
                                        </div>
                                    </div>
                                    <div
                                        className={`text-[10px] font-mono font-bold ${selectedLayout?.id === layout.id
                                                ? "text-brand"
                                                : "text-slate-400"
                                            }`}
                                    >
                                        SCORE {layout.score.toFixed(1)}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 relative z-10">
                                    <div className="space-y-1">
                                        <div className={`text-[8px] font-black uppercase tracking-widest ${selectedLayout?.id === layout.id ? "text-slate-500" : "text-slate-400"
                                            }`}>Efficiency</div>
                                        <div className={`font-mono text-sm font-black ${selectedLayout?.id === layout.id ? "text-white" : "text-slate-700"
                                            }`}>{(layout.efficiency * 100).toFixed(1)}%</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className={`text-[8px] font-black uppercase tracking-widest ${selectedLayout?.id === layout.id ? "text-slate-500" : "text-slate-400"
                                            }`}>Power</div>
                                        <div className={`font-mono text-sm font-black ${selectedLayout?.id === layout.id ? "text-brand" : "text-slate-700"
                                            }`}>{layout.power_consumption.toFixed(0)}W</div>
                                    </div>
                                </div>

                                {selectedLayout?.id === layout.id && (
                                    <div className="absolute right-0 top-0 h-full w-1 bg-brand" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Inspection Panel */}
                <div className="flex-1 bg-slate-50/50 p-10 overflow-y-auto">
                    {selectedLayout ? (
                        <div className="max-w-5xl mx-auto">
                            {/* Analytics Grid */}
                            <div className="grid grid-cols-3 gap-6 mb-10">
                                <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-brand/10 rounded-2xl">
                                            <Zap className="text-brand" size={20} fill="currentColor" />
                                        </div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Power Consumption
                                        </div>
                                    </div>
                                    <div className="text-4xl font-black font-mono text-slate-900">
                                        {selectedLayout.power_consumption.toFixed(0)}
                                        <span className="text-sm text-slate-300 ml-2">W</span>
                                    </div>
                                </div>

                                <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-green-500/10 rounded-2xl">
                                            <TrendingUp className="text-green-500" size={20} />
                                        </div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Route Efficiency
                                        </div>
                                    </div>
                                    <div className="text-4xl font-black font-mono text-green-500">
                                        {(selectedLayout.efficiency * 100).toFixed(1)}
                                        <span className="text-sm text-green-500/30 ml-2">%</span>
                                    </div>
                                </div>

                                <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-slate-900/5 rounded-2xl">
                                            <Layers className="text-slate-900" size={20} />
                                        </div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Facility Count
                                        </div>
                                    </div>
                                    <div className="text-4xl font-black font-mono text-slate-900">
                                        {selectedLayout.facilities.length}
                                        <span className="text-sm text-slate-300 ml-2">Units</span>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Statistics */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8">
                                        Production Capacity
                                    </h3>
                                    <div className="space-y-4">
                                        {Object.entries(selectedLayout.items_per_hour).map(
                                            ([itemId, rate]) => (
                                                <div
                                                    key={itemId}
                                                    className="flex items-center justify-between border-b border-slate-50 pb-4 last:border-0"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2 h-2 rounded-full bg-brand" />
                                                        <span className="text-slate-900 font-bold">{itemId}</span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-slate-900 font-mono font-black text-sm">
                                                            {rate.toFixed(1)}/h
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 uppercase font-bold">
                                                            {(rate / 60).toFixed(2)} per minute
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>

                                <div className="bg-slate-900 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group">
                                    <div className="relative z-10 flex flex-col h-full justify-between">
                                        <div>
                                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">
                                                Topological Preview
                                            </h3>
                                            <p className="text-white/60 text-sm leading-relaxed max-w-xs font-medium">
                                                Visualisasi 2D map untuk layout terpilih. PAC diletakkan otomatis di tengah area produksi.
                                            </p>
                                        </div>

                                        <button className="mt-8 py-4 bg-brand rounded-2xl text-white font-black uppercase tracking-tight flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl shadow-brand/20">
                                            <MousePointer2 size={18} />
                                            Select & Apply Layout
                                        </button>
                                    </div>

                                    {/* Decorator */}
                                    <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-brand/5 rounded-full blur-3xl group-hover:bg-brand/10 transition-all" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-slate-300 text-center">
                                <Plus className="mx-auto mb-4 opacity-20" size={48} />
                                <div className="text-sm font-black uppercase tracking-widest">No layout selected</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
