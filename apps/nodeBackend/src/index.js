"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// migration.ts
const dotenv_1 = __importDefault(require("dotenv"));
const supabase_js_1 = require("@supabase/supabase-js");
// Load environment variables from .env file
dotenv_1.default.config();
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function migrateJobTags() {
    console.log('Starting migration...');
    const batchSize = 1000;
    let totalUpdated = 0;
    while (true) {
        try {
            const { data, error } = await supabase.rpc('update_jobs_batch', {
                batch_size: batchSize,
            });
            if (error)
                throw error;
            if (data === 0)
                break; // No more rows to update
            totalUpdated += data;
            console.log(`Updated ${data} rows (total: ${totalUpdated})`);
            // Small delay between batches
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        catch (err) {
            console.error('Batch failed:', err);
            break;
        }
    }
    // Apply constraints after all updates
    console.log('Applying NOT NULL constraint...');
    const { error } = await supabase.rpc('apply_tags_constraint');
    if (error)
        throw error;
    console.log(`Migration complete! Updated ${totalUpdated} total rows`);
}
migrateJobTags().catch(console.error);
