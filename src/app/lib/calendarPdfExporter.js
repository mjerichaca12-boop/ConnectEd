import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Format a date string (YYYY-MM-DD) for display in PDF
 */
const formatPdfDate = (dateStr) => {
  if (!dateStr) return "N/A";
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

/**
 * Format a time string (HH:mm) for display in PDF
 */
const formatPdfTime = (timeStr) => {
  if (!timeStr) return "All day";
  const [hours, minutes = "00"] = String(timeStr).split(":");
  const parsedHours = Number(hours);
  if (Number.isNaN(parsedHours)) return timeStr;
  const date = new Date();
  date.setHours(parsedHours, Number(minutes), 0, 0);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

/**
 * Generate and download a PDF Calendar of Events for a given quarter or entire school year
 * 
 * @param {Object} params
 * @param {Array} params.events - Array of event objects
 * @param {string} params.schoolYear - e.g. "2026-2027"
 * @param {string} params.quarter - e.g. "Quarter 1", "Quarter 2", "Quarter 3", or "Entire School Year"
 * @param {string} [params.schoolName] - Name of the school / institution
 */
export const generateCalendarPdf = ({
  events = [],
  schoolYear = "2026-2027",
  quarter = "Entire School Year",
  schoolName = "CONNECTED LEARNING MANAGEMENT SYSTEM"
}) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Colors & Styling
  doc.setFillColor(5, 150, 105); // Emerald-600 #059669
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(String(schoolName).toUpperCase(), pageWidth / 2, 12, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("OFFICIAL CALENDAR OF EVENTS", pageWidth / 2, 20, { align: "center" });

  // Subheader Metadata
  doc.setTextColor(31, 41, 55); // Gray-800
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  
  const subtitleText = `School Year: ${schoolYear}   |   Period: ${quarter}`;
  doc.text(subtitleText, 14, 36);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128); // Gray-500
  const totalCountText = `Total Scheduled Events: ${events.length}   |   Generated: ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  doc.text(totalCountText, 14, 42);

  doc.setLineWidth(0.4);
  doc.setDrawColor(229, 231, 235); // Gray-200
  doc.line(14, 45, pageWidth - 14, 45);

  let currentY = 50;

  const isEntireYear = String(quarter).toLowerCase().includes("entire") || String(quarter).toLowerCase().includes("all");

  if (isEntireYear) {
    const quartersList = ["Quarter 1", "Quarter 2", "Quarter 3"];

    quartersList.forEach((qName, qIdx) => {
      const qEvents = events.filter((e) => {
        const qVal = String(e.quarter || "").toLowerCase();
        if (qIdx === 0) return qVal.includes("1");
        if (qIdx === 1) return qVal.includes("2");
        if (qIdx === 2) return qVal.includes("3");
        return false;
      });

      // Draw Section Title
      doc.setFillColor(243, 244, 246); // Gray-100
      doc.rect(14, currentY, pageWidth - 28, 8, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(5, 150, 105);
      doc.text(qName.toUpperCase(), 18, currentY + 5.5);

      currentY += 10;

      const tableRows = qEvents.length > 0
        ? qEvents.map((evt) => [
            formatPdfDate(evt.eventDate),
            formatPdfTime(evt.eventTime),
            evt.title || "Untitled Event",
            evt.targetAudience || "School-wide",
            evt.description || "—"
          ])
        : [["—", "—", "No events scheduled for this quarter", "—", "—"]];

      autoTable(doc, {
        startY: currentY,
        head: [["Date", "Time", "Event Title", "Audience", "Description"]],
        body: tableRows,
        theme: "grid",
        headStyles: {
          fillColor: [16, 185, 129], // Emerald-500
          textColor: 255,
          fontStyle: "bold",
          fontSize: 9
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 3,
          textColor: [55, 65, 81]
        },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 22 },
          2: { cellWidth: 45, fontStyle: "bold" },
          3: { cellWidth: 28 },
          4: { cellWidth: "auto" }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 8;
    });
  } else {
    // Single Quarter Export
    const tableRows = events.length > 0
      ? events.map((evt) => [
          formatPdfDate(evt.eventDate),
          formatPdfTime(evt.eventTime),
          evt.title || "Untitled Event",
          evt.targetAudience || "School-wide",
          evt.description || "—"
        ])
      : [["—", "—", "No events scheduled for this period", "—", "—"]];

    autoTable(doc, {
      startY: currentY,
      head: [["Date", "Time", "Event Title", "Audience", "Description"]],
      body: tableRows,
      theme: "grid",
      headStyles: {
        fillColor: [5, 150, 105], // Emerald-600
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 3.5,
        textColor: [55, 65, 81]
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 24 },
        2: { cellWidth: 48, fontStyle: "bold" },
        3: { cellWidth: 30 },
        4: { cellWidth: "auto" }
      },
      margin: { left: 14, right: 14 }
    });
  }

  // Page Numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Page ${i} of ${totalPages}   •   ConnectEd LMS Calendar of Events`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
  }

  // Generate File Name
  const cleanSY = String(schoolYear).replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "");
  const cleanQuarter = String(quarter).replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "");
  const fileName = `Calendar_of_Events_SY_${cleanSY}_${cleanQuarter}.pdf`;

  doc.save(fileName);
};
