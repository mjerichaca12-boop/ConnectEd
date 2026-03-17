import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

// Philippines official holidays (regular and special non-working days) - key: "month-day"
function getPhilippinesHolidays(year: number): Map<string, string> {
  const lastMondayAugust = (() => {
    const d = new Date(year, 7, 31); // Aug 31
    let day = d.getDay();
    if (day === 0) day = 7; // Sun -> 7
    d.setDate(d.getDate() - day + 1);
    return d.getDate();
  })();
  const holidays = new Map<string, string>([
    ['1-1', "New Year's Day"],
    ['2-17', 'Chinese New Year'],
    ['4-2', 'Maundy Thursday'],
    ['4-3', 'Good Friday'],
    ['4-4', 'Black Saturday'],
    ['4-9', 'Araw ng Kagitingan'],
    ['5-1', 'Labor Day'],
    ['6-12', 'Independence Day'],
    ['8-21', 'Ninoy Aquino Day'],
    ['11-1', "All Saints' Day"],
    ['11-2', "All Souls' Day"],
    ['11-30', 'Bonifacio Day'],
    ['12-8', 'Feast of the Immaculate Conception'],
    ['12-24', 'Christmas Eve'],
    ['12-25', 'Christmas Day'],
    ['12-30', 'Rizal Day'],
    ['12-31', 'Last Day of the Year'],
  ]);
  holidays.set(`8-${lastMondayAugust}`, 'National Heroes Day');
  return holidays;
}

export function DashboardCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const holidays = useMemo(() => getPhilippinesHolidays(year), [year]);

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getHolidayLabel = (day: number) => {
    const key = `${month + 1}-${day}`;
    return holidays.get(key) || null;
  };

  const renderDays = () => {
    const totalDays = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);
    const dayElements = [];

    for (let i = 0; i < firstDay; i++) {
      dayElements.push(<div key={`empty-${i}`} className="h-10" />);
    }

    for (let day = 1; day <= totalDays; day++) {
      const isToday =
        day === new Date().getDate() &&
        month === new Date().getMonth() &&
        year === new Date().getFullYear();
      const holidayLabel = getHolidayLabel(day);
      const isHoliday = !!holidayLabel;

      dayElements.push(
        <div
          key={day}
          title={holidayLabel || undefined}
          className={`h-10 flex flex-col items-center justify-center text-sm rounded-lg transition-colors cursor-default
            ${isToday ? 'bg-emerald-600 text-white font-bold' : ''}
            ${!isToday && isHoliday ? 'bg-red-100 text-red-700 font-medium' : ''}
            ${!isToday && !isHoliday ? 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-600' : ''}`}
        >
          <span>{day}</span>
          {isHoliday && !isToday && <span className="w-1 h-1 rounded-full bg-red-500 mt-0.5" />}
        </div>
      );
    }

    return dayElements;
  };

  // List of PH holidays in current month for "Upcoming" section
  const currentMonthHolidays = useMemo(() => {
    const list: { day: number; label: string }[] = [];
    const totalDays = daysInMonth(year, month);
    for (let day = 1; day <= totalDays; day++) {
      const label = getHolidayLabel(day);
      if (label) list.push({ day, label });
    }
    return list;
  }, [year, month, holidays]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-100 rounded-lg">
            <CalendarIcon className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">School Calendar</h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-200 rounded-md transition-colors cursor-pointer">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-200 rounded-md transition-colors cursor-pointer">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>
      <div className="p-4">
        <div className="text-center mb-4">
          <span className="text-sm font-bold text-gray-900">
            {monthNames[month]} {year}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {days.map(day => (
            <div key={day} className="text-[10px] font-bold text-gray-400 uppercase text-center">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {renderDays()}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Philippines Holidays (this month)</p>
          <div className="space-y-2">
            {currentMonthHolidays.length > 0 ? (
              currentMonthHolidays.map(({ day, label }) => (
                <div key={`${day}-${label}`} className="flex items-start gap-3 p-2 bg-red-50 rounded-lg">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-900">{label}</p>
                    <p className="text-[10px] text-gray-500">
                      {monthNames[month]} {day}, {year}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500">No holidays this month</p>
            )}
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 mt-3">Upcoming Events</p>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-2 bg-emerald-50 rounded-lg">
              <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full mt-1.5" />
              <div>
                <p className="text-xs font-medium text-gray-900">Mid-term Exams</p>
                <p className="text-[10px] text-gray-500">Jan 20 - Jan 24</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-2 bg-blue-50 rounded-lg">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5" />
              <div>
                <p className="text-xs font-medium text-gray-900">Sports Festival</p>
                <p className="text-[10px] text-gray-500">Feb 15 - Feb 18</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
