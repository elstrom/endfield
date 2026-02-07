
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'database.json');
const itemsDir = path.join(__dirname, 'public', 'images', 'items');

try {
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    let changes = 0;

    data.items.forEach(item => {
        if (item.icon && item.icon.startsWith('/images/items/')) {
            const fileName = path.basename(item.icon);
            // Construct absolute path to check existence
            const filePath = path.join(itemsDir, fileName);

            if (!fs.existsSync(filePath)) {

                const nameWithoutExt = path.parse(fileName).name;
                const pngName = nameWithoutExt + ".png";
                const pngPath = path.join(itemsDir, pngName);

                if (fs.existsSync(pngPath)) {
                    console.log(`Fixing: ${fileName} -> ${pngName}`);
                    item.icon = "/images/items/" + pngName;
                    changes++;
                } else {
                    const webpName = nameWithoutExt + ".webp";
                    const webpPath = path.join(itemsDir, webpName);
                    if (fs.existsSync(webpPath)) {
                        console.log(`Fixing: ${fileName} -> ${webpName}`);
                        item.icon = "/images/items/" + webpName;
                        changes++;
                    } else {
                        console.log(`Missing Icon for ${item.id}: ${fileName} (No Alternative Found)`);
                    }
                }
            }
        }
    });

    if (changes > 0) {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        console.log(`\nSuccessfully matched and updated ${changes} icon paths in database.json.`);
    } else {
        console.log("\nAll icons seem correct. No changes made.");
    }

} catch (err) {
    console.error("Error:", err);
}
