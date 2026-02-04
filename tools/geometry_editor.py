import tkinter as tk
from tkinter import messagebox, ttk
from PIL import Image, ImageTk
import json
import os

# Configuration
DATA_FILE = 'facilities_geometry.json'
IMAGE_DIR = 'public/images/facilities/'
GRID_SIZE = 40  # Pixels per grid cell
MAX_GRID = 32   # Maximum grid 32x32

# Theme Colors
BG_COLOR = "#f0f2f5"
SIDEBAR_BG = "#ffffff"
HEADER_COLOR = "#1a1a1a"
ACCENT_COLOR = "#3b82f6"
GRID_BG = "#eef2ff"

# Load extra data (power, correct name)
EXTRA_DATA_FILE = 'facilities_data copy.json'
extra_data_map = {}
if os.path.exists(EXTRA_DATA_FILE):
    with open(EXTRA_DATA_FILE, 'r') as f:
        items = json.load(f)
        for item in items:
            key = item.get('name') 
            if key:
                extra_data_map[key] = item

class FacilityEditor:
    def __init__(self, root):
        self.root = root
        self.root.title("Endfield Facility Designer - High Precision")
        self.root.geometry("1400x900")
        self.root.configure(bg=BG_COLOR)
        
        self.facilities = self.load_data()
        self.sort_facilities()
        
        self.current_index = 0
        self.grid_w = 4
        self.grid_h = 4
        self.img_ref = None 
        
        # State
        self.ports = [] 
        self.mode = 'input' 
        self.selected_direction = 'left'
        
        self.setup_ui()
        self.load_current_facility()

    def load_data(self):
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r') as f:
                data = json.load(f)
                # Filter out logistics components that have fixed logic
                logistics_to_skip = ["Conveyor Belt", "Splitter", "Merger", "Converger", "Belt Bridge", 
                                   "Pipe Splitter", "Pipe Bridge", "Pipe Converger"]
                return [fac for fac in data if fac.get('type') not in logistics_to_skip]
        return []

    def sort_facilities(self):
        logistics = ["Conveyor Belt", "Splitter", "Merger", "Item Port", "Bridge", "Converger", "Pipe"]
        processing = ["Refining", "Fitting", "Gearing", "Shredding", "Moulding", "Packaging", "Reactor", "Separating", "Grinding", "Filling", "Planting", "Seed-Picking", "Forge"]
        def get_priority(fac):
            name = fac.get('type', '')
            if any(l in name for l in logistics): return 0
            if any(p in name for p in processing): return 1
            return 2
        self.facilities.sort(key=get_priority)

    def save_data(self):
        f = self.facilities[self.current_index]
        
        # Save Editable Fields
        new_name = self.ent_name.get()
        f['type'] = new_name
        
        f['width'] = self.grid_w
        f['height'] = self.grid_h
        f['ports'] = self.ports
        
        # Save Power
        try:
            f['power_consumption'] = float(self.ent_power.get())
        except:
            pass
            
        with open(DATA_FILE, 'w') as f_handle:
            json.dump(self.facilities, f_handle, indent=2)
        print(f"Saved {f['type']}")

    def setup_ui(self):
        # --- Main Layout ---
        paned = tk.PanedWindow(self.root, orient=tk.HORIZONTAL, bg=BG_COLOR)
        paned.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # --- Left Panel (Canvas) ---
        frame_canvas = tk.Frame(paned, bg="white", bd=1, relief=tk.RIDGE)
        paned.add(frame_canvas, stretch="always")
        
        self.canvas = tk.Canvas(frame_canvas, bg=GRID_BG, highlightthickness=0)
        self.canvas.pack(fill=tk.BOTH, expand=True)
        self.canvas.bind("<Button-1>", self.on_canvas_click)
        
        # --- Right Panel (Controls) ---
        frame_controls = tk.Frame(paned, bg=SIDEBAR_BG, width=400, bd=1, relief=tk.RIDGE)
        paned.add(frame_controls, stretch="never")
        
        # Header (Name Editor)
        lbl_header = tk.Label(frame_controls, text="Facility Configuration", bg=SIDEBAR_BG, fg="#666", font=("Arial", 10, "bold"))
        lbl_header.pack(pady=(15, 5), padx=15, anchor="w")
        
        self.ent_name = tk.Entry(frame_controls, font=("Segoe UI", 16, "bold"), bg="#f9fafb", relief=tk.FLAT)
        self.ent_name.pack(fill=tk.X, padx=15, pady=5)
        
        # Image Preview (LARGE)
        frame_img = tk.Frame(frame_controls, bg="#e5e7eb", height=300)
        frame_img.pack(fill=tk.X, padx=15, pady=10)
        frame_img.pack_propagate(False) # Force height
        
        self.lbl_image = tk.Label(frame_img, text="[No Image]", bg="#e5e7eb")
        self.lbl_image.pack(expand=True, fill=tk.BOTH)
        
        # Metadata Grid
        frame_meta = tk.Frame(frame_controls, bg=SIDEBAR_BG)
        frame_meta.pack(fill=tk.X, padx=15, pady=10)
        
        tk.Label(frame_meta, text="Width", bg=SIDEBAR_BG, fg="#666").grid(row=0, column=0, sticky="w")
        tk.Label(frame_meta, text="Height", bg=SIDEBAR_BG, fg="#666").grid(row=0, column=1, sticky="w")
        tk.Label(frame_meta, text="Power (W)", bg=SIDEBAR_BG, fg="#666").grid(row=0, column=2, sticky="w")
        
        self.spin_w = tk.Spinbox(frame_meta, from_=1, to=MAX_GRID, width=5, command=self.update_grid_dim, font=("Arial", 12))
        self.spin_w.grid(row=1, column=0, padx=(0,10))
        
        self.spin_h = tk.Spinbox(frame_meta, from_=1, to=MAX_GRID, width=5, command=self.update_grid_dim, font=("Arial", 12))
        self.spin_h.grid(row=1, column=1, padx=(0,10))
        
        self.ent_power = tk.Entry(frame_meta, width=8, font=("Arial", 12))
        self.ent_power.grid(row=1, column=2)
        
        # Tools
        tk.Label(frame_controls, text="Port Tools", bg=SIDEBAR_BG, fg="#666", font=("Arial", 10, "bold")).pack(pady=(20, 5), padx=15, anchor="w")
        
        btn_style = {"font": ("Segoe UI", 10), "pady": 8, "relief": tk.FLAT, "cursor": "hand2"}
        
        self.btn_in = tk.Button(frame_controls, text="➕ Add Input (Green)", bg="#dcfce7", fg="#166534", command=lambda: self.set_mode('input'), **btn_style)
        self.btn_in.pack(fill=tk.X, padx=15, pady=2)
        
        self.btn_out = tk.Button(frame_controls, text="➕ Add Output (Red)", bg="#fee2e2", fg="#991b1b", command=lambda: self.set_mode('output'), **btn_style)
        self.btn_out.pack(fill=tk.X, padx=15, pady=2)
        
        self.btn_del = tk.Button(frame_controls, text="🗑 Delete Port", bg="#f3f4f6", fg="#374151", command=lambda: self.set_mode('delete'), **btn_style)
        self.btn_del.pack(fill=tk.X, padx=15, pady=2)
        
        # Direction
        frame_dir = tk.Frame(frame_controls, bg=SIDEBAR_BG)
        frame_dir.pack(pady=10)
        self.var_dir = tk.StringVar(value="left")
        
        directions = [("⬅ Left", "left"), ("⬆ Top", "top"), ("⬇ Bottom", "bottom"), ("➡ Right", "right")]
        for text, val in directions:
            tk.Radiobutton(frame_dir, text=text, variable=self.var_dir, value=val, bg=SIDEBAR_BG, indicatoron=0, width=8, selectcolor="#dbeafe").pack(side=tk.LEFT, padx=2)
        
        # Navigation Footer
        frame_nav = tk.Frame(frame_controls, bg=SIDEBAR_BG)
        frame_nav.pack(side=tk.BOTTOM, fill=tk.X, padx=15, pady=20)
        
        self.btn_prev = tk.Button(frame_nav, text="◀ Prev", command=self.prev_facility, width=10, pady=10, bg="#f3f4f6")
        self.btn_prev.pack(side=tk.LEFT)

        self.btn_skip = tk.Button(frame_nav, text="Skip ⏩", command=self.skip_facility, width=10, pady=10, bg="#e5e7eb")
        self.btn_skip.pack(side=tk.LEFT, padx=10)
        
        self.btn_save = tk.Button(frame_nav, text="Save & Next ▶", command=self.next_facility, width=20, pady=10, bg="#3b82f6", fg="white", font=("Arial", 11, "bold"), relief=tk.FLAT)
        self.btn_save.pack(side=tk.RIGHT, fill=tk.X, expand=True, padx=(10,0))

    def update_grid_dim(self):
        try:
            self.grid_w = int(self.spin_w.get())
            self.grid_h = int(self.spin_h.get())
            self.draw_grid()
        except:
            pass
            
    def set_mode(self, mode):
        self.mode = mode
        
    def load_current_facility(self):
        if not self.facilities: return
            
        f = self.facilities[self.current_index]
        name = f.get('type', 'Unknown')
        
        self.ent_name.delete(0, "end")
        self.ent_name.insert(0, name)
        
        self.grid_w = f.get('width', 3)
        self.grid_h = f.get('height', 3)
        
        self.spin_w.delete(0, "end")
        self.spin_w.insert(0, self.grid_w)
        self.spin_h.delete(0, "end")
        self.spin_h.insert(0, self.grid_h)
        
        power = f.get('power_consumption', 0)
        if 'power_consumption' not in f and name in extra_data_map:
             power = extra_data_map[name].get('power', 0)
        
        self.ent_power.delete(0, "end")
        self.ent_power.insert(0, str(power))
        
        self.load_image(name)

        self.ports = f.get('ports', [])
        for p in self.ports:
            if 'direction' not in p: p['direction'] = 'left'
        self.draw_grid()
        
    def load_image(self, fac_name):
        img_path = None
        if fac_name in extra_data_map:
            rel_path = extra_data_map[fac_name].get('image', '').lstrip('/')
            candidate = os.path.join('public', rel_path)
            if os.path.exists(candidate): img_path = candidate
        
        if not img_path:
            clean_name = fac_name.lower().replace(" ", "_")
            for p in [f"item_port_{clean_name}.webp", f"{clean_name}.png", f"{clean_name}.webp"]:
                candidate = os.path.join(IMAGE_DIR, p)
                if os.path.exists(candidate):
                    img_path = candidate
                    break
                    
        if img_path:
            try:
                img = Image.open(img_path)
                # Resize keeping aspect ratio, max height 300px (to fit UI) or larger if requested
                # User asked for 'minimal 720p', but that's massive for a sidebar. 
                # I'll scale it to fit the 300px height container nicely, zoomable if clicked ideal but simplest is high-res fit.
                img.thumbnail((400, 300)) 
                self.img_ref = ImageTk.PhotoImage(img)
                self.lbl_image.config(image=self.img_ref, text="")
            except:
                self.lbl_image.config(image='', text="[Img Error]")
        else:
            self.lbl_image.config(image='', text="[No Image Found]")

    def draw_grid(self):
        self.canvas.delete("all")
        # Center grid in canvas
        cw = self.canvas.winfo_width()
        ch = self.canvas.winfo_height()
        if cw < 50: cw = 800
        if ch < 50: ch = 600
        
        fac_px_w = self.grid_w * GRID_SIZE
        fac_px_h = self.grid_h * GRID_SIZE
        
        offset_x = (cw - fac_px_w) // 2
        offset_y = (ch - fac_px_h) // 2
        
        self.canvas.create_rectangle(offset_x, offset_y, offset_x + fac_px_w, offset_y + fac_px_h, fill="#ffffff", outline="#94a3b8", width=3)
        
        for r in range(self.grid_h + 1):
            y = offset_y + r * GRID_SIZE
            self.canvas.create_line(offset_x, y, offset_x + fac_px_w, y, fill="#e2e8f0")
        for c in range(self.grid_w + 1):
            x = offset_x + c * GRID_SIZE
            self.canvas.create_line(x, offset_y, x, offset_y + fac_px_h, fill="#e2e8f0")
            
        for i, p in enumerate(self.ports):
            col = p['x']
            row = p['y']
            ptype = p['type']
            pdir = p.get('direction', 'left')
            
            cx = offset_x + col * GRID_SIZE + GRID_SIZE/2
            cy = offset_y + row * GRID_SIZE + GRID_SIZE/2
            
            color = "#22c55e" if ptype == 'input' else "#ef4444"
            self.canvas.create_oval(cx-12, cy-12, cx+12, cy+12, fill=color, outline="white", width=2)
            
            arrow_map = {'left': '⬅', 'right': '➡', 'top': '⬆', 'bottom': '⬇'}
            self.canvas.create_text(cx, cy, text=arrow_map.get(pdir, '?'), fill="white", font=("Arial", 14, "bold"))
            self.canvas.create_text(cx+15, cy-15, text=str(i+1), fill="#1e293b", font=("Arial", 9, "bold"))

    def on_canvas_click(self, event):
        cw = self.canvas.winfo_width()
        ch = self.canvas.winfo_height()
        fac_px_w = self.grid_w * GRID_SIZE
        fac_px_h = self.grid_h * GRID_SIZE
        offset_x = (cw - fac_px_w) // 2
        offset_y = (ch - fac_px_h) // 2
        
        col = (event.x - offset_x) // GRID_SIZE
        row = (event.y - offset_y) // GRID_SIZE
        
        if 0 <= col < self.grid_w and 0 <= row < self.grid_h:
            if self.mode == 'delete':
                self.ports = [p for p in self.ports if not (p['x'] == col and p['y'] == row)]
            else:
                self.ports = [p for p in self.ports if not (p['x'] == col and p['y'] == row)]
                new_port = {
                    "id": f"{'in' if self.mode == 'input' else 'out'}_{len(self.ports)+1}",
                    "type": self.mode,
                    "x": col,
                    "y": row,
                    "direction": self.var_dir.get()
                }
                self.ports.append(new_port)
            self.draw_grid()

    def next_facility(self):
        self.save_data()
        if self.current_index < len(self.facilities) - 1:
            self.current_index += 1
            self.load_current_facility()
        else:
            messagebox.showinfo("Done", "All facilities edited!")

    def skip_facility(self):
        if self.current_index < len(self.facilities) - 1:
            self.current_index += 1
            self.load_current_facility()
        else:
            messagebox.showinfo("Done", "End of list (Skipped last item)")

    def prev_facility(self):
        if self.current_index > 0:
            self.save_data()
            self.current_index -= 1
            self.load_current_facility()

if __name__ == "__main__":
    root = tk.Tk()
    app = FacilityEditor(root)
    root.mainloop()
