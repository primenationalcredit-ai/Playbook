import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { 
  ArrowLeft, CheckCircle, Circle, PlayCircle, FileText, Image as ImageIcon,
  ChevronRight, ChevronLeft, Award, AlertCircle, RefreshCw, Target,
  BookOpen, HelpCircle, Clock, Check, Star, Lightbulb, MessageSquare,
  GraduationCap, Trophy, Zap, ChevronDown, ChevronUp, Lock, Video,
  ListChecks, Quote, AlertTriangle, Info, Sparkles
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
  
  const [currentView, setCurrentView] = useState('overview');
  const [currentLesson, setCurrentLesson] = useState(null);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [openEndedAnswers, setOpenEndedAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [expandedModules, setExpandedModules] = useState({});
  const [showCelebration, setShowCelebration] = useState(false);

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
      
      // Expand first incomplete module
      const firstIncomplete = modulesWithContent.findIndex(m => 
        m.lessons.some(l => !completedLessons[l.id]) || 
        (m.quiz && !quizAttempts[m.quiz?.id]?.passed)
      );
      setExpandedModules({ [firstIncomplete >= 0 ? firstIncomplete : 0]: true });
      
      const progressData = await supabaseFetch('training_lesson_progress', 
        `select=*&user_id=eq.${currentUser.id}`);
      const completed = {};
      (progressData || []).forEach(p => { completed[p.lesson_id] = true; });
      setCompletedLessons(completed);
      
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
    
    const mcQuestions = currentQuiz.questions.filter(q => q.question_type !== 'open_ended');
    let correct = 0;
    
    mcQuestions.forEach((q) => {
      const qIndex = currentQuiz.questions.indexOf(q);
      if (quizAnswers[qIndex] === q.correct_answer) {
        correct++;
      }
    });
    
    const oeQuestions = currentQuiz.questions.filter(q => q.question_type === 'open_ended');
    const oeAnswered = oeQuestions.filter((q) => {
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
      
      setQuizAttempts(prev => ({ ...prev, [currentQuiz.id]: { score, passed } }));
      setQuizResult({ score, passed, correct: totalCorrect, total: totalGradable });
      
      if (passed) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 3000);
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
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 5000);
    }
  };

  // Calculate progress
  const calculateProgress = () => {
    let total = 0;
    let completed = 0;
    
    modules.forEach(module => {
      module.lessons.forEach(lesson => {
        total++;
        if (completedLessons[lesson.id]) completed++;
      });
      if (module.quiz) {
        total++;
        if (quizAttempts[module.quiz.id]?.passed) completed++;
      }
    });
    
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const startLesson = (moduleIndex, lessonIndex) => {
    const lesson = modules[moduleIndex].lessons[lessonIndex];
    setCurrentModuleIndex(moduleIndex);
    setCurrentLessonIndex(lessonIndex);
    setCurrentLesson(lesson);
    setCurrentView('lesson');
    window.scrollTo(0, 0);
  };

  const startQuiz = (moduleIndex) => {
    const quiz = modules[moduleIndex].quiz;
    setCurrentModuleIndex(moduleIndex);
    setCurrentQuiz(quiz);
    setQuizAnswers({});
    setOpenEndedAnswers({});
    setQuizResult(null);
    setCurrentView('quiz');
    window.scrollTo(0, 0);
  };

  const goToNextItem = () => {
    const currentModule = modules[currentModuleIndex];
    
    if (currentLessonIndex < currentModule.lessons.length - 1) {
      const nextLesson = currentModule.lessons[currentLessonIndex + 1];
      setCurrentLesson(nextLesson);
      setCurrentLessonIndex(currentLessonIndex + 1);
      window.scrollTo(0, 0);
    } else if (currentModule.quiz && !quizAttempts[currentModule.quiz.id]?.passed) {
      startQuiz(currentModuleIndex);
    } else if (currentModuleIndex < modules.length - 1) {
      const nextModule = modules[currentModuleIndex + 1];
      if (nextModule.lessons.length > 0) {
        startLesson(currentModuleIndex + 1, 0);
      }
    } else {
      setCurrentView('overview');
    }
  };

  // Rich content renderer with support for callouts, images, etc.
  const renderRichContent = (content) => {
    if (!content) return null;
    
    // Split content into blocks
    const blocks = [];
    let remaining = content;
    
    // Pattern for special blocks
    const blockPatterns = [
      { type: 'keypoint', regex: /\[KEY ?POINT\]([\s\S]*?)\[\/KEY ?POINT\]/i },
      { type: 'tip', regex: /\[TIP\]([\s\S]*?)\[\/TIP\]/i },
      { type: 'warning', regex: /\[WARNING\]([\s\S]*?)\[\/WARNING\]/i },
      { type: 'example', regex: /\[EXAMPLE\]([\s\S]*?)\[\/EXAMPLE\]/i },
      { type: 'note', regex: /\[NOTE\]([\s\S]*?)\[\/NOTE\]/i },
      { type: 'quote', regex: /\[QUOTE\]([\s\S]*?)\[\/QUOTE\]/i },
      { type: 'image', regex: /\[IMG:(.*?)\]/i },
      { type: 'video', regex: /\[VIDEO:(.*?)\]/i },
      { type: 'checklist', regex: /\[CHECKLIST\]([\s\S]*?)\[\/CHECKLIST\]/i },
    ];
    
    // Process content - for simplicity, we'll render with dangerouslySetInnerHTML
    // but parse our special blocks first
    let html = content;
    
    // Convert markdown-style formatting
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convert headers
    html = html.replace(/^### (.*?)$/gm, '<h3 class="lesson-h3">$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2 class="lesson-h2">$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1 class="lesson-h1">$1</h1>');
    
    // Convert bullet points
    html = html.replace(/^[•\-] (.*?)$/gm, '<li class="lesson-li">$1</li>');
    html = html.replace(/(<li class="lesson-li">.*?<\/li>\n?)+/gs, '<ul class="lesson-ul">$&</ul>');
    
    // Convert numbered lists
    html = html.replace(/^\d+\. (.*?)$/gm, '<li class="lesson-li-num">$1</li>');
    html = html.replace(/(<li class="lesson-li-num">.*?<\/li>\n?)+/gs, '<ol class="lesson-ol">$&</ol>');
    
    // Convert special blocks
    html = html.replace(/\[KEY ?POINT\]([\s\S]*?)\[\/KEY ?POINT\]/gi, 
      '<div class="callout callout-keypoint"><div class="callout-icon">💡</div><div class="callout-content"><div class="callout-title">Key Point</div>$1</div></div>');
    
    html = html.replace(/\[TIP\]([\s\S]*?)\[\/TIP\]/gi,
      '<div class="callout callout-tip"><div class="callout-icon">✨</div><div class="callout-content"><div class="callout-title">Pro Tip</div>$1</div></div>');
    
    html = html.replace(/\[WARNING\]([\s\S]*?)\[\/WARNING\]/gi,
      '<div class="callout callout-warning"><div class="callout-icon">⚠️</div><div class="callout-content"><div class="callout-title">Warning</div>$1</div></div>');
    
    html = html.replace(/\[EXAMPLE\]([\s\S]*?)\[\/EXAMPLE\]/gi,
      '<div class="callout callout-example"><div class="callout-icon">📋</div><div class="callout-content"><div class="callout-title">Example</div>$1</div></div>');
    
    html = html.replace(/\[NOTE\]([\s\S]*?)\[\/NOTE\]/gi,
      '<div class="callout callout-note"><div class="callout-icon">📝</div><div class="callout-content"><div class="callout-title">Note</div>$1</div></div>');
    
    html = html.replace(/\[QUOTE\]([\s\S]*?)\[\/QUOTE\]/gi,
      '<blockquote class="lesson-quote">$1</blockquote>');
    
    html = html.replace(/\[IMG:(.*?)\]/gi, '<img src="$1" class="lesson-img" alt="Lesson image" />');
    
    html = html.replace(/\[VIDEO:(.*?)\]/gi, 
      '<div class="lesson-video"><iframe src="$1" frameborder="0" allowfullscreen></iframe></div>');
    
    html = html.replace(/\[CHECKLIST\]([\s\S]*?)\[\/CHECKLIST\]/gi, (match, items) => {
      const listItems = items.trim().split('\n').filter(i => i.trim()).map(item => 
        `<li class="checklist-item"><span class="checklist-box">☐</span>${item.replace(/^[-•]\s*/, '')}</li>`
      ).join('');
      return `<ul class="lesson-checklist">${listItems}</ul>`;
    });
    
    // Wrap plain paragraphs
    html = html.split('\n\n').map(block => {
      if (block.trim() && 
          !block.includes('<h1') && !block.includes('<h2') && !block.includes('<h3') &&
          !block.includes('<ul') && !block.includes('<ol') && 
          !block.includes('<div class="callout') && !block.includes('<blockquote') &&
          !block.includes('<img') && !block.includes('<div class="lesson-video')) {
        return `<p class="lesson-p">${block}</p>`;
      }
      return block;
    }).join('\n');
    
    return <div className="lesson-content" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-blue-400 rounded-full animate-spin"></div>
            <GraduationCap className="absolute inset-0 m-auto w-8 h-8 text-blue-400" />
          </div>
          <p className="text-blue-200 text-lg">Loading your training...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Course Not Found</h2>
          <p className="text-slate-600 mb-6">This course doesn't exist or you don't have access.</p>
          <button onClick={() => navigate('/training')} className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all">
            Back to Training
          </button>
        </div>
      </div>
    );
  }

  const progress = calculateProgress();
  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const totalQuizzes = modules.filter(m => m.quiz).length;

  // ============================================================
  // CELEBRATION OVERLAY
  // ============================================================
  const CelebrationOverlay = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 text-center max-w-md mx-4 animate-bounce-in">
        <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          <Trophy className="w-12 h-12 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">🎉 Congratulations!</h2>
        <p className="text-slate-600 text-lg">You've completed this section!</p>
        <div className="mt-6 flex justify-center gap-2">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-8 h-8 text-yellow-400 fill-yellow-400 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    </div>
  );

  // ============================================================
  // COURSE OVERVIEW
  // ============================================================
  if (currentView === 'overview') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        {showCelebration && <CelebrationOverlay />}
        
        {/* Hero Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDE2eiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
          
          <div className="relative max-w-5xl mx-auto px-6 py-10">
            <button onClick={() => navigate('/training')} className="flex items-center gap-2 text-white/80 hover:text-white mb-8 transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Back to All Courses</span>
            </button>
            
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              <div className="w-24 h-24 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/30">
                <GraduationCap className="w-12 h-12 text-white" />
              </div>
              
              <div className="flex-1">
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">{course.title}</h1>
                <p className="text-white/80 text-lg mb-6 max-w-2xl">{course.description}</p>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2 rounded-full text-white text-sm">
                    <BookOpen className="w-4 h-4" />
                    <span>{modules.length} Modules</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2 rounded-full text-white text-sm">
                    <FileText className="w-4 h-4" />
                    <span>{totalLessons} Lessons</span>
                  </div>
                  {totalQuizzes > 0 && (
                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2 rounded-full text-white text-sm">
                      <HelpCircle className="w-4 h-4" />
                      <span>{totalQuizzes} Quizzes</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2 rounded-full text-white text-sm">
                    <Clock className="w-4 h-4" />
                    <span>{course.due_days} days</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Progress Section */}
            <div className="mt-10 bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/70 text-sm">Your Progress</p>
                    <p className="text-white font-bold text-xl">{progress}% Complete</p>
                  </div>
                </div>
                {assignment?.completed_at && (
                  <div className="flex items-center gap-2 bg-green-500/20 text-green-300 px-4 py-2 rounded-full">
                    <Trophy className="w-5 h-5" />
                    <span className="font-medium">Course Completed!</span>
                  </div>
                )}
              </div>
              <div className="h-4 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 rounded-full transition-all duration-1000 relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Course Content */}
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <ListChecks className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Course Content</h2>
          </div>
          
          <div className="space-y-4">
            {modules.map((module, moduleIndex) => {
              const moduleLessonsComplete = module.lessons.every(l => completedLessons[l.id]);
              const quizPassed = module.quiz && quizAttempts[module.quiz.id]?.passed;
              const moduleComplete = moduleLessonsComplete && (!module.quiz || quizPassed);
              const isExpanded = expandedModules[moduleIndex];
              const completedCount = module.lessons.filter(l => completedLessons[l.id]).length + (quizPassed ? 1 : 0);
              const totalCount = module.lessons.length + (module.quiz ? 1 : 0);
              
              return (
                <div key={module.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${
                  moduleComplete ? 'border-green-200' : 'border-slate-200'
                }`}>
                  {/* Module Header */}
                  <button
                    onClick={() => setExpandedModules(prev => ({ ...prev, [moduleIndex]: !prev[moduleIndex] }))}
                    className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${
                        moduleComplete 
                          ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg shadow-green-200' 
                          : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200'
                      }`}>
                        {moduleComplete ? (
                          <CheckCircle className="w-7 h-7" />
                        ) : (
                          <span className="text-xl font-bold">{moduleIndex + 1}</span>
                        )}
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-slate-800 text-lg">{module.title}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-slate-500">
                            {completedCount}/{totalCount} completed
                          </span>
                          <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${moduleComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                              style={{ width: `${(completedCount / totalCount) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {moduleComplete && (
                        <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                          <Sparkles className="w-4 h-4" />
                          Complete
                        </span>
                      )}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        isExpanded ? 'bg-slate-100 rotate-180' : 'bg-slate-50'
                      }`}>
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      </div>
                    </div>
                  </button>
                  
                  {/* Module Content */}
                  {isExpanded && (
                    <div className="border-t border-slate-100">
                      {module.description && (
                        <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-blue-50/50 border-b border-slate-100">
                          <p className="text-slate-600">{module.description}</p>
                        </div>
                      )}
                      
                      {/* Lessons */}
                      <div className="divide-y divide-slate-100">
                        {module.lessons.map((lesson, lessonIndex) => {
                          const isCompleted = completedLessons[lesson.id];
                          
                          return (
                            <button
                              key={lesson.id}
                              onClick={() => startLesson(moduleIndex, lessonIndex)}
                              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-blue-50/50 transition-all text-left group"
                            >
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                                isCompleted 
                                  ? 'bg-green-100 text-green-600' 
                                  : 'bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600'
                              }`}>
                                {isCompleted ? <Check className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-slate-800 group-hover:text-blue-700 transition-colors">{lesson.title}</h4>
                                {lesson.description && (
                                  <p className="text-sm text-slate-500 truncate">{lesson.description}</p>
                                )}
                              </div>
                              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                            </button>
                          );
                        })}
                        
                        {/* Quiz */}
                        {module.quiz && (
                          <button
                            onClick={() => startQuiz(moduleIndex)}
                            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-purple-50/50 transition-all text-left bg-gradient-to-r from-purple-50/50 to-indigo-50/50 group"
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                              quizPassed 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-purple-100 text-purple-600 group-hover:bg-purple-200'
                            }`}>
                              {quizPassed ? <Award className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-slate-800">Module Quiz</h4>
                              <p className="text-sm text-slate-500">
                                {module.quiz.questions?.length || 0} questions • {module.quiz.passing_score}% to pass
                              </p>
                            </div>
                            {quizPassed ? (
                              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                                <Check className="w-4 h-4" />
                                Passed
                              </span>
                            ) : quizAttempts[module.quiz.id] ? (
                              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 text-sm font-medium rounded-full">
                                <RefreshCw className="w-4 h-4" />
                                Retry
                              </span>
                            ) : (
                              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        <LessonStyles />
      </div>
    );
  }

  // ============================================================
  // LESSON VIEW
  // ============================================================
  if (currentView === 'lesson' && currentLesson) {
    const currentModule = modules[currentModuleIndex];
    const isCompleted = completedLessons[currentLesson.id];
    const lessonNumber = currentLessonIndex + 1;
    const totalInModule = currentModule.lessons.length;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Top Navigation */}
        <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <button onClick={() => setCurrentView('overview')} className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Back to Course</span>
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400">Lesson</span>
              <span className="font-medium text-slate-700">{lessonNumber} of {totalInModule}</span>
            </div>
          </div>
          
          {/* Lesson Progress Bar */}
          <div className="h-1 bg-slate-100">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${(lessonNumber / totalInModule) * 100}%` }}
            />
          </div>
        </div>

        {/* Lesson Content */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          <article className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            {/* Lesson Header */}
            <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-8 md:p-10">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDE2eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
              <div className="relative">
                <div className="flex items-center gap-2 text-blue-200 text-sm mb-3">
                  <BookOpen className="w-4 h-4" />
                  <span>{currentModule.title}</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold">{currentLesson.title}</h1>
              </div>
            </div>
            
            {/* Featured Image */}
            {currentLesson.image_url && (
              <div className="relative">
                <img 
                  src={currentLesson.image_url} 
                  alt={currentLesson.title} 
                  className="w-full h-64 md:h-80 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent"></div>
              </div>
            )}
            
            {/* Lesson Body */}
            <div className="p-8 md:p-10">
              {renderRichContent(currentLesson.content)}
            </div>

            {/* Lesson Footer */}
            <div className="border-t border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                {isCompleted ? (
                  <div className="flex items-center gap-3 px-4 py-2 bg-green-100 text-green-700 rounded-xl">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Lesson Completed</span>
                  </div>
                ) : (
                  <button
                    onClick={() => markLessonComplete(currentLesson.id)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all font-medium shadow-lg shadow-green-200 hover:shadow-green-300"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Mark as Complete
                  </button>
                )}
                
                <button
                  onClick={() => {
                    if (!isCompleted) markLessonComplete(currentLesson.id);
                    goToNextItem();
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-medium shadow-lg shadow-blue-200 hover:shadow-blue-300"
                >
                  Continue
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </article>
        </div>
        
        <LessonStyles />
      </div>
    );
  }

  // ============================================================
  // QUIZ VIEW
  // ============================================================
  if (currentView === 'quiz' && currentQuiz) {
    const allAnswered = currentQuiz.questions?.every((q, i) => {
      if (q.question_type === 'open_ended') {
        return openEndedAnswers[i] && openEndedAnswers[i].trim().length > 0;
      }
      return quizAnswers[i] !== undefined;
    });
    const currentModule = modules[currentModuleIndex];

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
        {showCelebration && <CelebrationOverlay />}
        
        {/* Top Navigation */}
        <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <button onClick={() => { setCurrentView('overview'); setQuizResult(null); }} className="flex items-center gap-2 text-slate-600 hover:text-slate-800 group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Back to Course</span>
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
              <Target className="w-4 h-4" />
              {currentQuiz.passing_score}% to pass
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            {/* Quiz Header */}
            <div className="relative bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white p-8">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDE2eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <HelpCircle className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-purple-200 text-sm mb-1">{currentModule.title}</p>
                  <h2 className="text-2xl font-bold">{currentQuiz.title}</h2>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8">
              {quizResult ? (
                // Results
                <div className="text-center py-8">
                  {quizResult.passed ? (
                    <>
                      <div className="w-28 h-28 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-200">
                        <Trophy className="w-14 h-14 text-white" />
                      </div>
                      <h3 className="text-3xl font-bold text-green-600 mb-3">Congratulations! 🎉</h3>
                      <p className="text-slate-600 text-lg mb-2">
                        You scored <span className="font-bold text-2xl text-green-600">{quizResult.score}%</span>
                      </p>
                      <p className="text-slate-500">You've passed this quiz!</p>
                      <div className="flex justify-center gap-1 mt-6">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-8 h-8 text-yellow-400 fill-yellow-400" />
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-28 h-28 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-orange-200">
                        <RefreshCw className="w-14 h-14 text-white" />
                      </div>
                      <h3 className="text-3xl font-bold text-orange-600 mb-3">Almost There!</h3>
                      <p className="text-slate-600 text-lg mb-2">
                        You scored <span className="font-bold text-2xl text-orange-600">{quizResult.score}%</span>
                      </p>
                      <p className="text-slate-500">You need {currentQuiz.passing_score}% to pass. Review the material and try again!</p>
                    </>
                  )}
                  
                  <div className="flex justify-center gap-4 mt-8">
                    {!quizResult.passed && (
                      <button
                        onClick={() => {
                          setQuizAnswers({});
                          setOpenEndedAnswers({});
                          setQuizResult(null);
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 font-medium shadow-lg"
                      >
                        <RefreshCw className="w-5 h-5" />
                        Try Again
                      </button>
                    )}
                    <button
                      onClick={() => { setCurrentView('overview'); setQuizResult(null); }}
                      className="px-6 py-3 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-medium transition-colors"
                    >
                      Back to Course
                    </button>
                  </div>
                </div>
              ) : (
                // Questions
                <div className="space-y-6">
                  {currentQuiz.questions?.map((q, qIndex) => (
                    <div key={qIndex} className="bg-gradient-to-br from-slate-50 to-purple-50/30 rounded-2xl p-6 border border-slate-200">
                      <div className="flex items-start gap-4 mb-5">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-xl flex items-center justify-center font-bold flex-shrink-0 shadow-lg">
                          {qIndex + 1}
                        </div>
                        <p className="font-medium text-slate-800 text-lg pt-1">{q.question}</p>
                      </div>
                      
                      {q.question_type === 'open_ended' ? (
                        <div className="ml-14">
                          <textarea
                            value={openEndedAnswers[qIndex] || ''}
                            onChange={(e) => setOpenEndedAnswers(prev => ({ ...prev, [qIndex]: e.target.value }))}
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 resize-none transition-all"
                            rows={4}
                            placeholder="Type your answer here..."
                          />
                        </div>
                      ) : (
                        <div className="space-y-3 ml-14">
                          {q.options?.map((option, oIndex) => (
                            <button
                              key={oIndex}
                              onClick={() => setQuizAnswers(prev => ({ ...prev, [qIndex]: oIndex }))}
                              className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all ${
                                quizAnswers[qIndex] === oIndex
                                  ? 'border-purple-500 bg-purple-50 text-purple-800 shadow-lg shadow-purple-100'
                                  : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 text-slate-700'
                              }`}
                            >
                              <span className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                  quizAnswers[qIndex] === oIndex 
                                    ? 'border-purple-500 bg-purple-500' 
                                    : 'border-slate-300'
                                }`}>
                                  {quizAnswers[qIndex] === oIndex && <Check className="w-4 h-4 text-white" />}
                                </span>
                                <span className="font-medium">{option}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <button
                    onClick={submitQuiz}
                    disabled={!allAnswered}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg shadow-xl shadow-purple-200"
                  >
                    Submit Quiz
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Styled components for rich lesson content
function LessonStyles() {
  return (
    <style>{`
      @keyframes bounce-in {
        0% { transform: scale(0.8); opacity: 0; }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); opacity: 1; }
      }
      .animate-bounce-in { animation: bounce-in 0.5s ease-out; }
      
      .lesson-content { line-height: 1.9; color: #334155; font-size: 1.05rem; }
      .lesson-p { margin-bottom: 1.5rem; }
      .lesson-h1 { font-size: 1.875rem; font-weight: 700; color: #1e293b; margin: 2.5rem 0 1rem; }
      .lesson-h2 { font-size: 1.5rem; font-weight: 600; color: #1e293b; margin: 2rem 0 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #e2e8f0; }
      .lesson-h3 { font-size: 1.25rem; font-weight: 600; color: #334155; margin: 1.75rem 0 0.75rem; }
      
      .lesson-ul, .lesson-ol { margin: 1.5rem 0; padding-left: 0; list-style: none; }
      .lesson-li { position: relative; padding-left: 2rem; margin-bottom: 1rem; }
      .lesson-li::before { content: ""; position: absolute; left: 0; top: 0.6rem; width: 8px; height: 8px; background: linear-gradient(135deg, #3b82f6, #6366f1); border-radius: 50%; }
      .lesson-li-num { padding-left: 2rem; margin-bottom: 1rem; counter-increment: item; position: relative; }
      .lesson-ol { counter-reset: item; }
      .lesson-li-num::before { content: counter(item); position: absolute; left: 0; top: 0; width: 1.5rem; height: 1.5rem; background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; border-radius: 50%; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; justify-content: center; }
      
      .lesson-img { max-width: 100%; border-radius: 16px; margin: 2rem 0; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
      
      .lesson-video { position: relative; padding-bottom: 56.25%; margin: 2rem 0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.15); }
      .lesson-video iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
      
      .lesson-quote { border-left: 4px solid #6366f1; padding: 1.5rem 2rem; margin: 2rem 0; background: linear-gradient(135deg, #eff6ff, #eef2ff); border-radius: 0 16px 16px 0; font-style: italic; color: #4338ca; }
      
      .lesson-checklist { margin: 1.5rem 0; padding: 1.5rem; background: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0; list-style: none; }
      .checklist-item { display: flex; align-items: flex-start; gap: 1rem; padding: 0.75rem 0; border-bottom: 1px solid #e2e8f0; }
      .checklist-item:last-child { border-bottom: none; }
      .checklist-box { font-size: 1.25rem; }
      
      .callout { display: flex; gap: 1rem; border-radius: 16px; padding: 1.5rem; margin: 2rem 0; }
      .callout-icon { font-size: 1.5rem; flex-shrink: 0; }
      .callout-content { flex: 1; }
      .callout-title { font-weight: 600; margin-bottom: 0.5rem; }
      
      .callout-keypoint { background: linear-gradient(135deg, #fef3c7, #fde68a); border: 1px solid #fcd34d; }
      .callout-keypoint .callout-title { color: #92400e; }
      .callout-keypoint .callout-content { color: #78350f; }
      
      .callout-tip { background: linear-gradient(135deg, #ecfdf5, #d1fae5); border: 1px solid #6ee7b7; }
      .callout-tip .callout-title { color: #065f46; }
      .callout-tip .callout-content { color: #047857; }
      
      .callout-warning { background: linear-gradient(135deg, #fef2f2, #fecaca); border: 1px solid #f87171; }
      .callout-warning .callout-title { color: #991b1b; }
      .callout-warning .callout-content { color: #b91c1c; }
      
      .callout-example { background: linear-gradient(135deg, #eff6ff, #dbeafe); border: 1px solid #93c5fd; }
      .callout-example .callout-title { color: #1e40af; }
      .callout-example .callout-content { color: #1e3a8a; }
      
      .callout-note { background: linear-gradient(135deg, #f5f3ff, #ede9fe); border: 1px solid #c4b5fd; }
      .callout-note .callout-title { color: #5b21b6; }
      .callout-note .callout-content { color: #6d28d9; }
    `}</style>
  );
}

export default TrainingCourse;
