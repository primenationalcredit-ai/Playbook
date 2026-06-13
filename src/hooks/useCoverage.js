import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';

/**
 * Hook to manage task coverage/backup assignments
 * Checks if users are out (PTO) and finds their backups
 */
export function useCoverage() {
  const { supabase, user } = useApp();
  const [usersOut, setUsersOut] = useState([]);
  const [userBackups, setUserBackups] = useState({});
  const [taskBackups, setTaskBackups] = useState({});
  const [coverageActive, setCoverageActive] = useState({});
  const [loading, setLoading] = useState(true);

  // Load coverage data on mount
  useEffect(() => {
    loadCoverageData();
  }, []);

  const loadCoverageData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      // 1. Get users who are out today - PRIMARY: daily_out table (admin toggle)
      let dailyOutUserIds = [];
      try {
        const { data: dailyOutData } = await supabase
          .from('daily_out')
          .select('user_id')
          .eq('date', today);
        dailyOutUserIds = dailyOutData?.map(e => e.user_id) || [];
      } catch (e) { console.log('daily_out not available'); }

      // Also check approved time_off_requests
      let ptoUserIds = [];
      try {
        const { data: ptoData } = await supabase
          .from('time_off_requests')
          .select('user_id')
          .eq('status', 'approved')
          .lte('start_date', today)
          .gte('end_date', today);
        ptoUserIds = ptoData?.map(p => p.user_id) || [];
      } catch (e) { console.log('time_off_requests not available'); }

      // Combine both sources (deduplicated)
      const outUserIds = [...new Set([...dailyOutUserIds, ...ptoUserIds])];
      setUsersOut(outUserIds);
      console.log(`[useCoverage] Users out today: ${outUserIds.length}`, outUserIds);

      // 2. Get user backups
      const { data: userBackupsData } = await supabase
        .from('user_backups')
        .select(`
          user_id,
          backup_user_id,
          priority,
          backup_user:backup_user_id(id, name, department)
        `)
        .order('priority');

      // Group by user_id
      const userBackupsMap = {};
      userBackupsData?.forEach(backup => {
        if (!userBackupsMap[backup.user_id]) {
          userBackupsMap[backup.user_id] = [];
        }
        userBackupsMap[backup.user_id].push(backup);
      });
      setUserBackups(userBackupsMap);

      // 3. Get task backups
      const { data: taskBackupsData } = await supabase
        .from('task_backups')
        .select(`
          task_id,
          backup_user_id,
          priority,
          backup_user:backup_user_id(id, name, department)
        `)
        .order('priority');

      // Group by task_id
      const taskBackupsMap = {};
      taskBackupsData?.forEach(backup => {
        if (!taskBackupsMap[backup.task_id]) {
          taskBackupsMap[backup.task_id] = [];
        }
        taskBackupsMap[backup.task_id].push(backup);
      });
      setTaskBackups(taskBackupsMap);

      // 4. Determine active coverage (who is covering for whom today)
      const activeCoverage = {};
      outUserIds.forEach(outUserId => {
        const backups = userBackupsMap[outUserId];
        if (backups && backups.length > 0) {
          // Get highest priority backup that's not also out
          const availableBackup = backups.find(b => !outUserIds.includes(b.backup_user_id));
          if (availableBackup) {
            activeCoverage[outUserId] = {
              backupUserId: availableBackup.backup_user_id,
              backupUser: availableBackup.backup_user
            };
          }
        }
      });
      setCoverageActive(activeCoverage);

    } catch (error) {
      console.error('Error loading coverage data:', error);
    }

    setLoading(false);
  };

  /**
   * Check if a user is out today
   */
  const isUserOut = useCallback((userId) => {
    return usersOut.includes(userId);
  }, [usersOut]);

  /**
   * Get the effective assignee for a task
   * Returns the backup user if original is out, otherwise returns original
   */
  const getEffectiveAssignee = useCallback((taskId, originalUserId) => {
    // If user is not out, return original
    if (!usersOut.includes(originalUserId)) {
      return { userId: originalUserId, isCoverage: false };
    }

    // First check for task-specific backup
    const taskBackupList = taskBackups[taskId];
    if (taskBackupList && taskBackupList.length > 0) {
      // Find first available backup (not also out)
      const availableBackup = taskBackupList.find(b => !usersOut.includes(b.backup_user_id));
      if (availableBackup) {
        return {
          userId: availableBackup.backup_user_id,
          backupUser: availableBackup.backup_user,
          isCoverage: true,
          coveringFor: originalUserId,
          type: 'task'
        };
      }
    }

    // Fall back to user-level backup
    const userBackupList = userBackups[originalUserId];
    if (userBackupList && userBackupList.length > 0) {
      const availableBackup = userBackupList.find(b => !usersOut.includes(b.backup_user_id));
      if (availableBackup) {
        return {
          userId: availableBackup.backup_user_id,
          backupUser: availableBackup.backup_user,
          isCoverage: true,
          coveringFor: originalUserId,
          type: 'user'
        };
      }
    }

    // No backup found, return original (task will show as uncovered)
    return { userId: originalUserId, isCoverage: false, noBackupAvailable: true };
  }, [usersOut, taskBackups, userBackups]);

  /**
   * Get all tasks that the current user should see
   * (their own + any they're covering for)
   */
  const getTasksForUser = useCallback((allTasks, userId) => {
    const myTasks = [];
    const coveringTasks = [];

    allTasks.forEach(task => {
      // Check if this is the user's own task
      if (task.user_id === userId) {
        myTasks.push({ ...task, isCoverage: false });
        return;
      }

      // Check if user is covering for someone who has this task
      Object.entries(coverageActive).forEach(([outUserId, coverage]) => {
        if (coverage.backupUserId === userId && task.user_id === outUserId) {
          coveringTasks.push({
            ...task,
            isCoverage: true,
            coveringFor: outUserId,
            originalUser: coverage.backupUser
          });
        }
      });
    });

    return { myTasks, coveringTasks, allTasks: [...myTasks, ...coveringTasks] };
  }, [coverageActive]);

  /**
   * Log a coverage event
   */
  const logCoverage = async (originalUserId, coverageUserId, taskId, reason = 'pto') => {
    try {
      await supabase.from('coverage_log').insert({
        date: new Date().toISOString().split('T')[0],
        original_user_id: originalUserId,
        coverage_user_id: coverageUserId,
        task_id: taskId,
        reason
      });
    } catch (error) {
      console.error('Error logging coverage:', error);
    }
  };

  /**
   * Get coverage summary for today
   */
  const getCoverageSummary = useCallback(() => {
    const summary = [];
    Object.entries(coverageActive).forEach(([outUserId, coverage]) => {
      summary.push({
        outUserId,
        backupUserId: coverage.backupUserId,
        backupUser: coverage.backupUser
      });
    });
    return summary;
  }, [coverageActive]);

  return {
    loading,
    usersOut,
    userBackups,
    taskBackups,
    coverageActive,
    isUserOut,
    getEffectiveAssignee,
    getTasksForUser,
    getCoverageSummary,
    logCoverage,
    refresh: loadCoverageData
  };
}

export default useCoverage;
