import { Viewport } from "./components/Viewport";

function App() {
  return (
    <div className="w-full h-full bg-[#1e1e1e] flex flex-col text-slate-200">
      <header className="h-10 flex items-center px-4 bg-[#2d2d2d] border-b border-[#3e3e3e] select-none">
        <h1 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Endfield Architect // v0.1.0</h1>
      </header>

      <div className="flex-1 relative overflow-hidden bg-[#1e1e1e]">
        <Viewport />
      </div>
    </div>
  );
}

export default App;
