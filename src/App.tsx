import { useState, useCallback } from "react";
import { PlanningPage } from "./components/PlanningPage";
import { ResultsPage } from "./components/ResultsPage";
import { Viewport } from "./components/Viewport";
import { useSandbox } from "./hooks/useSandbox";

type AppState = "sandbox" | "planning" | "results";

function App() {
  const [appState, setAppState] = useState<AppState>("sandbox");
  const [generatedLayouts, setGeneratedLayouts] = useState<any[]>([]);
  const { applyLayout, clearBoard } = useSandbox();

  const handleGenerateComplete = useCallback((layouts: any[]) => {
    setGeneratedLayouts(layouts);
    setAppState("results");
  }, []);

  const handleBackToPlanning = useCallback(() => {
    setAppState("planning");
  }, []);

  const handleCloseOverlay = useCallback(() => {
    setAppState("sandbox");
  }, []);

  const handleApplyLayout = useCallback((layout: any) => {
    if (confirm("Applying this layout will clear your current board. Proceed?")) {
      clearBoard();
      applyLayout(layout.facilities);
      setAppState("sandbox");
    }
  }, [applyLayout, clearBoard]);

  return (
    <div className="w-screen h-screen bg-[#f8fafc] relative overflow-hidden text-slate-900">
      {/* Background Viewport (The Core Simulation) */}
      <Viewport onOpenPlanner={() => setAppState("planning")} />

      {/* Overlays */}
      {appState === "planning" && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
          <div className="relative">
            <button
              onClick={handleCloseOverlay}
              className="absolute -top-4 -right-4 w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full flex items-center justify-center text-white z-[60] backdrop-blur-xl transition-all"
            >
              ✕
            </button>
            <PlanningPage onGenerateComplete={handleGenerateComplete} />
          </div>
        </div>
      )}

      {appState === "results" && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
          <div className="relative w-full h-full flex items-center justify-center">
            <button
              onClick={handleCloseOverlay}
              className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full flex items-center justify-center text-white z-[60] backdrop-blur-xl transition-all font-bold"
            >
              ✕
            </button>
            <ResultsPage
              layouts={generatedLayouts}
              onBack={handleBackToPlanning}
              onApply={handleApplyLayout}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
