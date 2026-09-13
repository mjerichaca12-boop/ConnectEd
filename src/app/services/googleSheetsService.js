/**
 * Google Sheets Service for ConnectEd LMS
 * Zero-credential client-side fetch for publicly accessible Google Sheets ("Anyone with the link can view").
 */

export function extractSpreadsheetDetails(urlStr) {
  if (!urlStr || typeof urlStr !== "string") {
    throw new Error("Please enter a valid Google Sheets URL.");
  }

  const trimmed = urlStr.trim();
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) {
    throw new Error("Invalid Google Sheets URL format. Example: https://docs.google.com/spreadsheets/d/XXXXXXXXXXXX/edit");
  }

  const spreadsheetId = idMatch[1];
  const gidMatch = trimmed.match(/[?&]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : null;

  return { spreadsheetId, gid };
}

export async function fetchGoogleSheetMetadata(spreadsheetId) {
  const htmlUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview`;

  try {
    const res = await fetch(htmlUrl, { redirect: "follow" });
    
    if (!res.ok || res.url.includes("accounts.google.com")) {
      throw new Error(
        "Unable to access this Google Sheet.\n\nMake sure the sheet is accessible to the configured ConnectEd import process (e.g., 'Anyone with the link can view'), then try again."
      );
    }

    const htmlText = await res.text();
    if (
      htmlText.includes("ServiceLogin") ||
      htmlText.includes("Sign in - Google Accounts") ||
      htmlText.includes("docs-desktop-share-client")
    ) {
      throw new Error(
        "Unable to access this Google Sheet.\n\nMake sure the sheet is accessible to the configured ConnectEd import process (e.g., 'Anyone with the link can view'), then try again."
      );
    }

    const sheets = [];
    const regex = /id="sheet-button-([0-9]+)"[^>]*><a[^>]*>(.*?)<\/a>/g;
    let match;
    while ((match = regex.exec(htmlText)) !== null) {
      const gid = match[1];
      let name = match[2].replace(/<[^>]+>/g, "").trim();
      if (name) {
        sheets.push({ gid, name });
      }
    }

    return sheets;
  } catch (err) {
    if (err.message && err.message.includes("Unable to access")) {
      throw err;
    }
    // Fallback check via GViz endpoint if htmlview is blocked or restricted
    try {
      const gvizRes = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`);
      if (gvizRes.ok) {
        return [{ gid: "0", name: "Sheet1" }];
      }
    } catch {
      // ignore
    }
    throw new Error(
      "Unable to access this Google Sheet.\n\nMake sure the sheet is accessible to the configured ConnectEd import process (e.g., 'Anyone with the link can view'), then try again."
    );
  }
}

export async function fetchGoogleSheetCsv({ spreadsheetId, gid, sheetName }) {
  // Use Google Visualization API (GViz) CSV export which handles CORS directly from docs.google.com without 400 redirect errors
  let primaryUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
  if (gid) {
    primaryUrl += `&gid=${gid}`;
  } else if (sheetName) {
    primaryUrl += `&sheet=${encodeURIComponent(sheetName)}`;
  }

  try {
    const res = await fetch(primaryUrl, { redirect: "follow" });

    if (res.ok && !res.url.includes("accounts.google.com")) {
      const csvText = await res.text();
      if (
        !csvText.trim().startsWith("<!DOCTYPE html") &&
        !csvText.includes("ServiceLogin") &&
        !csvText.includes("Sign in - Google Accounts")
      ) {
        return csvText;
      }
    }

    // Fallback to export endpoint if GViz returns error
    let fallbackUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
    if (gid) fallbackUrl += `&gid=${gid}`;
    else if (sheetName) fallbackUrl += `&sheet=${encodeURIComponent(sheetName)}`;

    const fallbackRes = await fetch(fallbackUrl, { redirect: "follow" });
    if (!fallbackRes.ok || fallbackRes.url.includes("accounts.google.com")) {
      throw new Error(
        "Unable to access this Google Sheet.\n\nMake sure the sheet is accessible to the configured ConnectEd import process (e.g., 'Anyone with the link can view'), then try again."
      );
    }

    const fallbackCsvText = await fallbackRes.text();
    if (
      fallbackCsvText.trim().startsWith("<!DOCTYPE html") ||
      fallbackCsvText.includes("ServiceLogin") ||
      fallbackCsvText.includes("Sign in - Google Accounts")
    ) {
      throw new Error(
        "Unable to access this Google Sheet.\n\nMake sure the sheet is accessible to the configured ConnectEd import process (e.g., 'Anyone with the link can view'), then try again."
      );
    }

    return fallbackCsvText;
  } catch (err) {
    if (err.message && err.message.includes("Unable to access")) {
      throw err;
    }
    throw new Error(
      "Unable to access this Google Sheet.\n\nMake sure the sheet is accessible to the configured ConnectEd import process (e.g., 'Anyone with the link can view'), then try again."
    );
  }
}

export function parseCsvContent(csvText) {
  if (!csvText || typeof csvText !== "string") return [];

  const lines = csvText.split(/\r?\n/);
  const rows = [];

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    if (!line && l === lines.length - 1) continue; // skip trailing newline

    const cols = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === "," || char === "\t" || char === ";") && !inQuotes) {
        cols.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cols.push(current.trim());

    if (cols.some((c) => c.length > 0)) {
      rows.push(cols);
    }
  }

  return rows;
}

export function sanitizeLrn(val) {
  if (val === null || val === undefined) return "";
  let str = String(val).trim();

  // Check scientific notation e.g. 1.23456789012E+11
  if (/^\d+(\.\d+)?[eE]\+\d+$/.test(str)) {
    try {
      const num = Number(str);
      if (!isNaN(num)) {
        const fullStr = num.toLocaleString("fullwide", { useGrouping: false });
        if (/^\d{12}$/.test(fullStr)) {
          return fullStr;
        }
      }
    } catch {
      // fallback
    }
  }

  const cleanNumeric = str.replace(/\D/g, "");
  if (cleanNumeric.length === 12) {
    return cleanNumeric;
  }
  return cleanNumeric || str;
}
