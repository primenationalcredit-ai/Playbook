import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { 
  GraduationCap, Plus, Edit, Trash2, Users, Clock, 
  CheckCircle, XCircle, Eye, Rocket, BookOpen, Sparkles,
  ShieldCheck,
  Upload, FileText, Loader, X, Layers, AlertTriangle
} from 'lucide-react';
import { extractTextFromPDF, isPDFFile, extractPDFInChunks } from '../utils/pdfUtils';
import ChunkedPDFProcessor from '../components/ChunkedPDFProcessor';

function AdminTraining() {
  const navigate = useNavigate();
  const { currentUser, users, supabaseFetch, supabasePost, supabaseDelete, supabasePatch } = useApp();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseStats, setCourseStats] = useState({});
  // PHASE D (Joe 8/13): per-course compliance + the leadership override the lock
  // gate requires. Writes only existing columns, so no migration.
  const [compCourse, setCompCourse] = useState(null);
  const [compRows, setCompRows] = useState([]);
  const [compBusy, setCompBusy] = useState(false);
  const openCompliance = async (course) => {
    setCompCourse(course); setCompBusy(true); setCompRows([]);
    const rows = await supabaseFetch('training_assignments', `select=*&course_id=eq.${course.id}`);
    // Compliance receipts (Joe 8/26): quiz attempts feed score / how / completed columns.
    const compMods = await supabaseFetch('training_modules', `select=id&course_id=eq.${course.id}`);
    const compQuizIds = [];
    for (const cm of (compMods || [])) {
      const cqs = await supabaseFetch('training_quizzes', `select=id&module_id=eq.${cm.id}`);
      (cqs || []).forEach(q => compQuizIds.push(q.id));
    }
    let compAttempts = [];
    if (compQuizIds.length) {
      compAttempts = (await supabaseFetch('training_quiz_attempts', `select=user_id,quiz_id,score,passed,answers,attempted_at&quiz_id=in.(${compQuizIds.join(',')})&order=attempted_at.desc`)) || [];
    }
    const byId = {}; (users || []).forEach(u => { byId[u.id] = u; });
    const now = Date.now();
    setCompRows((rows || []).map(r => {
      const u = byId[r.user_id] || {};
      const ua = compAttempts.filter(a => a.user_id === r.user_id);
      const pick = ua.find(a => a.passed) || ua.reduce((m2, a) => (!m2 || (a.score || 0) > (m2.score || 0) ? a : m2), null);
      return { id: r.id, name: u.name || 'Unknown user', dept: u.department || '',
        due: r.due_date, done: r.completed_at,
        score: pick ? pick.score : null, how: pick ? ((pick.answers && pick.answers.quick_check) ? 'Quick Check' : 'Full course') : null,
        late: !r.completed_at && r.due_date && new Date(r.due_date).getTime() < now,
        exempt: u.department === 'leadership' || u.role === 'admin' };
    }).sort((x, y) => (y.late ? 1 : 0) - (x.late ? 1 : 0) || String(x.name).localeCompare(String(y.name))));
    setCompBusy(false);
  };
  const extendDue = async (row, days) => {
    const next = new Date(Math.max(row.due ? new Date(row.due).getTime() : Date.now(), Date.now()));
    next.setDate(next.getDate() + days);
    await supabasePatch('training_assignments', row.id, { due_date: next.toISOString() });
    setCompRows(p => p.map(r => r.id === row.id ? { ...r, due: next.toISOString(), late: false } : r));
  };
  const clearAssignment = async (row) => {
    const at = new Date().toISOString();
    await supabasePatch('training_assignments', row.id, { completed_at: at });
    setCompRows(p => p.map(r => r.id === row.id ? { ...r, done: at, late: false } : r));
  };
  
  // AI Generation states
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showChunkedTraining, setShowChunkedTraining] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generatedCourse, setGeneratedCourse] = useState(null);
  const [generationStep, setGenerationStep] = useState('upload'); // upload, preview, saving
  
  // Accumulated training content from chunks
  const [accumulatedModules, setAccumulatedModules] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    departments: ['everyone'],
    due_days: 7,
  });

  const DEPARTMENTS = [
    { id: 'everyone', name: 'Everyone' },
    { id: 'leadership', name: 'Leadership' },
    { id: 'admin', name: 'Admin' },
    { id: 'credit_team', name: 'Credit Team' },
    { id: 'credit_consultants', name: 'Credit Consultants' },
    { id: 'account_managers', name: 'Account Managers' },
    { id: 'customer_support', name: 'Customer Support' },
  ];

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const data = await supabaseFetch('training_courses', 'select=*&order=created_at.desc');
      setCourses(data || []);
      
      // Load stats for each course
      const stats = {};
      for (const course of (data || [])) {
        const assignments = await supabaseFetch('training_assignments', `select=*&course_id=eq.${course.id}`);
        const completed = (assignments || []).filter(a => a.completed_at).length;
        stats[course.id] = {
          assigned: (assignments || []).length,
          completed,
        };
      }
      setCourseStats(stats);
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let result;
      if (editingCourse) {
        result = await supabasePatch('training_courses', editingCourse.id, {
          title: formData.title,
          description: formData.description,
          departments: formData.departments,
          due_days: formData.due_days,
        });
      } else {
        result = await supabasePost('training_courses', {
          ...formData,
          created_by: currentUser.id,
        });
      }
      
      // Check for errors
      if (result && result.error) {
        console.error('Error saving course:', result);
        alert('Error saving course: ' + (result.message || result.error || 'Unknown error. Make sure to run training-schema.sql in Supabase.'));
        return;
      }
      
      console.log('Course saved:', result);
      setShowModal(false);
      setEditingCourse(null);
      setFormData({ title: '', description: '', departments: ['everyone'], due_days: 7 });
      loadCourses();
    } catch (error) {
      console.error('Error saving course:', error);
      alert('Error saving course: ' + error.message);
    }
  };

  // Generate course from uploaded document
  const generateCourseFromDoc = async () => {
    if (!uploadedFile) return;
    
    // Check file size - warn for files over 5MB
    if (uploadedFile.size > 5 * 1024 * 1024) {
      const proceed = confirm(
        `This file is ${(uploadedFile.size / 1024 / 1024).toFixed(1)}MB.\n\n` +
        `For best results with large documents:\n` +
        `• Course generation uses only the first ~50 pages\n` +
        `• Consider breaking into smaller chapters\n` +
        `• Or copy/paste the most important sections\n\n` +
        `Continue anyway?`
      );
      if (!proceed) return;
    }
    
    setGenerating(true);
    try {
      const isPDF = isPDFFile(uploadedFile);
      let textContent = '';
      
      if (isPDF) {
        try {
          textContent = await extractTextFromPDF(uploadedFile);
          if (!textContent || textContent.trim().length < 100) {
            alert('Could not extract text from this PDF.\n\nPossible reasons:\n• PDF is a scanned image\n• PDF is encrypted\n• No text content\n\nTry copy/paste instead.');
            setGenerating(false);
            return;
          }
        } catch (err) {
          console.error('PDF error:', err);
          alert(`Failed to read PDF: ${err.message}\n\nTry a smaller file or copy/paste.`);
          setGenerating(false);
          return;
        }
      } else {
        textContent = await uploadedFile.text();
      }
      
      // Limit content to prevent timeout (roughly 15k tokens ≈ 60k chars)
      if (textContent.length > 50000) {
        textContent = textContent.substring(0, 50000) + '\n\n[Document truncated for processing...]';
      }
      
      // Call AI to generate course
      const res = await fetch('/.netlify/functions/generate-training-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: textContent,
          filename: uploadedFile.name
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setGeneratedCourse(data.course);
        setGenerationStep('preview');
      } else {
        const err = await res.json().catch(() => ({ error: 'Request timed out - document may be too large' }));
        alert(`Failed to generate: ${err.error || 'Unknown error'}\n\nTry a smaller document or copy/paste key sections.`);
      }
    } catch (err) {
      console.error('Generation error:', err);
      alert('Failed to generate course. The document may be too large.\n\nTry:\n• A smaller file\n• Copy/paste key sections\n• Break into chapters');
    } finally {
      setGenerating(false);
    }
  };

  // Process a single chunk for training content (slower, more thorough)
  // This version AUTO-SAVES to the database as it processes
  const processTrainingChunk = async (chunk, chunkIndex, totalChunks) => {
    // Add a delay between chunks to be thorough and avoid rate limits
    if (chunkIndex > 0) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay between chunks
    }
    
    try {
      const res = await fetch('/.netlify/functions/generate-training-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: chunk.text.substring(0, 25000), // Allow more content for better preservation
          filename: `Section ${chunkIndex + 1} (Pages ${chunk.startPage}-${chunk.endPage})`,
          mode: 'chunk',
          chunkInfo: {
            current: chunkIndex + 1,
            total: totalChunks,
            pages: `${chunk.startPage}-${chunk.endPage}`
          }
        })
      });
      
      if (!res.ok) {
        console.error('Chunk processing failed:', await res.text());
        return [];
      }
      
      const data = await res.json();
      
      if (data.course?.modules?.length > 0) {
        const modulesWithRef = data.course.modules.map(mod => ({
          ...mod,
          sourcePages: `Pages ${chunk.startPage}-${chunk.endPage}`
        }));
        
        setAccumulatedModules(prev => [...prev, ...modulesWithRef]);
        return modulesWithRef;
      }
      return [];
    } catch (err) {
      console.error('Chunk training error:', err);
      return [];
    }
  };

  // Helper function to make direct Supabase POST with retry
  const supabaseDirectPost = async (table, data, retries = 3) => {
    const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(data)
        });
        
        if (res.ok) {
          const result = await res.json();
          return Array.isArray(result) ? result[0] : result;
        }
        
        // If not ok, wait and retry
        if (attempt < retries - 1) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      } catch (err) {
        console.error(`Attempt ${attempt + 1} failed:`, err);
        if (attempt < retries - 1) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    return null;
  };

  // When all training chunks are processed - SAVE EVERYTHING to database
  const onTrainingChunksComplete = async (allResults) => {
    const allModules = allResults.flatMap(r => r.results || []);
    
    if (allModules.length === 0) {
      alert('No training content could be extracted. The PDF may not contain readable training material.');
      setShowChunkedTraining(false);
      return;
    }
    
    // Show saving status
    alert(`Processing complete! Now saving ${allModules.length} modules to database...\n\nThis may take a minute. Please wait.`);
    
    try {
      // 1. Create the course
      const courseData = await supabaseDirectPost('training_courses', {
        title: 'Training Course (from PDF)',
        description: `Comprehensive training course generated from ${allResults.length} document sections with ${allModules.length} modules. Edit to customize.`,
        departments: ['everyone'],
        due_days: 7,
        created_by: currentUser?.id,
        is_published: false
      });
      
      if (!courseData || !courseData.id) {
        throw new Error('Failed to create course');
      }
      
      const courseId = courseData.id;
      console.log('Created course:', courseId);
      
      // 2. Save modules in batches with delays
      let savedModules = 0;
      let savedLessons = 0;
      let savedQuizzes = 0;
      
      for (let i = 0; i < allModules.length; i++) {
        const module = allModules[i];
        
        // Small delay between modules to avoid overwhelming the API
        if (i > 0 && i % 3 === 0) {
          await new Promise(r => setTimeout(r, 500));
        }
        
        // Create module
        const moduleData = await supabaseDirectPost('training_modules', {
          course_id: courseId,
          title: module.title || `Module ${i + 1}`,
          description: module.description || '',
          sort_order: i
        });
        
        if (!moduleData || !moduleData.id) {
          console.error('Failed to create module:', module.title);
          continue;
        }
        
        savedModules++;
        const moduleId = moduleData.id;
        
        // Create lessons (with small delays)
        if (module.lessons && module.lessons.length > 0) {
          for (let j = 0; j < module.lessons.length; j++) {
            const lesson = module.lessons[j];
            const lessonData = await supabaseDirectPost('training_lessons', {
              module_id: moduleId,
              title: lesson.title || `Lesson ${j + 1}`,
              content: lesson.content || '',
              sort_order: j
            });
            if (lessonData && lessonData.id) {
              savedLessons++;
            }
            // Tiny delay between lessons
            if (j > 0 && j % 5 === 0) {
              await new Promise(r => setTimeout(r, 200));
            }
          }
        }
        
        // Create quiz questions
        const quizQuestions = Array.isArray(module.quiz) ? module.quiz : module.quiz?.questions;
        if (quizQuestions && quizQuestions.length > 0) {
          // Create quiz
          const quizData = await supabaseDirectPost('training_quizzes', {
            module_id: moduleId,
            title: `${module.title} Quiz`,
            passing_score: 70
          });
          
          if (quizData && quizData.id) {
            for (let k = 0; k < quizQuestions.length; k++) {
              const q = quizQuestions[k];
              const questionData = await supabaseDirectPost('training_quiz_questions', {
                quiz_id: quizData.id,
                question: q.question || '',
                options: q.options || [],
                correct_answer: q.correct ?? 0,
                explanation: q.explanation || '',
                sort_order: k
              });
              if (questionData) {
                savedQuizzes++;
              }
            }
          }
        }
        
        // Log progress every 5 modules
        if ((i + 1) % 5 === 0) {
          console.log(`Saved ${i + 1}/${allModules.length} modules...`);
        }
      }
      
      // Close the processor and refresh
      setShowChunkedTraining(false);
      loadCourses();
      
      alert(`✓ Training Course Created!\n\n` +
        `• ${savedModules} modules saved\n` +
        `• ${savedLessons} lessons saved\n` +
        `• ${savedQuizzes} quiz questions saved\n\n` +
        `The course is saved as a DRAFT. Click "Edit" to customize the title and content, then publish when ready.`);
      
    } catch (err) {
      console.error('Error saving course:', err);
      alert(`Error saving course: ${err.message}\n\nPlease try again or use a smaller document.`);
      setShowChunkedTraining(false);
    }
  };

  // Save the generated course to database
  const saveGeneratedCourse = async () => {
    if (!generatedCourse) return;
    
    setGenerationStep('saving');
    let savedCourseId = null;
    
    try {
      // 1. Create the course
      const courseResult = await supabasePost('training_courses', {
        title: generatedCourse.title,
        description: generatedCourse.description,
        departments: ['everyone'],
        due_days: 7,
        created_by: currentUser.id,
        is_published: false
      });
      
      // supabasePost returns an array, get first item
      const courseData = Array.isArray(courseResult) ? courseResult[0] : courseResult;
      
      if (!courseData || courseData.error || !courseData.id) {
        console.error('Course creation failed:', courseResult);
        throw new Error('Failed to create course');
      }
      
      const courseId = courseData.id;
      savedCourseId = courseId;
      console.log('Created course:', courseId);
      
      // 2. Create modules, lessons, and quizzes
      for (let i = 0; i < generatedCourse.modules.length; i++) {
        const module = generatedCourse.modules[i];
        
        // Create module
        const moduleResult = await supabasePost('training_modules', {
          course_id: courseId,
          title: module.title,
          description: module.description || '',
          sort_order: i
        });
        
        const moduleData = Array.isArray(moduleResult) ? moduleResult[0] : moduleResult;
        
        if (!moduleData || moduleData.error || !moduleData.id) {
          console.error('Failed to create module:', module.title, moduleResult);
          continue;
        }
        const moduleId = moduleData.id;
        console.log('Created module:', moduleId, module.title);
        
        // Create lessons
        if (module.lessons && module.lessons.length > 0) {
          for (let j = 0; j < module.lessons.length; j++) {
            const lesson = module.lessons[j];
            const lessonResult = await supabasePost('training_lessons', {
              module_id: moduleId,
              title: lesson.title,
              content: lesson.content || '',
              sort_order: j
            });
            const lessonData = Array.isArray(lessonResult) ? lessonResult[0] : lessonResult;
            if (lessonData && lessonData.id) {
              console.log('Created lesson:', lesson.title);
            }
          }
        }
        
        // Create quiz - handle both formats:
        // Format 1: module.quiz is an array of questions directly
        // Format 2: module.quiz is an object with a questions property
        const quizQuestions = Array.isArray(module.quiz) ? module.quiz : module.quiz?.questions;
        
        if (quizQuestions && quizQuestions.length > 0) {
          const quizResult = await supabasePost('training_quizzes', {
            module_id: moduleId,
            title: `${module.title} Quiz`,
            passing_score: 80
          });
          
          const quizData = Array.isArray(quizResult) ? quizResult[0] : quizResult;
          
          if (quizData && !quizData.error && quizData.id) {
            const quizId = quizData.id;
            console.log('Created quiz:', quizId);
            
            // Create questions
            for (let k = 0; k < quizQuestions.length; k++) {
              const q = quizQuestions[k];
              // Handle different answer formats
              let correctAnswer = q.correct_answer;
              if (correctAnswer === undefined && q.correct !== undefined) {
                // Convert index to letter (0 -> 'A', 1 -> 'B', etc.)
                correctAnswer = String.fromCharCode(65 + q.correct);
              }
              
              await supabasePost('training_quiz_questions', {
                quiz_id: quizId,
                question_type: q.type || 'multiple_choice',
                question: q.question,
                options: q.options || [],
                correct_answer: correctAnswer,
                explanation: q.explanation || '',
                sort_order: k
              });
            }
            console.log(`Created ${quizQuestions.length} quiz questions`);
          }
        }
      }
      
      // Success! Close modal and refresh
      setShowGenerateModal(false);
      setGeneratedCourse(null);
      setUploadedFile(null);
      setGenerationStep('upload');
      loadCourses();
      
      alert(`✓ Course saved successfully!\n\n${generatedCourse.modules.length} modules with lessons and quizzes created.`);
      
      // Navigate to edit the new course
      if (savedCourseId) {
        navigate(`/admin/training/${savedCourseId}`);
      }
      
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save course: ' + err.message);
      setGenerationStep('preview');
    }
  };

  const handleEdit = (course) => {
    setEditingCourse(course);
    setFormData({
      title: course.title,
      description: course.description || '',
      departments: course.departments || ['everyone'],
      due_days: course.due_days || 7,
    });
    setShowModal(true);
  };

  const handleDelete = async (courseId) => {
    if (!confirm('Are you sure you want to delete this course? All modules, lessons, and progress will be lost.')) return;
    try {
      await supabaseDelete('training_courses', `id=eq.${courseId}`);
      loadCourses();
    } catch (error) {
      console.error('Error deleting course:', error);
    }
  };

  const handlePublish = async (course) => {
    try {
      // Toggle publish status
      await supabasePatch('training_courses', course.id, {
        is_published: !course.is_published,
      });
      
      // If publishing, auto-assign to relevant users
      if (!course.is_published) {
        const relevantUsers = users.filter(u => {
          if (course.departments.includes('everyone')) return true;
          return course.departments.includes(u.department);
        });
        
        for (const user of relevantUsers) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + (course.due_days || 7));
          
          // Check if already assigned
          const existing = await supabaseFetch('training_assignments', 
            `select=*&user_id=eq.${user.id}&course_id=eq.${course.id}`);
          
          if (!existing || existing.length === 0) {
            await supabasePost('training_assignments', {
              user_id: user.id,
              course_id: course.id,
              due_date: dueDate.toISOString(),
            });
          }
        }
      }
      
      loadCourses();
    } catch (error) {
      console.error('Error publishing course:', error);
    }
  };

  const handleDepartmentToggle = (deptId) => {
    setFormData(prev => {
      if (deptId === 'everyone') {
        return { ...prev, departments: ['everyone'] };
      }
      
      let newDepts = prev.departments.filter(d => d !== 'everyone');
      if (newDepts.includes(deptId)) {
        newDepts = newDepts.filter(d => d !== deptId);
      } else {
        newDepts.push(deptId);
      }
      
      if (newDepts.length === 0) {
        newDepts = ['everyone'];
      }
      
      return { ...prev, departments: newDepts };
    });
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-asap-blue/10 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-asap-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Training Portal</h1>
            <p className="text-slate-500 text-sm">Create and manage training courses</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowGenerateModal(true);
              setGenerationStep('upload');
              setUploadedFile(null);
              setGeneratedCourse(null);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Generate from Doc
          </button>
          <button
            onClick={() => {
              setAccumulatedModules([]);
              setShowChunkedTraining(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-colors"
          >
            <Layers className="w-4 h-4" />
            Large PDF
          </button>
          <button
            onClick={() => {
              setEditingCourse(null);
              setFormData({ title: '', description: '', departments: ['everyone'], due_days: 7 });
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-asap-blue text-white px-4 py-2 rounded-lg hover:bg-asap-blue-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Course
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-asap-blue/30 border-t-asap-blue rounded-full animate-spin" />
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">No courses yet</h3>
          <p className="text-slate-500 mb-4">Create your first training course or generate one from a document</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setShowGenerateModal(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Generate from Doc
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 bg-asap-blue text-white px-4 py-2 rounded-lg hover:bg-asap-blue-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Course
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {courses.map(course => (
            <div key={course.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-800">{course.title}</h3>
                    {course.is_published ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        Published
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-sm mb-4">{course.description || 'No description'}</p>
                  
                  <div className="flex items-center gap-6 text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{course.departments?.join(', ') || 'Everyone'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{course.due_days} days to complete</span>
                    </div>
                    {courseStats[course.id] && (
                      <>
                        <div className="flex items-center gap-1">
                          <BookOpen className="w-4 h-4" />
                          <span>{courseStats[course.id].assigned} assigned</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>{courseStats[course.id].completed} completed</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openCompliance(course)}
                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Who is overdue / override"
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => navigate(`/admin/training/${course.id}`)}
                    className="p-2 text-slate-400 hover:text-asap-blue hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit Content"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handlePublish(course)}
                    className={`p-2 rounded-lg transition-colors ${
                      course.is_published 
                        ? 'text-green-500 hover:bg-green-50' 
                        : 'text-slate-400 hover:text-green-500 hover:bg-slate-100'
                    }`}
                    title={course.is_published ? 'Unpublish' : 'Publish'}
                  >
                    <Rocket className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(course)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(course.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-800">
                {editingCourse ? 'Edit Course' : 'Create New Course'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Course Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asap-blue"
                  placeholder="e.g., New Hire Onboarding"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asap-blue"
                  rows={3}
                  placeholder="What will employees learn in this course?"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Assign to Departments
                </label>
                <div className="flex flex-wrap gap-2">
                  {DEPARTMENTS.map(dept => (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => handleDepartmentToggle(dept.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        formData.departments.includes(dept.id)
                          ? 'bg-asap-blue text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {dept.name}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Days to Complete
                </label>
                <input
                  type="number"
                  value={formData.due_days}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_days: parseInt(e.target.value) || 7 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-asap-blue"
                  min={1}
                  max={365}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Employees will have this many days to complete the training after it's assigned
                </p>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCourse(null);
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark transition-colors"
                >
                  {editingCourse ? 'Save Changes' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate from Document Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-purple-600 to-pink-600">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-white" />
                <h2 className="text-lg font-semibold text-white">
                  {generationStep === 'upload' && 'Generate Training from Document'}
                  {generationStep === 'preview' && 'Preview Generated Course'}
                  {generationStep === 'saving' && 'Saving Course...'}
                </h2>
              </div>
              <button 
                onClick={() => {
                  setShowGenerateModal(false);
                  setGeneratedCourse(null);
                  setUploadedFile(null);
                }}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Step 1: Upload */}
              {generationStep === 'upload' && (
                <div className="space-y-4">
                  <p className="text-slate-600">
                    Upload a training document (PDF, TXT, MD) and AI will automatically create a complete training course with modules, lessons, and quiz questions.
                  </p>
                  
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-purple-300 transition-colors">
                    <input
                      type="file"
                      accept=".txt,.md,.pdf,.doc,.docx"
                      onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="training-doc-upload"
                    />
                    <label htmlFor="training-doc-upload" className="cursor-pointer">
                      <FileText size={40} className="mx-auto mb-3 text-slate-400" />
                      {uploadedFile ? (
                        <div>
                          <p className="text-slate-800 font-medium">{uploadedFile.name}</p>
                          <p className="text-sm text-slate-500">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-slate-700 font-medium">Click to upload your training document</p>
                          <p className="text-sm text-slate-500">PDF, TXT, MD, DOCX supported</p>
                        </div>
                      )}
                    </label>
                  </div>
                  
                  {/* Large file warning */}
                  {uploadedFile && uploadedFile.size > 2 * 1024 * 1024 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-amber-800 font-medium">Large file detected ({(uploadedFile.size / 1024 / 1024).toFixed(1)} MB)</p>
                          <p className="text-amber-700 text-sm mt-1">
                            This file is too large for quick processing and will likely time out.
                          </p>
                          <button
                            onClick={() => {
                              setShowGenerateModal(false);
                              setUploadedFile(null);
                              setAccumulatedModules([]);
                              setShowChunkedTraining(true);
                            }}
                            className="mt-3 flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
                          >
                            <Layers className="w-4 h-4" />
                            Use Large PDF Processor Instead
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {uploadedFile && uploadedFile.size <= 2 * 1024 * 1024 && (
                    <button
                      onClick={generateCourseFromDoc}
                      disabled={generating}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
                    >
                      {generating ? (
                        <>
                          <Loader size={18} className="animate-spin" />
                          Generating course... This may take a minute...
                        </>
                      ) : (
                        <>
                          <Sparkles size={18} />
                          Generate Training Course
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
              
              {/* Step 2: Preview */}
              {generationStep === 'preview' && generatedCourse && (
                <div className="space-y-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-800 font-medium">✓ Course generated successfully!</p>
                    <p className="text-green-700 text-sm">Review the content below, then save to create the course. You can edit everything after saving.</p>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">{generatedCourse.title}</h3>
                    <p className="text-slate-600 mt-1">{generatedCourse.description}</p>
                    {generatedCourse.estimated_time && (
                      <p className="text-sm text-slate-500 mt-1">Estimated time: {generatedCourse.estimated_time}</p>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-semibold text-slate-700">Modules ({generatedCourse.modules?.length || 0})</h4>
                    {generatedCourse.modules?.map((module, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-lg p-4">
                        <h5 className="font-medium text-slate-800">{idx + 1}. {module.title}</h5>
                        {module.description && <p className="text-sm text-slate-600 mt-1">{module.description}</p>}
                        
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-medium text-slate-500 uppercase">Lessons ({module.lessons?.length || 0})</p>
                          {module.lessons?.map((lesson, lidx) => (
                            <div key={lidx} className="ml-4 text-sm text-slate-600">
                              • {lesson.title}
                            </div>
                          ))}
                        </div>
                        
                        {module.quiz?.questions?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-slate-500 uppercase">Quiz: {module.quiz.questions.length} questions</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={() => {
                        setGenerationStep('upload');
                        setGeneratedCourse(null);
                      }}
                      className="flex-1 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Start Over
                    </button>
                    <button
                      onClick={saveGeneratedCourse}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle size={18} />
                      Save & Edit Course
                    </button>
                  </div>
                </div>
              )}
              
              {/* Step 3: Saving */}
              {generationStep === 'saving' && (
                <div className="text-center py-12">
                  <Loader size={40} className="animate-spin text-purple-600 mx-auto mb-4" />
                  <p className="text-slate-600">Saving course, modules, lessons, and quizzes...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chunked PDF Training Processor */}
      {showChunkedTraining && (
        <ChunkedPDFProcessor
          title="Generate Training from Large PDF"
          processButtonText="Start Building Training Course"
          onChunkProcessed={processTrainingChunk}
          onAllComplete={onTrainingChunksComplete}
          onClose={() => setShowChunkedTraining(false)}
        />
      )}
      {/* PHASE D compliance + override */}
      {compCourse && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '85vh' }}>
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">Training compliance</div>
                <div className="text-xs text-slate-500">{compCourse.title}</div>
              </div>
              <button onClick={() => setCompCourse(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {compBusy && <div className="text-sm text-slate-400 p-4">Loading...</div>}
              {!compBusy && compRows.length === 0 && <div className="text-sm text-slate-400 p-4">Nobody is assigned to this course yet.</div>}
              {!compBusy && compRows.length > 0 && (
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-slate-400 uppercase text-left"><th className="py-2">Employee</th><th>Due</th><th>Status</th><th>Score</th><th>How</th><th>Completed</th><th className="text-right">Override</th></tr></thead>
                  <tbody>
                    {compRows.map(r => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="py-2">
                          <div className="font-medium text-slate-700">{r.name}</div>
                          <div className="text-xs text-slate-400">{r.dept}{r.exempt ? ' - never locked' : ''}</div>
                        </td>
                        <td className="text-slate-600 text-xs">{r.due ? new Date(r.due).toLocaleDateString() : 'no due date'}</td>
                        <td>{r.done
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Complete</span>
                          : r.late
                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">{r.exempt ? 'Overdue' : 'Overdue - locked out'}</span>
                            : <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">On track</span>}</td>
                        <td className="text-slate-600 text-xs">{r.score != null ? `${r.score}%` : '-'}</td>
                        <td className="text-slate-600 text-xs">{r.how || '-'}</td>
                        <td className="text-slate-600 text-xs">{r.done ? new Date(r.done).toLocaleDateString() : '-'}</td>
                        <td className="text-right whitespace-nowrap">
                          {!r.done && (<>
                            <button onClick={() => extendDue(r, 7)} className="px-2 py-1 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 mr-1">+7 days</button>
                            <button onClick={() => clearAssignment(r)} className="px-2 py-1 text-xs rounded-lg border border-slate-200 text-emerald-700 hover:bg-emerald-50">Clear</button>
                          </>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 text-xs text-slate-500">Extending pushes the deadline and unlocks them until then. Clearing marks it complete for that person - only when they have genuinely done it or are exempt.</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminTraining;
