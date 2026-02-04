// Simplified data extraction script
const fs = require('fs');
const path = require('path');

console.log('Starting data extraction...\n');

// Load item names from localization
const itemNamesPath = path.join(__dirname, 'old', 'public', 'locales', 'en', 'item.json');
const itemNames = JSON.parse(fs.readFileSync(itemNamesPath, 'utf8'));

// Load facility names
const facilityNamesPath = path.join(__dirname, 'old', 'public', 'locales', 'en', 'facility.json');
const facilityNames = JSON.parse(fs.readFileSync(facilityNamesPath, 'utf8'));

// Raw materials list (tier 1 items from mines/plants)
const rawMaterials = [
    'item_originium_ore',
    'item_quartz_sand',
    'item_iron_ore',
    'item_liquid_water',
    'item_plant_moss_1',
    'item_plant_moss_seed_1',
    'item_plant_moss_2',
    'item_plant_moss_seed_2',
    'item_plant_moss_3',
    'item_plant_moss_seed_3',
    'item_plant_bbflower_1',
    'item_plant_bbflower_seed_1',
    'item_plant_grass_1',
    'item_plant_grass_seed_1',
    'item_plant_grass_2',
    'item_plant_grass_seed_2',
    'item_plant_sp_1',
    'item_plant_sp_2',
    'item_plant_sp_3',
    'item_plant_sp_4',
    'item_plant_sp_seed_1',
    'item_plant_sp_seed_2',
    'item_plant_sp_seed_3',
    'item_plant_sp_seed_4',
    'item_plant_tundra_wood',
    'item_muck_feces_1'
];

// Extract items from constants
const constantsPath = path.join(__dirname, 'old', 'src', 'types', 'constants.ts');
const constantsContent = fs.readFileSync(constantsPath, 'utf8');

// Parse ItemId constants
const itemIdMatch = constantsContent.match(/const ItemId = \{([\s\S]*?)\} as const;/);
if (!itemIdMatch) {
    console.error('Could not find ItemId constants');
    process.exit(1);
}

const itemIdContent = itemIdMatch[1];
const itemIdRegex = /(\w+):\s*"([\w_]+)"/g;
const itemIds = [];
let match;

while ((match = itemIdRegex.exec(itemIdContent)) !== null) {
    const itemId = match[2];
    if (itemId !== '__multi_target__') {
        itemIds.push(itemId);
    }
}

console.log(`Found ${itemIds.length} item IDs`);

// Create items array with tier information from old items.ts
const itemsPath = path.join(__dirname, 'old', 'src', 'data', 'items.ts');
const itemsContent = fs.readFileSync(itemsPath, 'utf8');

const items = [];
const tierRegex = /\{\s*id:\s*ItemId\.(\w+),\s*tier:\s*(\d+)/g;

while ((match = tierRegex.exec(itemsContent)) !== null) {
    const constantName = match[1];
    const tier = parseInt(match[2]);
    const itemId = constantName.toLowerCase();

    items.push({
        id: itemId,
        name: itemNames[itemId] || itemId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        tier: tier,
        is_raw: rawMaterials.includes(itemId)
    });
}

console.log(`Extracted ${items.length} items`);

// Extract facilities
const facilitiesPath = path.join(__dirname, 'old', 'src', 'data', 'facilities.ts');
const facilitiesContent = fs.readFileSync(facilitiesPath, 'utf8');

const facilities = [];
const facilityRegex = /\{\s*id:\s*FacilityId\.(\w+),\s*powerConsumption:\s*(\d+),\s*tier:\s*(\d+)/g;

while ((match = facilityRegex.exec(facilitiesContent)) !== null) {
    const constantName = match[1];
    const powerConsumption = parseInt(match[2]);
    const tier = parseInt(match[3]);
    const facilityId = constantName.toLowerCase();

    facilities.push({
        id: facilityId,
        name: facilityNames[facilityId] || facilityId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        power: powerConsumption,
        tier: tier,
        width: 2,
        height: 2
    });
}

console.log(`Extracted ${facilities.length} facilities`);

// Extract recipes (simplified parsing)
const recipesPath = path.join(__dirname, 'old', 'src', 'data', 'recipes.ts');
const recipesContent = fs.readFileSync(recipesPath, 'utf8');

const recipes = [];
const recipeIdRegex = /id:\s*RecipeId\.(\w+)/g;
const recipeBlocks = recipesContent.split(/\},\s*\{/);

for (const block of recipeBlocks) {
    try {
        const idMatch = block.match(/id:\s*RecipeId\.(\w+)/);
        if (!idMatch) continue;

        const recipeId = idMatch[1].toLowerCase();

        // Extract inputs
        const inputs = [];
        const inputsMatch = block.match(/inputs:\s*\[([\s\S]*?)\]/);
        if (inputsMatch) {
            const inputRegex = /itemId:\s*ItemId\.(\w+),\s*amount:\s*(\d+)/g;
            let inputMatch;
            while ((inputMatch = inputRegex.exec(inputsMatch[1])) !== null) {
                inputs.push({
                    item_id: inputMatch[1].toLowerCase(),
                    amount: parseInt(inputMatch[2])
                });
            }
        }

        // Extract outputs
        const outputs = [];
        const outputsMatch = block.match(/outputs:\s*\[([\s\S]*?)\]/);
        if (outputsMatch) {
            const outputRegex = /itemId:\s*ItemId\.(\w+),\s*amount:\s*(\d+)/g;
            let outputMatch;
            while ((outputMatch = outputRegex.exec(outputsMatch[1])) !== null) {
                outputs.push({
                    item_id: outputMatch[1].toLowerCase(),
                    amount: parseInt(outputMatch[2])
                });
            }
        }

        // Extract facility
        const facilityMatch = block.match(/facilityId:\s*FacilityId\.(\w+)/);
        const facilityId = facilityMatch ? facilityMatch[1].toLowerCase() : '';

        // Extract crafting time
        const timeMatch = block.match(/craftingTime:\s*(\d+)/);
        const craftingTime = timeMatch ? parseInt(timeMatch[1]) : 2;

        if (inputs.length > 0 || outputs.length > 0) {
            recipes.push({
                id: recipeId,
                inputs: inputs,
                outputs: outputs,
                facility_id: facilityId,
                crafting_time: craftingTime
            });
        }
    } catch (e) {
        // Skip malformed blocks
    }
}

console.log(`Extracted ${recipes.length} recipes`);

// Write output files
const outputDir = path.join(__dirname, 'src-tauri', 'data');

fs.writeFileSync(
    path.join(outputDir, 'items_complete.json'),
    JSON.stringify(items, null, 2)
);

fs.writeFileSync(
    path.join(outputDir, 'facilities_complete.json'),
    JSON.stringify(facilities, null, 2)
);

fs.writeFileSync(
    path.join(outputDir, 'recipes_complete.json'),
    JSON.stringify(recipes, null, 2)
);

console.log('\n✅ Data extraction complete!');
console.log(`  - ${items.length} items → items_complete.json`);
console.log(`  - ${facilities.length} facilities → facilities_complete.json`);
console.log(`  - ${recipes.length} recipes → recipes_complete.json`);
