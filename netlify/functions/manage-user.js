// Netlify Function for creating users with Supabase Auth
// This keeps the service role key secure on the server side

export async function handler(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { action, userData } = JSON.parse(event.body);
    
    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

    if (!SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Service role key not configured',
          message: 'Add SUPABASE_SERVICE_ROLE_KEY to Netlify environment variables'
        })
      };
    }

    if (action === 'create') {
      // Step 1: Create auth user
      const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
          email_confirm: true,
          user_metadata: {
            name: userData.name
          }
        })
      });

      if (!authResponse.ok) {
        const error = await authResponse.json();
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: error.message || 'Failed to create auth user' })
        };
      }

      const authUser = await authResponse.json();

      // Step 2: Create app user with auth_id linked
      const appUserResponse = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          name: userData.name,
          email: userData.email,
          department: userData.department,
          role: userData.role || 'user',
          is_va: userData.is_va || false,
          auth_id: authUser.id,
          is_new_employee: userData.is_new_employee || false,
          hire_date: userData.hire_date || null,
          onboarding_status: userData.onboarding_status || 'none',
          playbook_access: userData.playbook_access || 'full'
        })
      });

      if (!appUserResponse.ok) {
        // Rollback: delete auth user if app user creation fails
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authUser.id}`, {
          method: 'DELETE',
          headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
          }
        });
        
        const error = await appUserResponse.json();
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: error.message || 'Failed to create app user' })
        };
      }

      const appUser = await appUserResponse.json();
      const newUser = appUser[0];

      // Step 3: If new employee with onboarding template, create onboarding assignment
      if (userData.is_new_employee && userData.onboarding_template_id) {
        try {
          // Create user_onboarding record
          await fetch(`${SUPABASE_URL}/rest/v1/user_onboarding`, {
            method: 'POST',
            headers: {
              'apikey': SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              user_id: newUser.id,
              template_id: userData.onboarding_template_id,
              status: 'in_progress',
              started_at: new Date().toISOString()
            })
          });

          // Get tasks for the template
          const tasksResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/onboarding_tasks?template_id=eq.${userData.onboarding_template_id}&is_active=eq.true&select=id`,
            {
              headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
              }
            }
          );
          const tasks = await tasksResponse.json();

          // Create user_onboarding_tasks records for each task
          if (tasks && tasks.length > 0) {
            const taskRecords = tasks.map(task => ({
              user_id: newUser.id,
              task_id: task.id,
              status: 'pending'
            }));

            await fetch(`${SUPABASE_URL}/rest/v1/user_onboarding_tasks`, {
              method: 'POST',
              headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(taskRecords)
            });
          }
        } catch (onboardingError) {
          console.error('Error creating onboarding:', onboardingError);
          // Don't fail the whole user creation if onboarding fails
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          user: newUser,
          message: `Account created for ${userData.name}. They can log in with ${userData.email}`
        })
      };
    }

    if (action === 'delete') {
      const { userId, authId } = userData;

      // Delete auth user if exists
      if (authId) {
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authId}`, {
          method: 'DELETE',
          headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
          }
        });
      }

      // Delete app user
      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
        method: 'DELETE',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        }
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'User deleted' })
      };
    }

    if (action === 'reset-password') {
      const { authId, newPassword } = userData;

      if (!authId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'User does not have an auth account' })
        };
      }

      const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authId}`, {
        method: 'PUT',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: newPassword })
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: error.message || 'Failed to reset password' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Password reset successfully' })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid action' })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}
