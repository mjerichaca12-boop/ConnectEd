import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

export function DashboardCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const renderDays = () => {
    const totalDays = daysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    const firstDay = firstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());
    const dayElements = [];

    // Empty spaces for previous month's days
    for (let i = 0; i < firstDay; i++) {
      dayElements.push(<div key={`empty-${i}`} className="h-10"></div>);
    }

    // Days of current month
    for (let day = 1; day <= totalDays; day++) {
      const isToday = 
        day === new Date().getDate() && 
        currentDate.getMonth() === new Date().getMonth() && 
        currentDate.getFullYear() === new Date().getFullYear();

      dayElements.push(
        <div 
          key={day} 
          className={`h-10 flex items-center justify-center text-sm rounded-lg transition-colors cursor-default
            ${isToday ? 'bg-emerald-600 text-white font-bold' : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-600'}`}
        >
          {day}
        </div>
      );
    }

    return dayElements;
  };

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
          <button onClick={prevMonth} className="p-1 hover:bg-gray-200 rounded-md transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-200 rounded-md transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>
      <div className="p-4">
        <div className="text-center mb-4">
          <span className="text-sm font-bold text-gray-900">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
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
        
        {/* Events Placeholder */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Upcoming Events</p>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-2 bg-emerald-50 rounded-lg">
              <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full mt-1.5"></div>
              <div>
                <p className="text-xs font-medium text-gray-900">Mid-term Exams</p>
                <p className="text-[10px] text-gray-500">Jan 20 - Jan 24</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-2 bg-blue-50 rounded-lg">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5"></div>
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
