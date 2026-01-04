import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import RichTextEditor from '../components/RichTextEditor';
import { 
  ArrowLeft, Plus, Edit, Trash2, Save, GripVertical,
  BookOpen, FileText, Video, HelpCircle, ChevronDown, ChevronRight,
  Check, X, Eye, Settings, Type, CheckSquare, MessageSquare
} from 'lucide-react';

function AdminTrainingCourse() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { currentUser, supabaseFetch, supabasePost, supabaseDelete, supabasePatch } = useApp();
  
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState({});
  const [activeTab, setActiveTab] = useState('content'); // content, settings
  
  // Modal states
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  
  // Form data
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' });
  const [lessonForm, setLessonForm] = useState({ title: '', content: '', video_url: '' });
  const [testForm, setTestForm] = useState({ 
    title: 'Knowledge Check', 
    passing_score: 80,
    questions: []
  });

  const QUESTION_TYPES = {
    multiple_choice: { label: 'Multiple Choice', icon: CheckSquare },
    open_ended: { label: 'Open Ended', icon: MessageSquare },
  };

  useEffect(() => {
    loadCourse();
  }, [courseId]);

  const loadCourse = async () => {
    try {
      const courseData = await supabaseFetch('training_courses', `select=*&id=eq.${courseId}`);
      if (courseData && courseData[0]) {
        setCourse(courseData[0]);
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
      
      const expanded = {};
      modulesWithContent.forEach(m => { expanded[m.id] = true; });
      setExpandedModules(expanded);
    } catch (error) {
      console.error('Error loading course:', error);
    } finally {
      setLoading(false);
    }
  };

  // Module functions
  const handleSaveModule = async (e) => {
    e.preventDefault();
    try {
      let result;
      if (editingModule) {
        result = await supabasePatch('training_modules', editingModule.id, moduleForm);
      } else {
        result = await supabasePost('training_modules', {
          ...moduleForm,
          course_id: courseId,
          sort_order: modules.length,
        });
      }
      
      // Check for errors in response
      if (result && result.error) {
        console.error('Error saving module:', result);
        alert('Error saving module: ' + (result.message || result.error || 'Unknown error'));
        return;
      }
      
      console.log('Module saved:', result);
      setShowModuleModal(false);
      setEditingModule(null);
      setModuleForm({ title: '', description: '' });
      loadCourse();
    } catch (error) {
      console.error('Error saving module:', error);
      alert('Error saving module: ' + error.message);
    }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!confirm('Delete this module and all its content?')) return;
    try {
      await supabaseDelete('training_modules', `id=eq.${moduleId}`);
      loadCourse();
    } catch (error) {
      console.error('Error deleting module:', error);
    }
  };

  // Lesson functions
  const handleSaveLesson = async (e) => {
    e.preventDefault();
    try {
      if (editingLesson) {
        await supabasePatch('training_lessons', editingLesson.id, lessonForm);
      } else {
        const module = modules.find(m => m.id === selectedModuleId);
        await supabasePost('training_lessons', {
          ...lessonForm,
          module_id: selectedModuleId,
          sort_order: module?.lessons?.length || 0,
        });
      }
      setShowLessonModal(false);
      setEditingLesson(null);
      setLessonForm({ title: '', content: '', video_url: '' });
      loadCourse();
    } catch (error) {
      console.error('Error saving lesson:', error);
    }
  };

  const handleDeleteLesson = async (lessonId) => {
    if (!confirm('Delete this lesson?')) return;
    try {
      await supabaseDelete('training_lessons', `id=eq.${lessonId}`);
      loadCourse();
    } catch (error) {
      console.error('Error deleting lesson:', error);
    }
  };

  // Test/Quiz functions
  const handleSaveTest = async (e) => {
    e.preventDefault();
    try {
      if (editingQuiz) {
        await supabasePatch('training_quizzes', editingQuiz.id, {
          title: testForm.title,
          passing_score: testForm.passing_score,
        });
        
        await supabaseDelete('training_quiz_questions', `quiz_id=eq.${editingQuiz.id}`);
        
        for (let i = 0; i < testForm.questions.length; i++) {
          const q = testForm.questions[i];
          await supabasePost('training_quiz_questions', {
            quiz_id: editingQuiz.id,
            question: q.question,
            question_type: q.question_type || 'multiple_choice',
            options: q.options || [],
            correct_answer: q.correct_answer,
            sort_order: i,
          });
        }
      } else {
        const quizData = await supabasePost('training_quizzes', {
          module_id: selectedModuleId,
          title: testForm.title,
          passing_score: testForm.passing_score,
        });
        
        if (quizData && quizData[0]) {
          for (let i = 0; i < testForm.questions.length; i++) {
            const q = testForm.questions[i];
            await supabasePost('training_quiz_questions', {
              quiz_id: quizData[0].id,
              question: q.question,
              question_type: q.question_type || 'multiple_choice',
              options: q.options || [],
              correct_answer: q.correct_answer,
              sort_order: i,
            });
          }
        }
      }
      
      setShowTestModal(false);
      setEditingQuiz(null);
      setTestForm({ title: 'Knowledge Check', passing_score: 80, questions: [] });
      loadCourse();
    } catch (error) {
      console.error('Error saving test:', error);
    }
  };

  const handleDeleteQuiz = async (quizId) => {
    if (!confirm('Delete this test?')) return;
    try {
      await supabaseDelete('training_quizzes', `id=eq.${quizId}`);
      loadCourse();
    } catch (error) {
      console.error('Error deleting quiz:', error);
    }
  };

  const addQuestion = (type = 'multiple_choice') => {
    const newQuestion = type === 'multiple_choice' 
      ? { question: '', question_type: 'multiple_choice', options: ['', '', '', ''], correct_answer: 0 }
      : { question: '', question_type: 'open_ended', options: [], correct_answer: null };
    
    setTestForm(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }));
  };

  const removeQuestion = (index) => {
    setTestForm(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };

  const updateQuestion = (index, field, value) => {
    setTestForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === index ? { ...q, [field]: value } : q)
    }));
  };

  const updateOption = (qIndex, oIndex, value) => {
    setTestForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => {
        if (i !== qIndex) return q;
        const newOptions = [...q.options];
        newOptions[oIndex] = value;
        return { ...q, options: newOptions };
      })
    }));
  };

  const addOption = (qIndex) => {
    setTestForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => {
        if (i !== qIndex) return q;
        return { ...q, options: [...q.options, ''] };
      })
    }));
  };

  const removeOption = (qIndex, oIndex) => {
    setTestForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => {
        if (i !== qIndex) return q;
        const newOptions = q.options.filter((_, oi) => oi !== oIndex);
        let newCorrect = q.correct_answer;
        if (q.correct_answer === oIndex) newCorrect = 0;
        else if (q.correct_answer > oIndex) newCorrect = q.correct_answer - 1;
        return { ...q, options: newOptions, correct_answer: newCorrect };
      })
    }));
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          You don't have permission to access this page.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-asap-blue/30 border-t-asap-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/training')}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{course?.title || 'Course'}</h1>
          <p className="text-slate-500 text-sm">{course?.description || 'Build your training content below'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/training/${courseId}`)}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
        </div>
      </div>

      {/* Add Module Button */}
      <button
        onClick={() => {
          setEditingModule(null);
          setModuleForm({ title: '', description: '' });
          setShowModuleModal(true);
        }}
        className="w-full mb-6 p-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-asap-blue hover:text-asap-blue transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Add Module (Topic)
      </button>

      {/* Modules List */}
      <div className="space-y-4">
        {modules.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>No modules yet. Add your first module to get started!</p>
          </div>
        )}
        
        {modules.map((module, moduleIndex) => (
          <div key={module.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Module Header */}
            <div className="p-4 bg-gradient-to-r from-asap-blue/5 to-transparent border-b border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setExpandedModules(prev => ({ ...prev, [module.id]: !prev[module.id] }))}
                className="flex items-center gap-3 flex-1"
              >
                {expandedModules[module.id] ? (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
                <div className="w-8 h-8 bg-asap-blue rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  {moduleIndex + 1}
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-slate-800">{module.title}</h3>
                  {module.description && (
                    <p className="text-sm text-slate-500">{module.description}</p>
                  )}
                </div>
              </button>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400 mr-2">
                  {module.lessons.length} steps
                </span>
                <button
                  onClick={() => {
                    setEditingModule(module);
                    setModuleForm({ title: module.title, description: module.description || '' });
                    setShowModuleModal(true);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteModule(module.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Module Content */}
            {expandedModules[module.id] && (
              <div className="p-4">
                {/* Steps (Lessons) */}
                <div className="space-y-2 mb-4">
                  {module.lessons.map((lesson, lessonIndex) => (
                    <div key={lesson.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg group hover:bg-slate-100 transition-colors">
                      <div className="w-6 h-6 bg-white border border-slate-200 rounded flex items-center justify-center text-xs font-medium text-slate-500">
                        {lessonIndex + 1}
                      </div>
                      <FileText className="w-4 h-4 text-asap-blue" />
                      <span className="flex-1 text-sm text-slate-700 font-medium">{lesson.title}</span>
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingLesson(lesson);
                            setLessonForm({ title: lesson.title, content: lesson.content || '', video_url: lesson.video_url || '' });
                            setSelectedModuleId(module.id);
                            setShowLessonModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLesson(lesson.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-white rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Quiz/Test */}
                  {module.quiz && (
                    <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200 group">
                      <div className="w-6 h-6 bg-amber-100 rounded flex items-center justify-center">
                        <HelpCircle className="w-4 h-4 text-amber-600" />
                      </div>
                      <span className="flex-1 text-sm text-amber-800 font-medium">
                        {module.quiz.title}
                        <span className="ml-2 text-amber-600 font-normal">
                          ({module.quiz.questions?.length || 0} questions • {module.quiz.passing_score}% to pass)
                        </span>
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingQuiz(module.quiz);
                            setTestForm({
                              title: module.quiz.title,
                              passing_score: module.quiz.passing_score,
                              questions: module.quiz.questions.map(q => ({
                                question: q.question,
                                question_type: q.question_type || 'multiple_choice',
                                options: q.options || [],
                                correct_answer: q.correct_answer,
                              }))
                            });
                            setSelectedModuleId(module.id);
                            setShowTestModal(true);
                          }}
                          className="p-1.5 text-amber-600 hover:bg-amber-100 rounded"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuiz(module.quiz.id)}
                          className="p-1.5 text-amber-600 hover:text-red-500 hover:bg-amber-100 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Add Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingLesson(null);
                      setLessonForm({ title: '', content: '', video_url: '' });
                      setSelectedModuleId(module.id);
                      setShowLessonModal(true);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-asap-blue bg-asap-blue/5 hover:bg-asap-blue/10 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Step
                  </button>
                  {!module.quiz && (
                    <button
                      onClick={() => {
                        setEditingQuiz(null);
                        setTestForm({ title: 'Knowledge Check', passing_score: 80, questions: [] });
                        setSelectedModuleId(module.id);
                        setShowTestModal(true);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Test
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Module Modal */}
      {showModuleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-800">
                {editingModule ? 'Edit Module' : 'Add Module'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Modules (Topics) are sections of your training that contain steps
              </p>
            </div>
            <form onSubmit={handleSaveModule} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Module Title *</label>
                <input
                  type="text"
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asap-blue"
                  placeholder="e.g., Getting Started with Credit Repair"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
                <textarea
                  value={moduleForm.description}
                  onChange={(e) => setModuleForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asap-blue"
                  rows={2}
                  placeholder="Brief overview of what this module covers"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModuleModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark">
                  {editingModule ? 'Save Changes' : 'Add Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lesson Modal (Step) */}
      {showLessonModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold text-slate-800">
                {editingLesson ? 'Edit Step' : 'Add Step'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Steps contain the actual training content - text, videos, images
              </p>
            </div>
            <form onSubmit={handleSaveLesson} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Step Title *</label>
                <input
                  type="text"
                  value={lessonForm.title}
                  onChange={(e) => setLessonForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asap-blue"
                  placeholder="e.g., How to Pull a Credit Report"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
                <p className="text-xs text-slate-500 mb-2">
                  Use the toolbar to format text, add headers, lists, links, images, and videos
                </p>
                <RichTextEditor
                  value={lessonForm.content}
                  onChange={(content) => setLessonForm(prev => ({ ...prev, content }))}
                  placeholder="Start writing your training content..."
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4 sticky bottom-0 bg-white py-4 border-t border-slate-200 -mx-6 px-6 -mb-6">
                <button type="button" onClick={() => setShowLessonModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark">
                  {editingLesson ? 'Save Changes' : 'Add Step'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold text-slate-800">
                {editingQuiz ? 'Edit Test' : 'Add Test'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Tests verify understanding with multiple choice or open-ended questions
              </p>
            </div>
            <form onSubmit={handleSaveTest} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Test Title</label>
                  <input
                    type="text"
                    value={testForm.title}
                    onChange={(e) => setTestForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asap-blue"
                    placeholder="Knowledge Check"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Passing Score (%)</label>
                  <input
                    type="number"
                    value={testForm.passing_score}
                    onChange={(e) => setTestForm(prev => ({ ...prev, passing_score: parseInt(e.target.value) || 80 }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asap-blue"
                    min={1}
                    max={100}
                  />
                </div>
              </div>

              {/* Questions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-slate-700">Questions</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => addQuestion('multiple_choice')}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-asap-blue hover:bg-asap-blue/10 rounded-lg"
                    >
                      <CheckSquare className="w-4 h-4" />
                      Multiple Choice
                    </button>
                    <button
                      type="button"
                      onClick={() => addQuestion('open_ended')}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Open Ended
                    </button>
                  </div>
                </div>

                {testForm.questions.length === 0 && (
                  <div className="text-center py-8 bg-slate-50 rounded-lg text-slate-500">
                    <HelpCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p>No questions yet. Add a question to get started!</p>
                  </div>
                )}

                {testForm.questions.map((q, qIndex) => (
                  <div key={qIndex} className="p-4 bg-slate-50 rounded-lg space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-8 h-8 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-500">
                        {qIndex + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {q.question_type === 'open_ended' ? (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">Open Ended</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">Multiple Choice</span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={q.question}
                          onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asap-blue"
                          placeholder="Enter your question"
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeQuestion(qIndex)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {q.question_type === 'multiple_choice' && (
                      <div className="ml-11 space-y-2">
                        {q.options.map((opt, oIndex) => (
                          <div key={oIndex} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateQuestion(qIndex, 'correct_answer', oIndex)}
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                q.correct_answer === oIndex
                                  ? 'border-green-500 bg-green-500 text-white'
                                  : 'border-slate-300 hover:border-slate-400'
                              }`}
                            >
                              {q.correct_answer === oIndex && <Check className="w-4 h-4" />}
                            </button>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                              className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-asap-blue"
                              placeholder={`Option ${oIndex + 1}`}
                              required
                            />
                            {q.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => removeOption(qIndex, oIndex)}
                                className="p-1 text-slate-400 hover:text-red-500"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addOption(qIndex)}
                          className="text-sm text-asap-blue hover:underline ml-8"
                        >
                          + Add option
                        </button>
                        <p className="text-xs text-slate-500 ml-8">Click the circle to mark the correct answer</p>
                      </div>
                    )}
                    
                    {q.question_type === 'open_ended' && (
                      <div className="ml-11">
                        <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-400 italic">
                          Employee will type their answer here...
                        </div>
                        <p className="text-xs text-slate-500 mt-2">Open-ended questions are marked complete when answered (manual review required)</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 sticky bottom-0 bg-white py-4 border-t border-slate-200 -mx-6 px-6 -mb-6">
                <button type="button" onClick={() => setShowTestModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark disabled:opacity-50"
                  disabled={testForm.questions.length === 0}
                >
                  {editingQuiz ? 'Save Changes' : 'Add Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminTrainingCourse;
