import { invoke } from "@tauri-apps/api/core";

export const debugLog = (msg: string, ...args: any[]) => {
    try {
        const formatted = msg + " " + args.map(a => {
            try {
                return typeof a === 'object' ? JSON.stringify(a) : String(a);
            } catch (e) {
                return "[Circular/Unserializable]";
            }
        }).join(" ");
        invoke("log_to_terminal", { msg: formatted }).catch(() => {
            // Fallback if backend not ready or command missing
            console.log(msg, ...args);
        });
    } catch (e) {
        console.error("Logger Failed:", e);
    }
};
