import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { CustomSelect } from "@/app/components/CustomSelect";
import { supabase } from "@/app/lib/supabaseClient";
import {
  sanitizeFileName,
  extractFileType,
  isColumnMissingError,
  buildSupabaseErrorMessage,
  getSupabaseHost,
  resolveColumnName,
  resolveTeacherIdByEmail
} from "@/app/lib/teacherHelpers";
import {
  Upload,
  FileText,
  File,
  Download,
  Trash2,
  Eye,
  Plus,
  X,
  FolderOpen,
  Calendar,
  BookOpen,
  AlertCircle
} from "lucide-react";

const STORAGE_BUCKET = "class-materials";

const FILE_TYPE_OPTIONS = [
  { value: "PDF", label: "PDF" },
  { value: "DOC", label: "DOC" },
  { value: "DOCX", label: "DOCX" },
  { value: "PPT", label: "PPT" },
  { value: "PPTX", label: "PPTX" },
  { value: "XLS", label: "XLS" },
  { value: "XLSX", label: "XLSX" },
  { value: "ZIP", label: "ZIP" },
  { value: "OTHER", label: "OTHER" }
];

const ACTIVITY_SUBJECT_OPTIONS = [
  { value: "math", label: "Advanced Mathematics" },
  { value: "physics", label: "Physics" },
  { value: "cs", label: "Computer Science" },
  { value: "chem", label: "Chemistry" }
];



function ClassMaterials() {
  const navigate = useNavigate();
  const materialFileInputRef = useRef(null);
  const activityFileInputRef = useRef(null);

  const [teacherName, setTeacherName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [activeTab, setActiveTab] = useState("materials");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);

  const [materials, setMaterials] = useState([]);
  const [activities] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
  const [materialColumns, setMaterialColumns] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);

  const [materialForm, setMaterialForm] = useState({
    title: "",
    description: "",
    fileType: "",
    subject: "",
    section: ""
  });
  const [materialFile, setMaterialFile] = useState(null);
  const [materialFileName, setMaterialFileName] = useState("");
  const [materialError, setMaterialError] = useState("");
  const [materialSuccess, setMaterialSuccess] = useState("");

  const [activityFileName, setActivityFileName] = useState("");
  const [connectedSupabaseHost] = useState(getSupabaseHost());

  const clearMaterialForm = () => {
    setMaterialForm({ title: "", description: "", fileType: "", subject: "", section: "" });
    setMaterialFile(null);
    setMaterialFileName("");
    setMaterialError("");
    if (materialFileInputRef.current) {
      materialFileInputRef.current.value = "";
    }
  };



  const fetchMaterials = async (resolvedTeacherId) => {
    if (!supabase) {
      setMaterials([]);
      return;
    }

    setLoadingMaterials(true);
    setMaterialError("");

    let query = supabase
      .from("class_materials")
      .select("*")
      .order("created_at", { ascending: false });

    if (resolvedTeacherId && materialColumns.includes("teacher_id")) {
      query = query.eq("teacher_id", resolvedTeacherId);
    }

    if (resolvedTeacherId && !materialColumns.includes("teacher_id") && materialColumns.includes("created_by")) {
      query = query.eq("created_by", resolvedTeacherId);
    }

    let { data, error } = await query;

    if (error && isColumnMissingError(error)) {
      query = supabase.from("class_materials").select("*");

      if (resolvedTeacherId && materialColumns.includes("teacher_id")) {
        query = query.eq("teacher_id", resolvedTeacherId);
      }

      if (resolvedTeacherId && !materialColumns.includes("teacher_id") && materialColumns.includes("created_by")) {
        query = query.eq("created_by", resolvedTeacherId);
      }

      const fallbackResult = await query;
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      console.error("Failed to fetch class materials:", error);
      setMaterials([]);
      setMaterialError("Unable to load class materials.");
      setLoadingMaterials(false);
      return;
    }

    setMaterials((data ?? []).map((row) => normalizeMaterialRowRecord(row)));
    setLoadingMaterials(false);
  };

  const resolveMaterialColumns = async () => {
    if (!supabase) {
      return [];
    }

    const candidates = [
      "id",
      "title",
      "description",
      "file_type",
      "file_url",
      "file_name",
      "file_path",
      "subject",
      "section",
      "teacher_id",
      "created_by",
      "created_at"
    ];

    const detected = [];

    for (const columnName of candidates) {
      const { error } = await supabase.from("class_materials").select(columnName, { count: "exact", head: true });
      if (!error) {
        detected.push(columnName);
      }
    }

    setMaterialColumns(detected);
    return detected;
  };

  const getMaterialColumns = async () => {
    if (materialColumns.length > 0) {
      return materialColumns;
    }

    return resolveMaterialColumns();
  };

  const fetchTeacherSubjects = async (resolvedTeacherId) => {
    if (!supabase || !resolvedTeacherId) {
      setSubjectOptions([]);
      setSectionOptions([]);
      return;
    }

    const { data, error } = await supabase
      .from("subjects")
      .select("code, name, section")
      .eq("teacher_id", resolvedTeacherId)
      .order("code", { ascending: true });

    if (error) {
      console.error("Failed to fetch subject options:", error);
      return;
    }

    const subjectSet = new Set();
    const subjects = [];
    const sectionSet = new Set();
    const sections = [];

    (data ?? []).forEach((item) => {
      const subjectLabel = [String(item.code || "").trim(), String(item.name || "").trim()]
        .filter(Boolean)
        .join(" - ");

      if (subjectLabel && !subjectSet.has(subjectLabel)) {
        subjectSet.add(subjectLabel);
        subjects.push({ value: subjectLabel, label: subjectLabel });
      }

      const sectionLabel = String(item.section || "").trim();
      if (sectionLabel && !sectionSet.has(sectionLabel)) {
        sectionSet.add(sectionLabel);
        sections.push({ value: sectionLabel, label: sectionLabel });
      }
    });

    setSubjectOptions(subjects);
    setSectionOptions(sections);
  };

  useEffect(() => {
    const initialize = async () => {
      const userData = localStorage.getItem("currentUser");
      if (!userData) {
        navigate("/login");
        return;
      }

      const user = JSON.parse(userData);
      if (user.role !== "teacher") {
        navigate("/login");
        return;
      }

      setTeacherName(user.name || "Teacher");
      const resolvedTeacherId = await resolveTeacherIdByEmail(user.email);
      setTeacherId(resolvedTeacherId);
      await resolveMaterialColumns();
      await Promise.all([
        fetchMaterials(resolvedTeacherId),
        fetchTeacherSubjects(resolvedTeacherId)
      ]);
    };

    initialize();
  }, [navigate]);

  useEffect(() => {
    if (!supabase || !teacherId) return;

    const filterColumn = materialColumns.includes("teacher_id")
      ? "teacher_id"
      : materialColumns.includes("created_by")
        ? "created_by"
        : "";

    const changeConfig = {
      event: "*",
      schema: "public",
      table: "class_materials"
    };

    if (filterColumn) {
      changeConfig.filter = `${filterColumn}=eq.${teacherId}`;
    }

    const channel = supabase
      .channel(`teacher-materials-${teacherId}`)
      .on("postgres_changes", changeConfig, () => {
        fetchMaterials(teacherId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teacherId, materialColumns]);

  useEffect(() => {
    if (!materialSuccess) return;
    const timeout = window.setTimeout(() => setMaterialSuccess(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [materialSuccess]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const handleMaterialFileClick = () => {
    materialFileInputRef.current?.click();
  };

  const handleMaterialFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setMaterialFile(file);
    setMaterialFileName(file ? file.name : "");

    if (!file) return;

    const inferredType = extractFileType(file.name);
    if (inferredType) {
      setMaterialForm((prev) => ({ ...prev, fileType: prev.fileType || inferredType }));
    }
  };

  const handleActivityFileClick = () => {
    activityFileInputRef.current?.click();
  };

  const handleActivityFileChange = (event) => {
    const file = event.target.files?.[0];
    setActivityFileName(file ? file.name : "");
  };

  const getFileIcon = (fileType) => {
    switch (String(fileType || "").toUpperCase()) {
      case "PDF":
        return <FileText className="w-5 h-5 text-red-600" />;
      case "PPTX":
      case "PPT":
        return <File className="w-5 h-5 text-red-600" />;
      case "DOCX":
      case "DOC":
        return <File className="w-5 h-5 text-blue-600" />;
      default:
        return <File className="w-5 h-5 text-gray-400" />;
    }
  };

  const handleUploadMaterial = async () => {
    const title = materialForm.title.trim();
    const fileType = materialForm.fileType.trim();

    if (!title) {
      setMaterialError("Title is required.");
      return;
    }

    if (!fileType) {
      setMaterialError("File Type is required.");
      return;
    }

    if (!materialFile) {
      setMaterialError("Attach File is required.");
      return;
    }

    if (!supabase) {
      setMaterialError("Database connection is unavailable.");
      return;
    }

    if (!teacherId) {
      setMaterialError("Teacher profile is not resolved yet. Please refresh and try again.");
      return;
    }

    try {
      setIsUploadingMaterial(true);
      setMaterialError("");
      setMaterialSuccess("");

      const timestamp = Date.now();
      const safeFileName = sanitizeFileName(materialFile.name);
      const storedFileName = `${timestamp}_${safeFileName}`;
      const filePath = `class-materials/${teacherId || "teacher"}/${storedFileName}`;

      const columns = await getMaterialColumns();
      const hasTeacherIdColumn = columns.includes("teacher_id");
      const hasCreatedByColumn = columns.includes("created_by");

      const { error: uploadError } = await supabase
        .storage
        .from(STORAGE_BUCKET)
        .upload(filePath, materialFile, { upsert: false });

      if (uploadError) {
        console.error("Failed to upload material file:", uploadError);
        setMaterialError(buildSupabaseErrorMessage("File upload failed", uploadError));
        return;
      }

      const { data: publicUrlData } = supabase
        .storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

      const fileUrl = String(publicUrlData?.publicUrl || "");
      if (!fileUrl) {
        setMaterialError("Could not retrieve uploaded file URL.");
        return;
      }

      const payload = {
        title,
        description: materialForm.description.trim() || null,
        file_type: fileType,
        file_url: fileUrl,
        file_name: storedFileName
      };

      if (columns.includes("file_path")) {
        payload.file_path = filePath;
      }

      if (columns.includes("subject")) {
        payload.subject = materialForm.subject.trim() || null;
      }

      if (columns.includes("section")) {
        payload.section = materialForm.section.trim() || null;
      }

      if (hasTeacherIdColumn) {
        payload.teacher_id = teacherId;
      }

      if (hasCreatedByColumn) {
        payload.created_by = teacherId;
      }

      if (columns.includes("created_at")) {
        payload.created_at = new Date().toISOString();
      }

      let insertedRow = null;
      let { data: insertData, error: insertError } = await supabase
        .from("class_materials")
        .insert(payload)
        .select("*")
        .single();

      insertedRow = insertData || null;

      if (insertError && isColumnMissingError(insertError)) {
        const fallbackPayload = {
          title,
          description: materialForm.description.trim() || null,
          file_type: fileType,
          file_url: fileUrl,
          file_name: storedFileName
        };

        if (hasTeacherIdColumn) {
          fallbackPayload.teacher_id = teacherId;
        }

        if (hasCreatedByColumn) {
          fallbackPayload.created_by = teacherId;
        }

        if (columns.includes("created_at")) {
          fallbackPayload.created_at = new Date().toISOString();
        }

        const fallbackInsert = await supabase
          .from("class_materials")
          .insert(fallbackPayload)
          .select("*")
          .single();

        insertError = fallbackInsert.error;
        insertedRow = fallbackInsert.data || null;
      }

      if (insertError) {
        console.error("Failed to save class material:", insertError);
        const { error: rollbackError } = await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
        if (rollbackError) {
          console.error("Failed to rollback uploaded file after insert failure:", rollbackError);
        }
        setMaterialError(buildSupabaseErrorMessage("Material metadata could not be saved", insertError));
        return;
      }

      if (insertedRow) {
        setMaterials((prev) => [normalizeMaterialRow(insertedRow), ...prev]);
      }
      await fetchMaterials(teacherId);
      setMaterialSuccess(`Material uploaded successfully to ${connectedSupabaseHost}.`);
      setShowUploadModal(false);
      clearMaterialForm();
    } catch (error) {
      console.error("Unexpected upload error:", error);
      setMaterialError(buildSupabaseErrorMessage("Unexpected error during upload", error));
    } finally {
      setIsUploadingMaterial(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="bg-gray-900/60 border-b border-white/10 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Class Materials & Activities</h2>
                <p className="text-sm text-gray-400">Upload and manage educational resources</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-gray-900/60 rounded-xl shadow-sm border border-white/10 mb-6">
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setActiveTab("materials")}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === "materials" ? "text-emerald-600 border-b-2 border-emerald-600" : "text-gray-400 hover:text-white"}`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FolderOpen className="w-5 h-5" />
                  Class Materials
                </div>
              </button>
              <button
                onClick={() => setActiveTab("activities")}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === "activities" ? "text-emerald-600 border-b-2 border-emerald-600" : "text-gray-400 hover:text-white"}`}
              >
                <div className="flex items-center justify-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Activities
                </div>
              </button>
            </div>
          </div>

          {activeTab === "materials" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Connected Supabase: {connectedSupabaseHost}</p>
                  {materialError && !showUploadModal && (
                    <p className="text-sm text-red-500 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {materialError}
                    </p>
                  )}
                  {materialSuccess && (
                    <p className="text-sm text-emerald-500">{materialSuccess}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowUploadModal(true);
                    setMaterialError("");
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-600/20"
                >
                  <Upload className="w-5 h-5" />
                  Upload Material
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {loadingMaterials ? (
                  <div className="bg-gray-900/60 rounded-xl p-6 border border-white/10 text-gray-400">Loading materials...</div>
                ) : materials.length === 0 ? (
                  <div className="bg-gray-900/60 rounded-xl p-6 border border-white/10 text-gray-400">No materials uploaded yet.</div>
                ) : (
                  materials.map((material) => (
                    <div key={material.id} className="bg-gray-900/60 rounded-xl p-6 border border-white/10 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                          {getFileIcon(material.file_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-white mb-1">{material.title}</h3>
                          <p className="text-sm text-gray-400 mb-3">{material.description || "No description provided"}</p>
                          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                            {material.subject && (
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-4 h-4" />
                                {material.subject}
                              </span>
                            )}
                            {material.section && (
                              <span className="flex items-center gap-1">
                                <FolderOpen className="w-4 h-4" />
                                {material.section}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <File className="w-4 h-4" />
                              {material.file_type}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {material.created_at ? new Date(material.created_at).toLocaleDateString() : "N/A"}
                            </span>
                            <a
                              href={material.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-emerald-500 hover:text-emerald-400"
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </a>
                            <a
                              href={material.file_url}
                              download={material.file_name || material.title}
                              className="flex items-center gap-1 text-emerald-500 hover:text-emerald-400"
                            >
                              <Download className="w-4 h-4" />
                              Download
                            </a>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <a href={material.file_url} target="_blank" rel="noreferrer" className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                            <Eye className="w-5 h-5" />
                          </a>
                          <button className="p-2 text-gray-500 hover:bg-white/5 rounded-lg transition-colors" disabled>
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "activities" && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowActivityModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-600/20"
                >
                  <Plus className="w-5 h-5" />
                  Create Activity
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {activities.map((activity) => (
                  <div key={activity.id} className="bg-gray-900/60 rounded-xl p-6 border border-white/10 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-1">{activity.title}</h3>
                        <p className="text-sm text-gray-400 mb-3">{activity.description}</p>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-3">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-4 h-4" />
                            {activity.subject}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Due: {new Date(activity.dueDate).toLocaleDateString()}
                          </span>
                          <span>Max Points: {activity.maxPoints}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-emerald-600 h-2 rounded-full transition-all"
                              style={{ width: `${(activity.submissions / activity.totalStudents) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-400">
                            {activity.submissions}/{activity.totalStudents} submitted
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                          <Eye className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900/60 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="sticky top-0 bg-gray-900/60 border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Upload Class Material</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  clearMaterialForm();
                }}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {materialError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {materialError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title *</label>
                <input
                  type="text"
                  value={materialForm.title}
                  onChange={(e) => setMaterialForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="e.g., Chapter 5 Notes"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  rows={3}
                  value={materialForm.description}
                  onChange={(e) => setMaterialForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Brief description of the material"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">File Type *</label>
                <CustomSelect
                  options={FILE_TYPE_OPTIONS}
                  value={materialForm.fileType}
                  onChange={(value) => setMaterialForm((prev) => ({ ...prev, fileType: value }))}
                  placeholder="Select file type"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Subject (optional)</label>
                <CustomSelect
                  options={subjectOptions}
                  value={materialForm.subject}
                  onChange={(value) => setMaterialForm((prev) => ({ ...prev, subject: value }))}
                  placeholder="Select subject"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Section/Class (optional)</label>
                <CustomSelect
                  options={sectionOptions}
                  value={materialForm.section}
                  onChange={(value) => setMaterialForm((prev) => ({ ...prev, section: value }))}
                  placeholder="Select section"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Attach File *</label>
                <input
                  ref={materialFileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleMaterialFileChange}
                />
                <div
                  onClick={handleMaterialFileClick}
                  className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-emerald-500 transition-colors cursor-pointer"
                >
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 mb-1">
                    {materialFileName || "Click to upload or drag and drop"}
                  </p>
                  <p className="text-xs text-gray-500">Supported file uploads up to your storage limit</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    clearMaterialForm();
                  }}
                  className="flex-1 px-6 py-3 border border-white/20 text-gray-300 rounded-lg hover:bg-black/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadMaterial}
                  disabled={isUploadingMaterial}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isUploadingMaterial ? "Uploading..." : "Upload Material"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showActivityModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900/60 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="sticky top-0 bg-gray-900/60 border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Create Activity</h3>
              <button
                onClick={() => setShowActivityModal(false)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Activity Title *</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="e.g., Problem Set 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Instructions *</label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-2 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Detailed instructions for students"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Subject *</label>
                  <CustomSelect
                    options={ACTIVITY_SUBJECT_OPTIONS}
                    value=""
                    onChange={() => {}}
                    placeholder="Select subject"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Max Points *</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Due Date *</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 bg-black/20 text-white placeholder-gray-500 border border-white/20 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Attach File (optional)</label>
                <input
                  ref={activityFileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleActivityFileChange}
                />
                <div
                  onClick={handleActivityFileClick}
                  className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:border-emerald-500 transition-colors cursor-pointer"
                >
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 mb-1">
                    {activityFileName || "Click to upload or drag and drop"}
                  </p>
                  <p className="text-xs text-gray-500">PDF, DOC, DOCX, ZIP (max 50MB)</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowActivityModal(false)}
                  className="flex-1 px-6 py-3 border border-white/20 text-gray-300 rounded-lg hover:bg-black/20 transition-colors"
                >
                  Cancel
                </button>
                <button className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all">
                  Create Activity
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { ClassMaterials };
