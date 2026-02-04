import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Loader2, Zap, Plus } from "lucide-react";

interface TargetItem {
    itemId: string;
    itemName: string;
    rate: number; // items per minute
}

interface PlanningPageProps {
    onGenerateComplete: (layouts: any[]) => void;
}

export function PlanningPage({ onGenerateComplete }: PlanningPageProps) {
    const [availableItems, setAvailableItems] = useState<any[]>([]);
    const [targetItems, setTargetItems] = useState<TargetItem[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string>("");
    const [itemRate, setItemRate] = useState<number>(10);

    const [plateWidth, setPlateWidth] = useState<number>(30);
    const [plateHeight, setPlateHeight] = useState<number>(40);

    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const loadData = async () => {
            try {
                const data: any = await invoke("get_app_data");
                console.log("DEBUG: App Data Loaded", data);
                if (data && data.items) {
                    setAvailableItems(data.items);
                }
            } catch (err) {
                console.error("Failed to load items:", err);
            }
        };
        loadData();
    }, []);

    const addTargetItem = () => {
        if (!selectedItemId) {
            console.warn("DEBUG: No item selected");
            return;
        }

        const item = availableItems.find((i) => i.id === selectedItemId);
        if (!item) {
            console.error("DEBUG: Item not found in availableItems", selectedItemId);
            return;
        }

        setTargetItems([
            ...targetItems,
            {
                itemId: selectedItemId,
                itemName: item.name,
                rate: itemRate,
            },
        ]);
        setSelectedItemId("");
        setItemRate(10);
    };

    const removeTargetItem = (index: number) => {
        setTargetItems(targetItems.filter((_, i) => i !== index));
    };

    const handleGenerate = async () => {
        if (targetItems.length === 0) {
            alert("Please add at least one target item to start production planning.");
            return;
        }

        setIsGenerating(true);
        setProgress(0);

        const progressInterval = setInterval(() => {
            setProgress((prev) => Math.min(prev + 5, 90));
        }, 300);

        try {
            const request = {
                target_items: targetItems.map((t) => [t.itemId, t.rate]),
                plate_width: plateWidth,
                plate_height: plateHeight,
                num_candidates: 100, // More candidates for better optimization
            };

            const layouts = await invoke("generate_optimal_layouts", { request });

            clearInterval(progressInterval);
            setProgress(100);

            setTimeout(() => {
                onGenerateComplete(layouts as any[]);
            }, 800);
        } catch (error) {
            console.error("Generation failed:", error);
            alert(`Failed to generate layouts: ${error}`);
            clearInterval(progressInterval);
            setIsGenerating(false);
            setProgress(0);
        }
    };

    return (
        <div className="w-screen h-screen bg-[#f8fafc] flex items-center justify-center p-8 text-slate-900">
            <div className="max-w-4xl w-full bg-white rounded-[2.5rem] border border-slate-200 p-12 shadow-2xl shadow-slate-200/50">
                {/* Header */}
                <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center">
                            <Zap className="text-brand" size={24} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase italic">
                                Production Planner
                            </h1>
                            <p className="text-slate-400 text-sm font-medium">Automated Factory Optimization</p>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-12">
                    {/* Left Side: Goal Setup */}
                    <div className="md:col-span-3">
                        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                            Target Production Goal
                        </h2>

                        <div className="flex gap-3 mb-8">
                            <div className="flex-1">
                                <select
                                    value={selectedItemId}
                                    onChange={(e) => setSelectedItemId(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all appearance-none"
                                >
                                    <option value="">Select Item to Produce</option>
                                    {availableItems.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="w-28 relative">
                                <input
                                    type="number"
                                    value={itemRate}
                                    onChange={(e) => setItemRate(Number(e.target.value))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-700 font-bold focus:outline-none focus:border-brand transition-all text-center"
                                />
                                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-white px-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Rate</span>
                            </div>

                            <button
                                onClick={addTargetItem}
                                className="w-14 h-14 bg-brand rounded-2xl text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand/20"
                            >
                                <Plus size={24} />
                            </button>
                        </div>

                        {/* Items List */}
                        <div className="space-y-3 min-h-[200px] max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {targetItems.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-3xl p-10">
                                    <div className="bg-slate-50 p-4 rounded-full mb-3">
                                        <Plus size={20} />
                                    </div>
                                    <p className="text-xs font-bold uppercase tracking-widest">No target items added</p>
                                </div>
                            ) : (
                                targetItems.map((item, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl p-4 hover:border-slate-200 transition-all group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-slate-100 shadow-sm">
                                                <div className="w-2 h-2 rounded-full bg-brand" />
                                            </div>
                                            <div>
                                                <div className="text-slate-900 font-bold">{item.itemName}</div>
                                                <div className="text-brand text-[10px] font-black uppercase tracking-widest">
                                                    {item.rate} units / minute
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeTargetItem(index)}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-white rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Side: Constraints */}
                    <div className="md:col-span-2 border-l border-slate-100 pl-8">
                        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                            Board Constraints
                        </h2>

                        <div className="space-y-6">
                            <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Board Dimensions (Cells)</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <input
                                            type="number"
                                            value={plateWidth}
                                            onChange={(e) => setPlateWidth(Number(e.target.value))}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-bold focus:outline-none focus:border-brand"
                                        />
                                        <span className="text-[9px] text-slate-400 uppercase font-bold text-center block">Width</span>
                                    </div>
                                    <div className="space-y-2">
                                        <input
                                            type="number"
                                            value={plateHeight}
                                            onChange={(e) => setPlateHeight(Number(e.target.value))}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-bold focus:outline-none focus:border-brand"
                                        />
                                        <span className="text-[9px] text-slate-400 uppercase font-bold text-center block">Height</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 opacity-60">
                                <div className="flex items-center justify-between mb-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Power Automation</label>
                                    <div className="px-2 py-1 bg-brand/10 rounded text-[8px] font-black text-brand uppercase">Auto-Solver</div>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                                    Sistem akan secara otomatis meletakkan PAC sebagai hub utama untuk distribusi daya dan logistik di tengah area.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-12 pt-8 border-t border-slate-100">
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || targetItems.length === 0}
                        className={`w-full py-6 rounded-3xl font-black text-lg uppercase tracking-tight transition-all flex items-center justify-center gap-4 ${isGenerating
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-slate-900 text-white hover:bg-black shadow-xl shadow-slate-200 active:scale-[0.99]"
                            }`}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="animate-spin text-brand" size={24} />
                                Scanning for Optimal Production Routes... {progress}%
                            </>
                        ) : (
                            <>
                                <Zap className="text-brand" size={24} fill="currentColor" />
                                Start Automated Planning
                            </>
                        )}
                    </button>

                    {isGenerating && (
                        <div className="mt-6 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                                className="h-full bg-brand transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
