const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixOrphanedMaterials() {
    console.log("--- Fixing Orphaned Materials ---");

    // Target Subject ID (Araling Panlipunan from diagnostic)
    const targetSubjectId = '904b2141-afbc-403c-8b18-9acef9438637';

    const { data, error } = await supabase
        .from('class_materials')
        .update({ subject_id: targetSubjectId })
        .is('subject_id', null);

    if (error) {
        console.error("Update Error:", error);
    } else {
        console.log(`Successfully updated orphaned materials to subject: ${targetSubjectId}`);
    }
}

fixOrphanedMaterials();
