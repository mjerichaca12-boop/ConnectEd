import React, { useState, useEffect } from "react";
import { X, Upload, Link, Loader2, AlertTriangle, CheckCircle2, FileSpreadsheet, ArrowRight, RefreshCw, Check } from "lucide-react";
import {
  extractSpreadsheetDetails,
  fetchGoogleSheetMetadata,
  fetchGoogleSheetCsv,
  parseCsvContent,
  sanitizeLrn
} from "@/app/services/googleSheetsService";
import { toast } from "sonner";

export function GoogleSheetsImportModal({
  isOpen,
  onClose,
  type = "student", // "student" or "teacher"
  onConfirmImport,
  onTriggerFileUpload,
  existingDbRecords = [],
  existingPendingRequests = []
}) {
  const [step, setStep] = useState("method"); // "method", "link_input", "sheet_select", "column_mapping", "preview"
  const [sheetUrl, setSheetUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [accessError, setAccessError] = useState("");
  
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [availableSheets, setAvailableSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState(null); // { gid, name }

  const [rawRows, setRawRows] = useState([]);
  const [headerCols, setHeaderCols] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [previewSummary, setPreviewSummary] = useState({
    total: 0,
    valid: [],
    invalid: [],
    duplicates: [],
    missingEmail: []
  });
  const [previewTab, setPreviewTab] = useState("valid");

  useEffect(() => {
    if (!isOpen) {
      setStep("method");
      setSheetUrl("");
      setIsLoading(false);
      setAccessError("");
      setSpreadsheetId("");
      setAvailableSheets([]);
      setSelectedSheet(null);
      setRawRows([]);
      setHeaderCols([]);
      setColumnMapping({});
      setPreviewSummary({ total: 0, valid: [], invalid: [], duplicates: [], missingEmail: [] });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const expectedFields = type === "student" ? [
    { key: "first_name", label: "First Name", required: true },
    { key: "middle_name", label: "Middle Name", required: false },
    { key: "last_name", label: "Last Name", required: true },
    { key: "suffix", label: "Suffix / Extension", required: false },
    { key: "email", label: "Email Address", required: true },
    { key: "lrn", label: "LRN (12 Digits)", required: true },
    { key: "year_level", label: "Grade / Year Level", required: true },
    { key: "section", label: "Section", required: false }
  ] : [
    { key: "first_name", label: "First Name", required: true },
    { key: "middle_name", label: "Middle Name", required: false },
    { key: "last_name", label: "Last Name", required: true },
    { key: "suffix", label: "Suffix / Extension", required: false },
    { key: "email", label: "Email Address", required: true },
    { key: "employee_id", label: "Employee ID / Identification", required: false }
  ];

  const handleValidateLink = async () => {
    setAccessError("");
    if (!sheetUrl.trim()) {
      setAccessError("Please enter a Google Sheets URL.");
      return;
    }

    let extracted;
    try {
      extracted = extractSpreadsheetDetails(sheetUrl);
    } catch (err) {
      setAccessError(err.message || "Invalid Google Sheets URL.");
      return;
    }

    setSpreadsheetId(extracted.spreadsheetId);
    setIsLoading(true);
    setLoadingText("Validating Google Sheet access...");

    try {
      const sheets = await fetchGoogleSheetMetadata(extracted.spreadsheetId);
      setAvailableSheets(sheets);

      if (extracted.gid && sheets.length > 0) {
        const found = sheets.find(s => s.gid === extracted.gid);
        if (found) {
          await loadSheetData(extracted.spreadsheetId, found.gid, found.name);
          return;
        }
      }

      if (sheets.length > 1) {
        setSelectedSheet(sheets[0]);
        setStep("sheet_select");
      } else if (sheets.length === 1) {
        setSelectedSheet(sheets[0]);
        await loadSheetData(extracted.spreadsheetId, sheets[0].gid, sheets[0].name);
      } else {
        await loadSheetData(extracted.spreadsheetId, extracted.gid || "0", null);
      }
    } catch (err) {
      setAccessError(err.message || "Unable to access Google Sheet.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadSheetData = async (spId, gid, sheetName) => {
    setIsLoading(true);
    setLoadingText("Reading masterlist...");
    setAccessError("");

    try {
      const csvText = await fetchGoogleSheetCsv({ spreadsheetId: spId, gid, sheetName });
      const rows = parseCsvContent(csvText);

      if (!rows || rows.length === 0) {
        setAccessError("The selected sheet is empty or contains no data.");
        setIsLoading(false);
        return;
      }

      setRawRows(rows);
      const headers = rows[0].map(h => String(h || "").trim());
      setHeaderCols(headers);

      // Auto-preselect column mappings
      const initialMap = {};
      expectedFields.forEach(field => {
        const normKey = field.key.toLowerCase().replace(/[^a-z0-9]/g, "");
        const labelKey = field.label.toLowerCase().replace(/[^a-z0-9]/g, "");

        const matchedIdx = headers.findIndex((h, idx) => {
          const normH = h.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (!normH) return false;
          if (normH === normKey || normH === labelKey) return true;
          if (field.key === "first_name" && (normH.includes("first") || normH === "givenname" || normH === "fname")) return true;
          if (field.key === "last_name" && (normH.includes("last") || normH === "surname" || normH === "lname")) return true;
          if (field.key === "middle_name" && (normH.includes("middle") || normH === "mname")) return true;
          if (field.key === "email" && (normH.includes("email") || normH.includes("mail"))) return true;
          if (field.key === "lrn" && normH.includes("lrn")) return true;
          if (field.key === "employee_id" && (normH.includes("employee") || normH.includes("empid") || normH === "id")) return true;
          if (field.key === "year_level" && (normH.includes("grade") || normH.includes("year") || normH.includes("level"))) return true;
          if (field.key === "section" && normH.includes("section")) return true;
          return false;
        });

        if (matchedIdx !== -1) {
          initialMap[field.key] = matchedIdx;
        } else {
          initialMap[field.key] = -1;
        }
      });

      setColumnMapping(initialMap);
      setStep("column_mapping");
    } catch (err) {
      setAccessError(err.message || "Failed to read Google Sheet data.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessPreview = () => {
    setIsLoading(true);
    setLoadingText("Analyzing records...");

    setTimeout(() => {
      try {
        const dataRows = rawRows.slice(1);
        const valid = [];
        const invalid = [];
        const duplicates = [];
        const missingEmail = [];

        const fileLrnSet = new Set();
        const fileEmailSet = new Set();
        const fileEmpIdSet = new Set();

        const dbLrnSet = new Set((existingDbRecords || []).map(r => (r.lrn || "").trim()).filter(Boolean));
        const dbEmailSet = new Set((existingDbRecords || []).map(r => (r.email || "").toLowerCase().trim()).filter(Boolean));
        const dbEmpIdSet = new Set((existingDbRecords || []).map(r => (r.employee_id || r.lrn || "").toLowerCase().trim()).filter(Boolean));

        (existingPendingRequests || []).forEach(r => {
          if (r.lrn) dbLrnSet.add(r.lrn.trim());
          if (r.email) dbEmailSet.add(r.email.toLowerCase().trim());
          const emp = r.employee_id || r.lrn;
          if (emp) dbEmpIdSet.add(emp.toLowerCase().trim());
        });

        for (let i = 0; i < dataRows.length; i++) {
          const cols = dataRows[i];
          const rowNum = i + 2;

          if (!cols || cols.length === 0 || cols.every(c => !c || !c.trim())) continue;

          const getColVal = (key) => {
            const colIdx = columnMapping[key];
            if (colIdx !== undefined && colIdx !== -1 && cols[colIdx] !== undefined) {
              return String(cols[colIdx] || "").trim();
            }
            return "";
          };

          const firstName = getColVal("first_name");
          const middleName = getColVal("middle_name");
          const lastName = getColVal("last_name");
          const suffix = getColVal("suffix");
          const email = getColVal("email");
          const rawLrn = getColVal("lrn");
          const cleanLrn = sanitizeLrn(rawLrn);
          const rawYearLevel = getColVal("year_level");
          const section = getColVal("section");
          const empId = getColVal("employee_id");

          const fullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(" ") || "N/A";

          if (!firstName || !lastName) {
            invalid.push({ rowNum, fullName, lrn: cleanLrn || empId || "-", reason: "Missing first or last name." });
            continue;
          }

          if (type === "student") {
            if (!cleanLrn || cleanLrn.length !== 12) {
              invalid.push({ rowNum, fullName, lrn: rawLrn || "Empty", reason: `Invalid LRN (${rawLrn || "empty"}). Must be exactly 12 numeric digits.` });
              continue;
            }

            if (!rawYearLevel) {
              invalid.push({ rowNum, fullName, lrn: cleanLrn, reason: "Missing Grade / Year Level." });
              continue;
            }
          }

          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            missingEmail.push({ rowNum, fullName, email: email || "Missing", lrn: cleanLrn || empId || "-", reason: !email ? "Missing email address." : "Invalid email format." });
            continue;
          }

          const emailLow = email.toLowerCase();
          const empIdLow = empId ? empId.toLowerCase() : "";

          if (type === "student") {
            if (fileLrnSet.has(cleanLrn)) {
              duplicates.push({ rowNum, fullName, lrn: cleanLrn, email, reason: "Duplicate LRN in uploaded sheet." });
              continue;
            }
            fileLrnSet.add(cleanLrn);

            if (dbLrnSet.has(cleanLrn)) {
              duplicates.push({ rowNum, fullName, lrn: cleanLrn, email, reason: `Student with LRN ${cleanLrn} already exists.` });
              continue;
            }
          } else {
            if (fileEmailSet.has(emailLow) || (empIdLow && fileEmpIdSet.has(empIdLow))) {
              duplicates.push({ rowNum, fullName, lrn: empId || "-", email, reason: "Duplicate email or employee ID in sheet." });
              continue;
            }
            if (empIdLow) fileEmpIdSet.add(empIdLow);
          }

          if (dbEmailSet.has(emailLow)) {
            duplicates.push({ rowNum, fullName, lrn: cleanLrn || empId || "-", email, reason: `Email ${email} already registered or pending.` });
            continue;
          }
          fileEmailSet.add(emailLow);

          const record = {
            rowNum,
            first_name: firstName,
            middle_name: middleName || null,
            last_name: lastName,
            suffix: suffix || null,
            email,
            fullName
          };

          if (type === "student") {
            record.lrn = cleanLrn;
            record.year_level = rawYearLevel.replace(/\D/g, "") || rawYearLevel;
            record.section = section || null;
            record.account_created = false;
          } else {
            record.employee_id = empId || null;
            record.lrn = empId || null;
          }

          valid.push(record);
        }

        setPreviewSummary({
          total: valid.length + invalid.length + duplicates.length + missingEmail.length,
          valid,
          invalid,
          duplicates,
          missingEmail
        });

        setPreviewTab(valid.length > 0 ? "valid" : (missingEmail.length > 0 ? "missingEmail" : "duplicates"));
        setStep("preview");
      } catch (err) {
        toast.error("Failed to parse sheet records.");
      } finally {
        setIsLoading(false);
      }
    }, 200);
  };

  const handleConfirm = async () => {
    if (previewSummary.valid.length === 0) {
      toast.error("No valid records to import.");
      return;
    }

    setIsLoading(true);
    setLoadingText(`Importing ${previewSummary.valid.length} records...`);

    try {
      await onConfirmImport({
        validRecords: previewSummary.valid,
        spreadsheetId,
        sheetName: selectedSheet?.name || null,
        gid: selectedSheet?.gid || null
      });
      onClose();
    } catch (err) {
      toast.error(err.message || "Import failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Import {type === "student" ? "Student Masterlist" : "Teachers Masterlist"}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {step === "preview"
                  ? `Review parsed ${type === "student" ? "student" : "teacher"} records before creating registration requests`
                  : "Choose import source: Upload CSV/Excel file or link Google Sheets"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: METHOD SELECTION */}
          {step === "method" && (
            <div className="space-y-6 py-4">
              <p className="text-sm font-semibold text-gray-700 text-center">
                How would you like to import {type === "student" ? "students" : "teachers"}?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onTriggerFileUpload) onTriggerFileUpload();
                  }}
                  className="p-6 rounded-2xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-emerald-100 text-gray-600 group-hover:text-emerald-600 flex items-center justify-center mb-4 transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-gray-900 mb-1">Upload File</h4>
                  <p className="text-xs text-gray-500">Upload a CSV, Excel (.xlsx), or text file from your computer.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setStep("link_input")}
                  className="p-6 rounded-2xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-emerald-100 text-gray-600 group-hover:text-emerald-600 flex items-center justify-center mb-4 transition-colors">
                    <Link className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-gray-900 mb-1">Google Sheets Link</h4>
                  <p className="text-xs text-gray-500">Link a public Google Sheets URL to import records dynamically.</p>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: LINK INPUT */}
          {step === "link_input" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Google Sheets URL</label>
                <div className="relative">
                  <input
                    type="url"
                    value={sheetUrl}
                    onChange={(e) => { setSheetUrl(e.target.value); setAccessError(""); }}
                    placeholder="https://docs.google.com/spreadsheets/d/XXXXXXXXXXXX/edit"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Example: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">https://docs.google.com/spreadsheets/d/1BxiMVs.../edit</code>
                </p>
              </div>

              {accessError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex gap-3 items-start">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="whitespace-pre-line leading-relaxed font-medium">
                    {accessError}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setStep("method")}
                  disabled={isLoading}
                  className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleValidateLink}
                  disabled={isLoading || !sheetUrl.trim()}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isLoading ? loadingText : "Validate Link"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SHEET TAB SELECTION */}
          {step === "sheet_select" && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-gray-800">
                Select Sheet / Tab to Import:
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2">
                {availableSheets.map((s, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedSheet?.gid === s.gid
                        ? "bg-emerald-50 border-emerald-500 text-emerald-900 font-bold"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sheet_tab"
                      checked={selectedSheet?.gid === s.gid}
                      onChange={() => setSelectedSheet(s)}
                      className="accent-emerald-600 w-4 h-4"
                    />
                    <span className="text-sm">{s.name}</span>
                  </label>
                ))}
              </div>

              {accessError && (
                <p className="text-xs text-red-600 font-semibold">{accessError}</p>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setStep("link_input")}
                  disabled={isLoading}
                  className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => loadSheetData(spreadsheetId, selectedSheet.gid, selectedSheet.name)}
                  disabled={isLoading || !selectedSheet}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isLoading ? loadingText : "Load Preview"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: COLUMN MAPPING */}
          {step === "column_mapping" && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold text-gray-900 mb-1">Map ConnectEd Fields to Sheet Columns</p>
                <p className="text-xs text-gray-500">We auto-detected header columns. Please confirm or correct field mappings below.</p>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                {expectedFields.map((field) => (
                  <div key={field.key} className="grid grid-cols-1 sm:grid-cols-2 items-center gap-2 bg-white p-2.5 rounded-lg border border-gray-200">
                    <span className="text-xs font-semibold text-gray-700">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </span>
                    <select
                      value={columnMapping[field.key] !== undefined ? columnMapping[field.key] : -1}
                      onChange={(e) => setColumnMapping({ ...columnMapping, [field.key]: parseInt(e.target.value) })}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value={-1}>-- Not Mapped --</option>
                      {headerCols.map((colName, idx) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {colName || `Column ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setStep(availableSheets.length > 1 ? "sheet_select" : "link_input")}
                  className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleProcessPreview}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  Continue to Preview
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: PREVIEW */}
          {step === "preview" && (
            <div className="space-y-5">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">TOTAL PARSED</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{previewSummary.total}</p>
                </div>
                <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-300">
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">READY</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{previewSummary.valid.length}</p>
                </div>
                <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-300">
                  <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">MISSING EMAIL</p>
                  <p className="text-2xl font-bold text-amber-700 mt-1">{previewSummary.missingEmail.length}</p>
                </div>
                <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-300">
                  <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">DUPLICATES</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{previewSummary.duplicates.length}</p>
                </div>
              </div>

              <div className="flex border-b border-gray-200 gap-6 px-1">
                <button
                  type="button"
                  onClick={() => setPreviewTab("valid")}
                  className={`pb-2.5 text-xs font-bold transition-all relative ${
                    previewTab === "valid" ? "text-emerald-700" : "text-slate-500 hover:text-slate-700 font-medium"
                  }`}
                >
                  Ready ({previewSummary.valid.length})
                  {previewTab === "valid" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("missingEmail")}
                  className={`pb-2.5 text-xs font-bold transition-all relative ${
                    previewTab === "missingEmail" ? "text-amber-700" : "text-slate-500 hover:text-slate-700 font-medium"
                  }`}
                >
                  Missing Email ({previewSummary.missingEmail.length})
                  {previewTab === "missingEmail" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 rounded-full" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("duplicates")}
                  className={`pb-2.5 text-xs font-bold transition-all relative ${
                    previewTab === "duplicates" ? "text-blue-700" : "text-slate-500 hover:text-slate-700 font-medium"
                  }`}
                >
                  Duplicates ({previewSummary.duplicates.length})
                  {previewTab === "duplicates" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </button>
                {previewSummary.invalid.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPreviewTab("invalid")}
                    className={`pb-2.5 text-xs font-bold transition-all relative ${
                      previewTab === "invalid" ? "text-red-700" : "text-slate-500 hover:text-slate-700 font-medium"
                    }`}
                  >
                    Invalid ({previewSummary.invalid.length})
                    {previewTab === "invalid" && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 rounded-full" />
                    )}
                  </button>
                )}
              </div>

              {previewTab === "valid" && (
                <div className="max-h-56 overflow-y-auto border border-emerald-300 rounded-2xl divide-y divide-emerald-100 bg-white">
                  {previewSummary.valid.length === 0 ? (
                    <p className="p-6 text-slate-500 text-center text-xs">No ready records found.</p>
                  ) : (
                    previewSummary.valid.map((r, idx) => (
                      <div key={idx} className="p-3.5 flex justify-between items-center hover:bg-emerald-50/30 transition-colors">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{r.fullName}</p>
                          <p className="text-xs text-slate-500 mt-0.5 font-medium">
                            {r.email} {r.lrn ? `• LRN: ${r.lrn}` : r.employee_id ? `• ID: ${r.employee_id}` : ""}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-md font-semibold text-xs shrink-0">
                          Ready
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {previewTab === "missingEmail" && (
                <div className="max-h-56 overflow-y-auto border border-amber-300 rounded-2xl divide-y divide-amber-100 bg-white">
                  {previewSummary.missingEmail.length === 0 ? (
                    <p className="p-6 text-slate-500 text-center text-xs">No missing email records.</p>
                  ) : (
                    previewSummary.missingEmail.map((r, idx) => (
                      <div key={idx} className="p-3.5 flex justify-between items-center hover:bg-amber-50/30 transition-colors">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{r.fullName}</p>
                          <p className="text-xs text-amber-700 mt-0.5 font-normal">{r.reason || "Missing email address"}</p>
                        </div>
                        <span className="px-3 py-1 bg-amber-100 text-amber-800 font-semibold rounded-md text-xs shrink-0">
                          Missing Email
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {previewTab === "duplicates" && (
                <div className="max-h-56 overflow-y-auto border border-blue-300 rounded-2xl divide-y divide-blue-100 bg-white">
                  {previewSummary.duplicates.length === 0 ? (
                    <p className="p-6 text-slate-500 text-center text-xs">No duplicate records.</p>
                  ) : (
                    previewSummary.duplicates.map((r, idx) => (
                      <div key={idx} className="p-3.5 flex justify-between items-center hover:bg-blue-50/30 transition-colors">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{r.fullName}</p>
                          <p className="text-xs text-blue-700 mt-0.5 font-normal">{r.reason || "Duplicate record"}</p>
                        </div>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 font-semibold rounded-md text-xs shrink-0">
                          Duplicate
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {previewTab === "invalid" && (
                <div className="max-h-56 overflow-y-auto border border-red-300 rounded-2xl divide-y divide-red-100 bg-white">
                  {previewSummary.invalid.length === 0 ? (
                    <p className="p-6 text-slate-500 text-center text-xs">No invalid records.</p>
                  ) : (
                    previewSummary.invalid.map((r, idx) => (
                      <div key={idx} className="p-3.5 flex justify-between items-center hover:bg-red-50/30 transition-colors">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{r.fullName}</p>
                          <p className="text-xs text-red-700 mt-0.5 font-normal">{r.reason || "Invalid format"}</p>
                        </div>
                        <span className="px-3 py-1 bg-red-100 text-red-800 font-semibold rounded-md text-xs shrink-0">
                          Invalid
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    const csvContent = type === "student"
                      ? "First Name,Middle Name,Last Name,Suffix,Email,LRN,Grade Level,Section\nJuan,D,Dela Cruz,,juan.delacruz@student.edu.ph,123456789012,7,Rizal\nMaria,S,Santos,,maria.santos@student.edu.ph,123456789013,7,Bonifacio"
                      : "First Name,Middle Name,Last Name,Suffix,Email,Employee ID\nJuan,D,Dela Cruz,,juan.delacruz@school.edu.ph,EMP-2026-001\nMaria,S,Santos,,maria.santos@school.edu.ph,EMP-2026-002";
                    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", `${type}_masterlist_template.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download Sample CSV
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isLoading}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isLoading || previewSummary.valid.length === 0}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isLoading ? loadingText : `Confirm & Create ${previewSummary.valid.length} Registration Request(s)`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
