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
    limiting_factor?: string;
}

interface ResultsPageProps {
    layouts: LayoutCandidate[];
    onBack: () => void;
    onApply: (layout: LayoutCandidate) => void;
}

export function ResultsPage({ layouts, onBack, onApply }: ResultsPageProps) {
    const [selectedLayout, setSelectedLayout] = useState<LayoutCandidate | null>(
        layouts[0] || null
    );

    return (
        <div className="w-full h-full flex flex-col text-slate-900 overflow-hidden">
            <div className="max-w-[1400px] w-full mx-auto h-full flex bg-white/80 backdrop-blur-3xl rounded-[3rem] border border-slate-200 shadow-[0_40px_100px_rgba(0,0,0,0.1)] overflow-hidden">
                {/* Sidebar - Ranked Candidates */}
                <div className="w-96 bg-slate-50 border-r border-slate-200 flex flex-col h-full">
                    <div className="p-8 border-b border-slate-200">
                        <div className="flex items-center gap-4 mb-4">
                            <button
                                onClick={onBack}
                                className="p-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-2xl transition-all active:scale-95"
                            >
                                <ChevronLeft className="text-slate-600" size={20} />
                            </button>
                            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">
                                Solver Output
                            </h2>
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase italic">
                            Neural <span className="text-brand">Candidates</span>
                        </h1>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                        {layouts.map((layout, index) => (
                            <button
                                key={layout.id}
                                onClick={() => setSelectedLayout(layout)}
                                className={`w-full text-left p-6 rounded-3xl border transition-all relative overflow-hidden group ${selectedLayout?.id === layout.id
                                    ? "bg-slate-900 border-slate-900 shadow-xl shadow-slate-200 scale-[1.02] z-10"
                                    : "bg-white border-slate-100 hover:border-brand/30 hover:bg-white"
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

                                {/* Constraint Indicator Mini */}
                                {layout.limiting_factor && (
                                    <div className="mb-3">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${selectedLayout?.id === layout.id ? "bg-red-500/20 text-red-400" : "bg-red-50 text-red-500"}`}>
                                            Limted by {layout.limiting_factor.split(' ')[0]}
                                        </span>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4 relative z-10">
                                    <div className="space-y-1">
                                        <div className={`text-[8px] font-black uppercase tracking-widest ${selectedLayout?.id === layout.id ? "text-slate-500" : "text-slate-400"
                                            }`}>Efficiency</div>
                                        <div className={`font-mono text-sm font-black ${selectedLayout?.id === layout.id ? "text-white" : "text-slate-900"
                                            }`}>{(layout.efficiency * 10).toFixed(1)}%</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className={`text-[8px] font-black uppercase tracking-widest ${selectedLayout?.id === layout.id ? "text-slate-500" : "text-slate-400"
                                            }`}>Energy</div>
                                        <div className={`font-mono text-sm font-black ${selectedLayout?.id === layout.id ? "text-brand" : "text-slate-900"
                                            }`}>{layout.power_consumption.toFixed(0)}W</div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Inspection Panel */}
                <div className="flex-1 bg-white p-12 overflow-y-auto">
                    {selectedLayout ? (
                        <div className="max-w-4xl mx-auto">

                            {/* Constraint Visualizer */}
                            {selectedLayout.limiting_factor && (
                                <div className="mb-10 bg-red-50 border border-red-100 rounded-[2rem] p-8 flex items-start gap-6 relative overflow-hidden">
                                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0 z-10">
                                        <Layers className="text-red-500" size={24} />
                                    </div>
                                    <div className="z-10">
                                        <h3 className="text-red-900 font-black text-xl uppercase italic tracking-tighter mb-2">Throughput Constrained</h3>
                                        <p className="text-red-700/60 font-medium text-sm leading-relaxed">
                                            Production is limited by <b className="text-red-900">{selectedLayout.limiting_factor}</b>.
                                            The target rate cannot be physically achieved within the current parameters.
                                        </p>
                                    </div>
                                    {/* Background Decor */}
                                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-red-500/5 rounded-full blur-3xl"></div>
                                </div>
                            )}

                            {/* Analytics Grid */}
                            <div className="grid grid-cols-3 gap-6 mb-12">
                                <div className="bg-slate-50 rounded-[2.5rem] border border-slate-100 p-8">
                                    <div className="flex items-center gap-4 mb-4">
                                        <Zap className="text-brand" size={20} fill="currentColor" />
                                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400"> Power Consumption </div>
                                    </div>
                                    <div className="text-4xl font-black font-mono text-slate-900">
                                        {selectedLayout.power_consumption.toFixed(0)}
                                        <span className="text-sm text-slate-300 ml-2">W</span>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-[2.5rem] border border-slate-100 p-8">
                                    <div className="flex items-center gap-4 mb-4">
                                        <TrendingUp className="text-green-500" size={20} />
                                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400"> Topology Score </div>
                                    </div>
                                    <div className="text-4xl font-black font-mono text-green-500">
                                        {(selectedLayout.efficiency * 10).toFixed(1)}
                                        <span className="text-sm text-green-500/30 ml-2">%</span>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-[2.5rem] border border-slate-100 p-8">
                                    <div className="flex items-center gap-4 mb-4">
                                        <Layers className="text-slate-900" size={20} />
                                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400"> Unit Density </div>
                                    </div>
                                    <div className="text-4xl font-black font-mono text-slate-900">
                                        {selectedLayout.facilities.length}
                                        <span className="text-sm text-slate-300 ml-2">Nodes</span>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Statistics */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                                        <div className="w-1.5 h-3 bg-brand rounded-full" />
                                        Output Forecast
                                    </h3>
                                    <div className="space-y-6">
                                        {Object.entries(selectedLayout.items_per_hour).map(
                                            ([itemId, rate]) => (
                                                <div
                                                    key={itemId}
                                                    className="flex items-center justify-between border-b border-slate-50 pb-6 last:border-0"
                                                >
                                                    <div>
                                                        <div className="text-slate-900 font-black text-lg tracking-tight">{itemId.replace('item_', '').replace('_', ' ')}</div>
                                                        <div className="text-brand text-[8px] font-black uppercase tracking-widest mt-1">Neural Target Verified</div>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <div className="text-slate-900 font-black font-mono text-xl tracking-tighter">
                                                            {rate.toFixed(1)}
                                                            <span className="text-[10px] text-slate-300 ml-1">U/H</span>
                                                        </div>
                                                        <div className="text-[9px] text-slate-400 font-bold mt-1">
                                                            {(rate / 60).toFixed(2)} / minute
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>

                                <div className="bg-slate-900 rounded-[2.5rem] p-10 relative overflow-hidden group">
                                    <div className="relative z-10 flex flex-col h-full justify-between">
                                        <div>
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8">
                                                <Zap className="text-brand" size={24} fill="currentColor" />
                                            </div>
                                            <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-4">
                                                Deploy Matrix
                                            </h3>
                                            <p className="text-white/40 text-sm leading-relaxed font-bold">
                                                Applying this configuration will synchronize all building coordinates and power routes to your workspace.
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => selectedLayout && onApply(selectedLayout)}
                                            className="mt-12 py-5 bg-brand rounded-2xl text-white font-black uppercase italic tracking-tighter flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl shadow-brand/20"
                                        >
                                            <MousePointer2 size={20} />
                                            Apply Configuration
                                        </button>
                                    </div>

                                    {/* Decorator */}
                                    <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-brand/10 rounded-full blur-[100px] group-hover:bg-brand/20 transition-all duration-1000" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-slate-200 text-center">
                                <Plus className="mx-auto mb-6 opacity-20" size={64} />
                                <div className="text-xs font-black uppercase tracking-[0.5em] opacity-30">No selection</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
