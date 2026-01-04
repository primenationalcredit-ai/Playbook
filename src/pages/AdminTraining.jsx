import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { 
  GraduationCap, Plus, Edit, Trash2, Users, Clock, 
  CheckCircle, XCircle, Eye, Rocket, BookOpen
} from 'lucide-react';

function AdminTraining() {
  const navigate = useNavigate();
  const { currentUser, users, supabaseFetch, supabasePost, supabaseDelete, supabasePatch } = useApp();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseStats, setCourseStats] = useState({});

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

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-asap-blue/30 border-t-asap-blue rounded-full animate-spin" />
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">No courses yet</h3>
          <p className="text-slate-500 mb-4">Create your first training course to get started</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-asap-blue text-white px-4 py-2 rounded-lg hover:bg-asap-blue-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Course
          </button>
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
    </div>
  );
}

export default AdminTraining;
