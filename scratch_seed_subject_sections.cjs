const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://pyeckxqaowusxcmeuolk.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg');

async function seedSubjectSections() {
  const { data: subjects, error: subError } = await supabase.from('subjects').select('*');
  if (subError) throw subError;

  const { data: sections, error: secError } = await supabase.from('grade_sections').select('*');
  if (secError) throw secError;

  // Group sections by grade level (numeric)
  const sectionsByGrade = {};
  for (const s of sections) {
    if (!sectionsByGrade[s.grade_level]) sectionsByGrade[s.grade_level] = [];
    sectionsByGrade[s.grade_level].push(s.section_name);
  }

  let updated = 0;
  for (const subject of subjects) {
    if (!subject.grade_level) continue;
    const gradeNum = subject.grade_level.replace("Grade ", "").trim();
    const gradeSections = sectionsByGrade[gradeNum];
    
    if (gradeSections && gradeSections.length > 0) {
      // Pick the first section, or randomly
      const hash = subject.id.charCodeAt(0) + subject.id.charCodeAt(1);
      const sectionName = gradeSections[hash % gradeSections.length];
      
      console.log(`Updating ${subject.code} (${subject.grade_level}) to section: ${sectionName}`);
      const { error } = await supabase.from('subjects').update({ section: sectionName }).eq('id', subject.id);
      if (error) {
        console.error("Error updating", subject.code, error);
      } else {
        updated++;
      }
    }
  }
  
  console.log(`Successfully updated ${updated} subjects with sections!`);
}

seedSubjectSections().catch(console.error);
