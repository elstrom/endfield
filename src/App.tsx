import { useState } from "react";
import { PlanningPage } from "./components/PlanningPage";
import { ResultsPage } from "./components/ResultsPage";

type AppState = "planning" | "results";

function App() {
  const [appState, setAppState] = useState<AppState>("planning");
  const [generatedLayouts, setGeneratedLayouts] = useState<any[]>([]);

  const handleGenerateComplete = (layouts: any[]) => {
    setGeneratedLayouts(layouts);
    setAppState("results");
  };

  const handleBackToPlanning = () => {
    setAppState("planning");
  };

  return (
    <div className="w-screen h-screen bg-[#0a0a0a]">
      {appState === "planning" && (
        <PlanningPage onGenerateComplete={handleGenerateComplete} />
      )}
      {appState === "results" && (
        <ResultsPage layouts={generatedLayouts} onBack={handleBackToPlanning} />
      )}
    </div>
  );
}

export default App;
