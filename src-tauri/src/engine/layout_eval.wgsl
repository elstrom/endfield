struct Facility {
    width: u32,
    height: u32,
    power: f32,
    tier: u32,
};

struct PlacedFacility {
    x: i32,
    y: i32,
    facility_id: u32,
};

@group(0) @binding(0) var<storage, read> facilities: array<Facility>;
@group(0) @binding(1) var<storage, read> grid_layout: array<PlacedFacility>;
@group(0) @binding(2) var<storage, read_write> results: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= arrayLength(&grid_layout)) { return; }

    let p = grid_layout[index];
    let facility_meta = facilities[p.facility_id];

    // Simple evaluation: 
    // Is it within bounds? 1.0 if yes, 0.0 if no.
    // Total power consumption calculation could go here too.
    
    var score = 1.0;
    if (p.x < 0 || p.y < 0 || p.x > 100 || p.y > 100) {
        score = 0.0;
    }

    results[index] = score * facility_meta.power;
}
