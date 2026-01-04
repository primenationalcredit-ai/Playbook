import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { 
  ArrowLeft, CheckCircle, Circle, PlayCircle, FileText,
  ChevronRight, ChevronLeft, Award, AlertCircle, RefreshCw,
  BookOpen, HelpCircle, Clock, Check
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';

function TrainingCourse() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { currentUser, supabaseFetch, supabasePost, supabasePatch } = useApp();
  
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [assignment, setAssignment] = useState(null);
  const [completedLessons, setCompletedLessons] = useState({});
  const [quizAttempts, setQuizAttempts] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Current view state
  const [currentView, setCurrentView] = useState('overview'); // overview, lesson, quiz
  const [currentLesson, setCurrentLesson] = useState(null);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [openEndedAnswers, setOpenEndedAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);

  useEffect(() => {
    if (currentUser) {
      loadCourse();
    }
  }, [courseId, currentUser]);

  const loadCourse = async () => {
    try {
      const courseData = await supabaseFetch('training_courses', `select=*&id=eq.${courseId}`);
      if (courseData && courseData[0]) {
        setCourse(courseData[0]);
      }
      
      const assignmentData = await supabaseFetch('training_assignments', 
        `select=*&user_id=eq.${currentUser.id}&course_id=eq.${courseId}`);
      if (assignmentData && assignmentData[0]) {
        setAssignment(assignmentData[0]);
      }
      
      const modulesData = await supabaseFetch('training_modules', `select=*&course_id=eq.${courseId}&order=sort_order`);
      
      const modulesWithContent = await Promise.all((modulesData || []).map(async (module) => {
        const lessons = await supabaseFetch('training_lessons', `select=*&module_id=eq.${module.id}&order=sort_order`);
        const quizzes = await supabaseFetch('training_quizzes', `select=*&module_id=eq.${module.id}`);
        
        let quiz = null;
        if (quizzes && quizzes[0]) {
          const questions = await supabaseFetch('training_quiz_questions', `select=*&quiz_id=eq.${quizzes[0].id}&order=sort_order`);
          quiz = { ...quizzes[0], questions: questions || [] };
        }
        
        return { ...module, lessons: lessons || [], quiz };
      }));
      
      setModules(modulesWithContent);
      
      // Load completed lessons
      const progressData = await supabaseFetch('training_lesson_progress', 
        `select=*&user_id=eq.${currentUser.id}`);
      const completed = {};
      (progressData || []).forEach(p => { completed[p.lesson_id] = true; });
      setCompletedLessons(completed);
      
      // Load quiz attempts
      const attemptsData = await supabaseFetch('training_quiz_attempts', 
        `select=*&user_id=eq.${currentUser.id}&order=attempted_at.desc`);
      const attempts = {};
      (attemptsData || []).forEach(a => {
        if (!attempts[a.quiz_id] || a.passed) {
          attempts[a.quiz_id] = a;
        }
      });
      setQuizAttempts(attempts);
      
    } catch (error) {
      console.error('Error loading course:', error);
    } finally {
      setLoading(false);
    }
  };

  const markLessonComplete = async (lessonId) => {
    try {
      if (completedLessons[lessonId]) return;
      
      await supabasePost('training_lesson_progress', {
        user_id: currentUser.id,
        lesson_id: lessonId,
      });
      
      setCompletedLessons(prev => ({ ...prev, [lessonId]: true }));
      checkCourseCompletion();
    } catch (error) {
      console.error('Error marking lesson complete:', error);
    }
  };

  const submitQuiz = async () => {
    if (!currentQuiz) return;
    
    // Calculate score (only for multiple choice)
    const mcQuestions = currentQuiz.questions.filter(q => q.question_type !== 'open_ended');
    let correct = 0;
    
    mcQuestions.forEach((q, i) => {
      const qIndex = currentQuiz.questions.indexOf(q);
      if (quizAnswers[qIndex] === q.correct_answer) {
        correct++;
      }
    });
    
    // Open-ended questions are considered "correct" if answered
    const oeQuestions = currentQuiz.questions.filter(q => q.question_type === 'open_ended');
    const oeAnswered = oeQuestions.filter((q, i) => {
      const qIndex = currentQuiz.questions.indexOf(q);
      return openEndedAnswers[qIndex] && openEndedAnswers[qIndex].trim().length > 0;
    }).length;
    
    const totalGradable = mcQuestions.length + oeQuestions.length;
    const totalCorrect = correct + oeAnswered;
    const score = totalGradable > 0 ? Math.round((totalCorrect / totalGradable) * 100) : 100;
    const passed = score >= currentQuiz.passing_score;
    
    try {
      await supabasePost('training_quiz_attempts', {
        user_id: currentUser.id,
        quiz_id: currentQuiz.id,
        score,
        passed,
        answers: { ...quizAnswers, openEnded: openEndedAnswers },
      });
      
      setQuizAttempts(prev => ({
        ...prev,
        [currentQuiz.id]: { score, passed },
      }));
      
      setQuizResult({ 
        score, 
        passed, 
        correct: totalCorrect, 
        total: totalGradable,
        mcCorrect: correct,
        mcTotal: mcQuestions.length,
        oeAnswered,
        oeTotal: oeQuestions.length
      });
      
      if (passed) {
        checkCourseCompletion();
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
    }
  };

  const checkCourseCompletion = async () => {
    let allComplete = true;
    
    for (const module of modules) {
      for (const lesson of module.lessons) {
        if (!completedLessons[lesson.id]) {
          allComplete = false;
          break;
        }
      }
      if (module.quiz && (!quizAttempts[module.quiz.id] || !quizAttempts[module.quiz.id].passed)) {
        allComplete = false;
      }
    }
    
    if (allComplete && assignment && !assignment.completed_at) {
      await supabasePatch('training_assignments', assignment.id, {
        completed_at: new Date().toISOString(),
      });
      setAssignment(prev => ({ ...prev, completed_at: new Date().toISOString() }));
    }
  };

  const goToNextItem = () => {
    const currentModule = modules[currentModuleIndex];
    
    if (currentLessonIndex < currentModule.lessons.length - 1) {
      // Next lesson in same module
      const nextLesson = currentModule.lessons[currentLessonIndex + 1];
      setCurrentLesson(nextLesson);
      setCurrentLessonIndex(currentLessonIndex + 1);
    } else if (currentModule.quiz && !quizAttempts[currentModule.quiz.id]?.passed) {
      // Go to quiz
      setCurrentQuiz(currentModule.quiz);
      setQuizAnswers({});
      setOpenEndedAnswers({});
      setQuizResult(null);
      setCurrentView('quiz');
    } else if (currentModuleIndex < modules.length - 1) {
      // Next module
      const nextModule = modules[currentModuleIndex + 1];
      if (nextModule.lessons.length > 0) {
        setCurrentLesson(nextModule.lessons[0]);
        setCurrentModuleIndex(currentModuleIndex + 1);
        setCurrentLessonIndex(0);
      }
    } else {
      // Course complete, go back to overview
      setCurrentView('overview');
    }
  };

  const goToPrevItem = () => {
    if (currentLessonIndex > 0) {
      const prevLesson = modules[currentModuleIndex].lessons[currentLessonIndex - 1];
      setCurrentLesson(prevLesson);
      setCurrentLessonIndex(currentLessonIndex - 1);
    } else if (currentModuleIndex > 0) {
      const prevModule = modules[currentModuleIndex - 1];
      if (prevModule.lessons.length > 0) {
        setCurrentLesson(prevModule.lessons[prevModule.lessons.length - 1]);
        setCurrentModuleIndex(currentModuleIndex - 1);
        setCurrentLessonIndex(prevModule.lessons.length - 1);
      }
    }
  };

  const startLesson = (moduleIndex, lessonIndex) => {
    setCurrentModuleIndex(moduleIndex);
    setCurrentLessonIndex(lessonIndex);
    setCurrentLesson(modules[moduleIndex].lessons[lessonIndex]);
    setCurrentView('lesson');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-asap-blue/30 border-t-asap-blue rounded-full animate-spin" />
      </div>
    );
  }

  // Calculate progress
  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedCount = Object.keys(completedLessons).filter(id => 
    modules.some(m => m.lessons.some(l => l.id === id))
  ).length;
  const progress = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  // Overview View
  if (currentView === 'overview') {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/training')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-800">{course?.title}</h1>
            <p className="text-slate-500 text-sm">{course?.description}</p>
          </div>
          {assignment?.completed_at && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg">
              <Award className="w-5 h-5" />
              <span className="font-medium">Completed!</span>
            </div>
          )}
        </div>

        {/* Progress Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-600 font-medium">Your Progress</span>
            <span className="text-2xl font-bold text-asap-blue">{progress}%</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-asap-blue to-asap-blue-light transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-slate-500 mt-2">
            {completedCount} of {totalLessons} lessons completed
          </p>
        </div>

        {/* Modules */}
        <div className="space-y-4">
          {modules.map((module, moduleIndex) => {
            const moduleComplete = module.lessons.every(l => completedLessons[l.id]) && 
              (!module.quiz || quizAttempts[module.quiz.id]?.passed);
            
            return (
              <div key={module.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className={`p-4 border-b border-slate-200 ${moduleComplete ? 'bg-green-50' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    {moduleComplete ? (
                      <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-asap-blue rounded-lg flex items-center justify-center text-white font-bold text-sm">
                        {moduleIndex + 1}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-slate-800">{module.title}</h3>
                      {module.description && (
                        <p className="text-sm text-slate-500">{module.description}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="divide-y divide-slate-100">
                  {module.lessons.map((lesson, lessonIndex) => (
                    <button
                      key={lesson.id}
                      onClick={() => startLesson(moduleIndex, lessonIndex)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors text-left"
                    >
                      {completedLessons[lesson.id] ? (
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 flex-shrink-0" />
                      )}
                      <FileText className="w-4 h-4 text-asap-blue flex-shrink-0" />
                      <span className="flex-1 text-slate-700">{lesson.title}</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                  
                  {module.quiz && (
                    <button
                      onClick={() => {
                        setCurrentQuiz(module.quiz);
                        setQuizAnswers({});
                        setOpenEndedAnswers({});
                        setQuizResult(null);
                        setCurrentView('quiz');
                      }}
                      className="w-full flex items-center gap-3 p-4 hover:bg-amber-50 transition-colors text-left bg-amber-50/50"
                    >
                      {quizAttempts[module.quiz.id]?.passed ? (
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : quizAttempts[module.quiz.id] ? (
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      )}
                      <HelpCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span className="flex-1 text-amber-800 font-medium">
                        {module.quiz.title}
                        {quizAttempts[module.quiz.id] && (
                          <span className="ml-2 text-sm font-normal">
                            (Score: {quizAttempts[module.quiz.id].score}%)
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-amber-600">
                        {module.quiz.questions?.length} questions
                      </span>
                      <ChevronRight className="w-4 h-4 text-amber-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Lesson View
  if (currentView === 'lesson' && currentLesson) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Top Navigation */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => setCurrentView('overview')}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Course</span>
            </button>
            <div className="text-sm text-slate-500">
              Module {currentModuleIndex + 1}, Step {currentLessonIndex + 1}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800">{currentLesson.title}</h2>
            </div>
            
            {currentLesson.content && (
              <div 
                className="p-6 prose max-w-none"
                dangerouslySetInnerHTML={{ __html: currentLesson.content }}
              />
            )}
            
            {!currentLesson.content && (
              <div className="p-12 text-center text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No content for this step yet.</p>
              </div>
            )}
            
            {/* Footer Actions */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={goToPrevItem}
                disabled={currentModuleIndex === 0 && currentLessonIndex === 0}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              
              <div className="flex items-center gap-3">
                {completedLessons[currentLesson.id] ? (
                  <span className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    Completed
                  </span>
                ) : (
                  <button
                    onClick={() => markLessonComplete(currentLesson.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark Complete
                  </button>
                )}
                
                <button
                  onClick={() => {
                    if (!completedLessons[currentLesson.id]) {
                      markLessonComplete(currentLesson.id);
                    }
                    goToNextItem();
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <style>{`
          .prose h1 { font-size: 1.875rem; font-weight: 700; margin-bottom: 1rem; color: #1e293b; }
          .prose h2 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.75rem; color: #1e293b; }
          .prose p { margin-bottom: 1rem; line-height: 1.75; color: #475569; }
          .prose ul, .prose ol { margin-bottom: 1rem; padding-left: 1.5rem; }
          .prose li { margin-bottom: 0.5rem; color: #475569; }
          .prose blockquote { border-left: 4px solid #1e5799; padding-left: 1rem; margin: 1rem 0; color: #64748b; font-style: italic; }
          .prose a { color: #1e5799; text-decoration: underline; }
          .prose img { border-radius: 8px; max-width: 100%; margin: 1rem 0; }
          .prose iframe { border-radius: 8px; }
          .prose hr { border: none; border-top: 2px solid #e2e8f0; margin: 2rem 0; }
        `}</style>
      </div>
    );
  }

  // Quiz View
  if (currentView === 'quiz' && currentQuiz) {
    const allAnswered = currentQuiz.questions.every((q, i) => {
      if (q.question_type === 'open_ended') {
        return openEndedAnswers[i] && openEndedAnswers[i].trim().length > 0;
      }
      return quizAnswers[i] !== undefined;
    });

    return (
      <div className="min-h-screen bg-slate-50">
        {/* Top Navigation */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => {
                setCurrentView('overview');
                setQuizResult(null);
              }}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Course</span>
            </button>
            <div className="text-sm text-slate-500">
              {currentQuiz.passing_score}% required to pass
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto p-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-2">{currentQuiz.title}</h2>
            <p className="text-slate-500 mb-6">
              Answer all questions below. Score {currentQuiz.passing_score}% or higher to pass.
            </p>

            {quizResult ? (
              // Results
              <div className="text-center py-8">
                {quizResult.passed ? (
                  <>
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Award className="w-10 h-10 text-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-green-600 mb-2">Congratulations!</h3>
                    <p className="text-slate-600 mb-4">
                      You scored {quizResult.score}% ({quizResult.correct}/{quizResult.total} correct)
                    </p>
                    {quizResult.oeTotal > 0 && (
                      <p className="text-sm text-slate-500">
                        Including {quizResult.oeAnswered} open-ended responses (pending review)
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-10 h-10 text-red-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-red-600 mb-2">Not Quite</h3>
                    <p className="text-slate-600 mb-4">
                      You scored {quizResult.score}%. You need {currentQuiz.passing_score}% to pass.
                    </p>
                  </>
                )}
                
                <div className="flex justify-center gap-4 mt-6">
                  {!quizResult.passed && (
                    <button
                      onClick={() => {
                        setQuizAnswers({});
                        setOpenEndedAnswers({});
                        setQuizResult(null);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Try Again
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setCurrentView('overview');
                      setQuizResult(null);
                    }}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Back to Course
                  </button>
                </div>
              </div>
            ) : (
              // Questions
              <div className="space-y-6">
                {currentQuiz.questions.map((q, qIndex) => (
                  <div key={qIndex} className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="flex items-center justify-center w-7 h-7 bg-asap-blue text-white rounded-full text-sm font-medium flex-shrink-0">
                        {qIndex + 1}
                      </span>
                      <p className="font-medium text-slate-800 pt-0.5">{q.question}</p>
                    </div>
                    
                    {q.question_type === 'open_ended' ? (
                      <div className="ml-10">
                        <textarea
                          value={openEndedAnswers[qIndex] || ''}
                          onChange={(e) => setOpenEndedAnswers(prev => ({ ...prev, [qIndex]: e.target.value }))}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asap-blue resize-none"
                          rows={4}
                          placeholder="Type your answer here..."
                        />
                      </div>
                    ) : (
                      <div className="space-y-2 ml-10">
                        {q.options.map((option, oIndex) => (
                          <button
                            key={oIndex}
                            onClick={() => setQuizAnswers(prev => ({ ...prev, [qIndex]: oIndex }))}
                            className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                              quizAnswers[qIndex] === oIndex
                                ? 'border-asap-blue bg-asap-blue/5 text-asap-blue'
                                : 'border-slate-200 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                
                <button
                  onClick={submitQuiz}
                  disabled={!allAnswered}
                  className="w-full py-3 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Quiz
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default TrainingCourse;
