import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  GraduationCap, Clock, CheckCircle, AlertCircle, 
  ChevronRight, BookOpen, PlayCircle
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';

function Training() {
  const { currentUser, supabaseFetch } = useApp();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      loadAssignments();
    }
  }, [currentUser]);

  const loadAssignments = async () => {
    try {
      // Load user's training assignments
      const data = await supabaseFetch('training_assignments', 
        `select=*,training_courses(*)&user_id=eq.${currentUser.id}`);
      
      // For each assignment, calculate progress
      const assignmentsWithProgress = await Promise.all((data || []).map(async (assignment) => {
        const course = assignment.training_courses;
        if (!course) return null;
        
        // Get modules for this course
        const modules = await supabaseFetch('training_modules', `select=*&course_id=eq.${course.id}`);
        
        // Get all lessons for these modules
        let totalLessons = 0;
        let completedLessons = 0;
        
        for (const module of (modules || [])) {
          const lessons = await supabaseFetch('training_lessons', `select=*&module_id=eq.${module.id}`);
          totalLessons += (lessons || []).length;
          
          // Check completed lessons
          for (const lesson of (lessons || [])) {
            const progress = await supabaseFetch('training_lesson_progress', 
              `select=*&user_id=eq.${currentUser.id}&lesson_id=eq.${lesson.id}`);
            if (progress && progress.length > 0) {
              completedLessons++;
            }
          }
        }
        
        return {
          ...assignment,
          course,
          totalLessons,
          completedLessons,
          progress: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
        };
      }));
      
      setAssignments(assignmentsWithProgress.filter(Boolean));
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (assignment) => {
    if (assignment.completed_at) return 'green';
    if (assignment.due_date && isPast(new Date(assignment.due_date))) return 'red';
    if (assignment.progress > 0) return 'blue';
    return 'slate';
  };

  const getStatusText = (assignment) => {
    if (assignment.completed_at) return 'Completed';
    if (assignment.due_date && isPast(new Date(assignment.due_date))) return 'Overdue';
    if (assignment.progress > 0) return 'In Progress';
    return 'Not Started';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-asap-blue/30 border-t-asap-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-asap-blue/10 rounded-lg flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-asap-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Training</h1>
          <p className="text-slate-500 text-sm">Complete your assigned training courses</p>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">No trainings assigned</h3>
          <p className="text-slate-500">You're all caught up! Check back later for new training courses.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map(assignment => {
            const statusColor = getStatusColor(assignment);
            const statusText = getStatusText(assignment);
            
            return (
              <a
                key={assignment.id}
                href={`/training/${assignment.course.id}`}
                className="block bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md hover:border-asap-blue/30 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-800">{assignment.course.title}</h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        statusColor === 'green' ? 'bg-green-100 text-green-700' :
                        statusColor === 'red' ? 'bg-red-100 text-red-700' :
                        statusColor === 'blue' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {statusText}
                      </span>
                    </div>
                    
                    <p className="text-slate-500 text-sm mb-4">
                      {assignment.course.description || 'No description'}
                    </p>
                    
                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600">{assignment.completedLessons} of {assignment.totalLessons} lessons</span>
                        <span className="font-medium text-slate-700">{assignment.progress}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            statusColor === 'green' ? 'bg-green-500' :
                            statusColor === 'red' ? 'bg-red-500' :
                            'bg-asap-blue'
                          }`}
                          style={{ width: `${assignment.progress}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      {assignment.due_date && !assignment.completed_at && (
                        <div className={`flex items-center gap-1 ${
                          isPast(new Date(assignment.due_date)) ? 'text-red-500' : ''
                        }`}>
                          <Clock className="w-4 h-4" />
                          <span>
                            {isPast(new Date(assignment.due_date)) 
                              ? `Overdue by ${formatDistanceToNow(new Date(assignment.due_date))}`
                              : `Due ${formatDistanceToNow(new Date(assignment.due_date), { addSuffix: true })}`
                            }
                          </span>
                        </div>
                      )}
                      {assignment.completed_at && (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span>Completed {format(new Date(assignment.completed_at), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="ml-4 flex items-center">
                    {assignment.completed_at ? (
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-asap-blue/10 rounded-full flex items-center justify-center">
                        <PlayCircle className="w-6 h-6 text-asap-blue" />
                      </div>
                    )}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Training;
