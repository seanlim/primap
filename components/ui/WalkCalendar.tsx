import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState, useMemo } from "react"


const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type CalendarCell = {
    date: Date
    inCurrentMonth: boolean
    key: string
}

type CalendarEventBase = {
  id: string,
  startTime: string,
  endTime: string,
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

type CalendarProps<T extends CalendarEventBase> = {
  events: T[],
  initialMonth?: Date
  minMonth?: Date
  maxMonth?: Date
  getEventStartTime?: (event: T) => string
  getEventEndTime?: (event: T) => string
  onEventClick?: (event: T) => void
  isEventDisabled?: (event: T) => boolean
  eventClassName?: (event: T) => string
  renderEvent: (event: T) => React.ReactNode
}

export default function WalkCalendar<T extends CalendarEventBase>({ 
  events,
  initialMonth,
  minMonth,
  maxMonth,
  getEventStartTime,
  getEventEndTime,
  onEventClick,
  isEventDisabled,
  eventClassName,
  renderEvent,
}: CalendarProps<T>) {
  const [calendarMonth, setCalendarMonth] = useState(() => {
    if (initialMonth && !Number.isNaN(initialMonth.getTime())) {
        return new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1)
      }
      return new Date()
  });

  const eventsByDay = useMemo(() => {
    const eventGroups = new Map<string, T[]>()
    events.forEach(event => {
      const startTime = getEventStartTime ? getEventStartTime(event) : event.startTime
      const endTime = getEventEndTime ? getEventEndTime(event) : event.endTime
      if (!startTime || !endTime) {
        return
      }

      const startDate = new Date(startTime)
      const endDate = new Date(endTime)
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return
      }

      const key = toDateKey(startDate)
      const dayEvents = eventGroups.get(key) || [];
      dayEvents.push(event)
      eventGroups.set(key, dayEvents)
    })

    eventGroups.forEach((items) => {
      items.sort((left, right) => {
        const leftTime = Date.parse((getEventStartTime ? getEventStartTime(left) : left.startTime) || '')
        const rightTime = Date.parse((getEventStartTime ? getEventStartTime(right) : right.startTime) || '')
        return leftTime - rightTime
      });
    })
    
    return eventGroups;
  }, [events, getEventStartTime, getEventEndTime]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear()
      const month = calendarMonth.getMonth()
      const firstDay = new Date(year, month, 1)
      const firstWeekday = firstDay.getDay()
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      const cells: CalendarCell[] = []

      // Generate days before month
      for (let i = 0; i < firstWeekday; i += 1) {
        const date = new Date(year, month, i - firstWeekday + 1)
        cells.push({
          date,
          inCurrentMonth: false,
          key: toDateKey(date),
        })
      }

      // Generate days in month
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month, day)
        cells.push({
          date,
          inCurrentMonth: true,
          key: toDateKey(date),
        })
      }

      // Generate days after month
      const remainder = cells.length % 7
      if (remainder !== 0) {
        const toAdd = 7 - remainder
        for (let i = 1; i <= toAdd; i += 1) {
          const date = new Date(year, month + 1, i)
          cells.push({
            date,
            inCurrentMonth: false,
            key: toDateKey(date),
          })
        }
      }

      return cells
  }, [calendarMonth]);

  const changeMonth = (delta: number) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  // Used to restrict navigation of months in the calendar
  const isMinMonth = !minMonth || calendarMonth.getMonth() == minMonth.getMonth()
  const isMaxMonth = !maxMonth || calendarMonth.getMonth() == maxMonth.getMonth()

  const todayKey = toDateKey(new Date())

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 overflow-x-auto">
      <div className="flex flex-col gap-3 mb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className={`rounded-lg p-2 text-white transition ${isMinMonth ? 'bg-gray-400' : 'bg-green-600 hover:bg-black/45 cursor-pointer'}`}
            disabled={isMinMonth}
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <h2 className="min-w-32 text-center text-sm font-semibold">
            {MONTH_LABELS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
          </h2>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className={`rounded-lg p-2 text-white transition ${isMaxMonth ? 'bg-gray-400' : 'bg-green-600 hover:bg-black/45 cursor-pointer'}`}
            disabled={isMaxMonth}
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="min-w-2xl">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {DAY_LABELS.map((weekday) => (
            <div key={weekday} className="rounded-xl border border-gray-300 text-gray-500 bg-green-100 py-2 text-center text-xs font-semibold tracking-[0.16em]">
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((cell) => {
            const dayEvents = eventsByDay.get(cell.key) || []
            const isToday = cell.key === todayKey

            return (
              <div key={cell.key}
                className={`min-h-34 rounded-xl border p-2 
                  ${cell.inCurrentMonth ? 'bg-white' : 'bg-gray-100 text-gray-400'}
                  ${isToday ? 'border-green-600 border-2' : 'border-gray-300'}
                `}
              > 
                <div className="mb-2 flex items-center justify-between">
                  <span className={`text-xs font-bold`}>
                    {cell.date.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="rounded-full bg-lime-500/20 px-2 py-0.5 text-[10px] font-semibold">
                        {dayEvents.length} walk{dayEvents.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {dayEvents.map((event) => {
                    const disabled = isEventDisabled ? isEventDisabled(event) : false
                    const customClassName = eventClassName ? eventClassName(event) : ''
                    const className = `w-full rounded-lg border px-1 py-1 text-left text-[11px] leading-snug transition ${customClassName}`.trim()

                    if (onEventClick) {
                      return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => {
                              if (disabled) {
                                  return
                              }
                              onEventClick(event)
                          }}
                          className={className}
                          disabled={disabled}
                        >
                          {renderEvent(event)}
                        </button>
                      )
                    }

                    return (
                      <div key={event.id} className={className}>
                        {renderEvent(event)}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}