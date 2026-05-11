const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkMaterials() {
    console.log("--- Checking Class Materials ---");
    
    // 1. Total count
    const { count, error: countError } = await supabase
        .from('class_materials')
        .select('*', { count: 'exact', head: true });
    
    if (countError) {
        console.error("Count Error:", countError);
    } else {
        console.log(`Total materials in table: ${count}`);
    }

    // 2. Sample data
    const { data, error } = await supabase
        .from('class_materials')
        .select('id, title, subject_id, created_at')
        .limit(10);
    
    if (error) {
        console.error("Fetch Error:", error);
    } else {
        console.log("Sample Materials:");
        data.forEach(m => {
            console.log(`- [${m.subject_id}] ${m.title} (${m.id})`);
        });
    }

    // 3. Subjects list
    const { data: subjects, error: subError } = await supabase
        .from('subjects')
        .select('id, name');
    
    if (subError) {
        console.error("Subjects Error:", subError);
    } else {
        console.log("\nAvailable Subjects:");
        subjects.forEach(s => {
            console.log(`- ${s.name}: ${s.id}`);
        });
    }
}

checkMaterials();
