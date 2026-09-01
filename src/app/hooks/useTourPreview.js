import { useTeacherTour } from "../context/TeacherTourContext";
import { useModuleTour } from "../context/ModuleTourContext";
import { useTour } from "../context/TourContext";
import { MOCK_TOUR_DATA } from "../config/tourMockData";

export function useTourPreview() {
  let isTeacherActive = false;
  let isModuleActive = false;
  let isAdminActive = false;

  try {
    const teacherContext = useTeacherTour();
    isTeacherActive = !!(teacherContext?.isTourActive || teacherContext?.isPreparingTour);
  } catch {
    // Ignore context error if outside provider
  }

  try {
    const moduleContext = useModuleTour();
    isModuleActive = !!(moduleContext?.isTourActive || moduleContext?.isPreparingTour);
  } catch {
    // Ignore context error if outside provider
  }

  try {
    const adminContext = useTour();
    isAdminActive = !!(adminContext?.isTourActive || adminContext?.isPreparingTour);
  } catch {
    // Ignore context error if outside provider
  }

  const isDemoMode = isTeacherActive || isModuleActive || isAdminActive;

  return {
    isDemoMode,
    mockData: MOCK_TOUR_DATA,
  };
}
