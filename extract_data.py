import json
import re
from pathlib import Path

print("Starting data extraction...\n")

# Load item names
with open("old/public/locales/en/item.json", encoding="utf-8") as f:
    item_names = json.load(f)

# Load facility names
with open("old/public/locales/en/facility.json", encoding="utf-8") as f:
    facility_names = json.load(f)

# Raw materials
raw_materials = {
    'item_originium_ore', 'item_quartz_sand', 'item_iron_ore', 'item_liquid_water',
    'item_plant_moss_1', 'item_plant_moss_seed_1', 'item_plant_moss_2', 'item_plant_moss_seed_2',
    'item_plant_moss_3', 'item_plant_moss_seed_3', 'item_plant_bbflower_1', 'item_plant_bbflower_seed_1',
    'item_plant_grass_1', 'item_plant_grass_seed_1', 'item_plant_grass_2', 'item_plant_grass_seed_2',
    'item_plant_sp_1', 'item_plant_sp_2', 'item_plant_sp_3', 'item_plant_sp_4',
    'item_plant_sp_seed_1', 'item_plant_sp_seed_2', 'item_plant_sp_seed_3', 'item_plant_sp_seed_4',
    'item_plant_tundra_wood', 'item_muck_feces_1'
}

# Extract items
with open("old/src/data/items.ts", encoding="utf-8") as f:
    items_content = f.read()

items = []
item_pattern = r'\{\s*id:\s*ItemId\.(\w+),\s*tier:\s*(\d+)'
for match in re.finditer(item_pattern, items_content):
    item_id = match.group(1).lower()
    tier = int(match.group(2))
    items.append({
        "id": item_id,
        "name": item_names.get(item_id, item_id.replace('_', ' ').title()),
        "tier": tier,
        "is_raw": item_id in raw_materials
    })

print(f"Extracted {len(items)} items")

# Extract facilities
with open("old/src/data/facilities.ts", encoding="utf-8") as f:
    facilities_content = f.read()

facilities = []
facility_pattern = r'\{\s*id:\s*FacilityId\.(\w+),\s*powerConsumption:\s*(\d+),\s*tier:\s*(\d+)'
for match in re.finditer(facility_pattern, facilities_content):
    facility_id = match.group(1).lower()
    power = int(match.group(2))
    tier = int(match.group(3))
    facilities.append({
        "id": facility_id,
        "name": facility_names.get(facility_id, facility_id.replace('_', ' ').title()),
        "power": power,
        "tier": tier,
        "width": 2,
        "height": 2
    })

print(f"Extracted {len(facilities)} facilities")

# Extract recipes
with open("old/src/data/recipes.ts", encoding="utf-8") as f:
    recipes_content = f.read()

recipes = []
# Split by recipe objects
recipe_blocks = re.split(r'\},\s*\{', recipes_content)

for block in recipe_blocks:
    # Extract recipe ID
    id_match = re.search(r'id:\s*RecipeId\.(\w+)', block)
    if not id_match:
        continue
    
    recipe_id = id_match.group(1).lower()
    
    # Extract inputs
    inputs = []
    inputs_match = re.search(r'inputs:\s*\[([\s\S]*?)\]', block)
    if inputs_match:
        for input_match in re.finditer(r'itemId:\s*ItemId\.(\w+),\s*amount:\s*(\d+)', inputs_match.group(1)):
            inputs.append({
                "item_id": input_match.group(1).lower(),
                "amount": int(input_match.group(2))
            })
    
    # Extract outputs
    outputs = []
    outputs_match = re.search(r'outputs:\s*\[([\s\S]*?)\]', block)
    if outputs_match:
        for output_match in re.finditer(r'itemId:\s*ItemId\.(\w+),\s*amount:\s*(\d+)', outputs_match.group(1)):
            outputs.append({
                "item_id": output_match.group(1).lower(),
                "amount": int(output_match.group(2))
            })
    
    # Extract facility
    facility_match = re.search(r'facilityId:\s*FacilityId\.(\w+)', block)
    facility_id = facility_match.group(1).lower() if facility_match else ""
    
    # Extract crafting time
    time_match = re.search(r'craftingTime:\s*(\d+)', block)
    crafting_time = int(time_match.group(1)) if time_match else 2
    
    if inputs or outputs:
        recipes.append({
            "id": recipe_id,
            "inputs": inputs,
            "outputs": outputs,
            "facility_id": facility_id,
            "crafting_time": crafting_time
        })

print(f"Extracted {len(recipes)} recipes")

# Write output files
output_dir = Path("src-tauri/data")

with open(output_dir / "items_complete.json", "w", encoding="utf-8") as f:
    json.dump(items, f, indent=2, ensure_ascii=False)

with open(output_dir / "facilities_complete.json", "w", encoding="utf-8") as f:
    json.dump(facilities, f, indent=2, ensure_ascii=False)

with open(output_dir / "recipes_complete.json", "w", encoding="utf-8") as f:
    json.dump(recipes, f, indent=2, ensure_ascii=False)

print("\n✅ Data extraction complete!")
print(f"  - {len(items)} items → items_complete.json")
print(f"  - {len(facilities)} facilities → facilities_complete.json")
print(f"  - {len(recipes)} recipes → recipes_complete.json")
