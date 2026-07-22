import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const AcademicContext = createContext();

export const useAcademic = () => {
  return useContext(AcademicContext);
};

export const AcademicProvider = ({ children }) => {
  const [activeSchoolYear, setActiveSchoolYear] = useState("2026-2027");
  const [activeQuarter, setActiveQuarter] = useState("1st Quarter");
  const [viewMode, setViewMode] = useState("current"); // "current" or "all"
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAcademicSettings();
  }, []);

  const fetchAcademicSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("academic_settings")
        .select("*")
        .eq("id", 1)
        .single();

      if (error) throw error;
      if (data) {
        setActiveSchoolYear(data.current_school_year);
        setActiveQuarter(data.current_quarter);
      }
    } catch (error) {
      console.error("Error fetching academic settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    activeSchoolYear,
    activeQuarter,
    viewMode,
    setViewMode,
    loading,
    refreshAcademicSettings: fetchAcademicSettings
  };

  return (
    <AcademicContext.Provider value={value}>
      {children}
    </AcademicContext.Provider>
  );
};
