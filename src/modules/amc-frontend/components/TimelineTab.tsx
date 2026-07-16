import { type AmcTimeline } from '../services/amcService';
import { formatDate } from '../utils/helpers';

interface Props {
  timeline: AmcTimeline[];
}

const getActionIcon = (action: string): string => {
  const actionLower = action.toLowerCase();
  if (actionLower.includes('created')) return '✨';
  if (actionLower.includes('activated') || actionLower.includes('active')) return '✅';
  if (actionLower.includes('visit') || actionLower.includes('engineer') || actionLower.includes('assign')) return '👨‍🔧';
  if (actionLower.includes('report') || actionLower.includes('receive')) return '📄';
  if (actionLower.includes('billing') || actionLower.includes('bill')) return '💰';
  if (actionLower.includes('portal')) return '🌐';
  if (actionLower.includes('closed') || actionLower.includes('close')) return '🔒';
  if (actionLower.includes('validate') || actionLower.includes('success')) return '✓';
  if (actionLower.includes('reassign') || actionLower.includes('update')) return '🔄';
  if (actionLower.includes('failed') || actionLower.includes('lost')) return '❌';
  return '📍';
};

const getActionColor = (action: string): string => {
  const actionLower = action.toLowerCase();
  if (actionLower.includes('created')) return 'bg-blue-100 text-blue-800 border-blue-300';
  if (actionLower.includes('activated') || actionLower.includes('active')) return 'bg-green-100 text-green-800 border-green-300';
  if (actionLower.includes('closed') || actionLower.includes('close')) return 'bg-red-100 text-red-800 border-red-300';
  if (actionLower.includes('visit') || actionLower.includes('engineer') || actionLower.includes('assign')) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  if (actionLower.includes('report') || actionLower.includes('receive')) return 'bg-purple-100 text-purple-800 border-purple-300';
  if (actionLower.includes('billing') || actionLower.includes('bill')) return 'bg-orange-100 text-orange-800 border-orange-300';
  if (actionLower.includes('portal')) return 'bg-indigo-100 text-indigo-800 border-indigo-300';
  if (actionLower.includes('validate') || actionLower.includes('success')) return 'bg-teal-100 text-teal-800 border-teal-300';
  return 'bg-gray-100 text-gray-800 border-gray-300';
};

const getDotColor = (action: string): string => {
  const actionLower = action.toLowerCase();
  if (actionLower.includes('created')) return 'bg-blue-600';
  if (actionLower.includes('activated') || actionLower.includes('active')) return 'bg-green-600';
  if (actionLower.includes('closed') || actionLower.includes('close')) return 'bg-red-600';
  if (actionLower.includes('visit') || actionLower.includes('engineer') || actionLower.includes('assign')) return 'bg-yellow-600';
  if (actionLower.includes('report') || actionLower.includes('receive')) return 'bg-purple-600';
  if (actionLower.includes('billing') || actionLower.includes('bill')) return 'bg-orange-600';
  if (actionLower.includes('portal')) return 'bg-indigo-600';
  return 'bg-gray-600';
};

export default function TimelineTab({ timeline }: Props) {
  if (timeline.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
        <p className="text-lg font-medium">No timeline events yet</p>
        <p className="text-sm mt-2">Timeline events will appear as actions are performed</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Vertical Timeline */}
      <div className="bg-white border border-gray-200 rounded-lg p-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-8">AMC Activity Timeline</h3>

        <div className="space-y-8">
          {timeline.map((event, index) => (
            <div key={event.id} className="flex gap-6">
              {/* Timeline dot and line */}
              <div className="flex flex-col items-center flex-shrink-0">
                {/* Dot */}
                <div className={`w-14 h-14 rounded-full ${getDotColor(event.action)} flex items-center justify-center text-white text-xl font-bold shadow-lg`}>
                  {getActionIcon(event.action)}
                </div>
                {/* Line to next item */}
                {index < timeline.length - 1 && (
                  <div className="w-1 h-20 bg-gray-200 mt-4"></div>
                )}
              </div>

              {/* Event details */}
              <div className="flex-1 pt-2">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">{event.action}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">By:</span> {event.performedBy}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getActionColor(event.action)}`}>
                    {getActionIcon(event.action)} {event.action}
                  </span>
                </div>
                <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">📅 Date & Time:</span>
                  </p>
                  <p className="text-sm text-gray-900 font-semibold mt-1">{formatDate(event.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="bg-white border border-gray-200 rounded-lg p-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Timeline Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
            <p className="text-gray-600 text-sm font-medium">Total Events</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{timeline.length}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
            <p className="text-gray-600 text-sm font-medium">Created</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {timeline.filter(e => e.action.toLowerCase().includes('created')).length}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
            <p className="text-gray-600 text-sm font-medium">Activated</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {timeline.filter(e => e.action.toLowerCase().includes('activate')).length}
            </p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 text-center border border-yellow-200">
            <p className="text-gray-600 text-sm font-medium">Updates</p>
            <p className="text-3xl font-bold text-yellow-600 mt-2">
              {timeline.filter(e => 
                e.action.toLowerCase().includes('visit') || 
                e.action.toLowerCase().includes('assign') ||
                e.action.toLowerCase().includes('update')
              ).length}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
            <p className="text-gray-600 text-sm font-medium">Reports</p>
            <p className="text-3xl font-bold text-purple-600 mt-2">
              {timeline.filter(e => 
                e.action.toLowerCase().includes('report') ||
                e.action.toLowerCase().includes('billing') ||
                e.action.toLowerCase().includes('portal')
              ).length}
            </p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Event Types</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <span className="text-gray-700">Created</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">✅</span>
            <span className="text-gray-700">Activated</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">👨‍🔧</span>
            <span className="text-gray-700">Visit/Assignment</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📄</span>
            <span className="text-gray-700">Report</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">💰</span>
            <span className="text-gray-700">Billing</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🔒</span>
            <span className="text-gray-700">Closed</span>
          </div>
        </div>
      </div>
    </div>
  );
}