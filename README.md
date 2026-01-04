# ASAP Playbook

A daily task management and training platform for ASAP Credit Repair.

## Features

### Phase 1 (Current)
- ✅ **Daily Playbook** - Time-based task management with automatic daily reset
- ✅ **Personal Tasks** - Employees can create their own one-time or recurring tasks
- ✅ **Team Dashboard** - Leadership can view all team members' progress
- ✅ **Updates/Announcements** - Push updates to departments with acknowledgement tracking
- ✅ **Admin Panel** - Manage tasks, users, and updates
- ✅ **Department Filtering** - Built-in support for 6 departments

### Phase 2 (Planned)
- 📋 Full training platform (Trainual-style)
- 📋 Video/document hosting
- 📋 Quizzes and assessments
- 📋 Onboarding paths
- 📋 Email notifications for overdue tasks
- 📋 End-of-day leadership reports

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone or download the project
cd asap-playbook

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Demo Accounts

The app comes with pre-configured demo accounts:

| Email | Role | Department |
|-------|------|------------|
| joe@asapcreditrepair.com | Admin | Leadership |
| astrid@asapcreditrepair.com | Admin | Admin |
| eric@asapcreditrepair.com | User | Credit Consultants |
| cindy@asapcreditrepair.com | User | Credit Consultants |
| carlos@asapcreditrepair.com | User | Account Managers |
| kimberly@asapcreditrepair.com | User | Account Managers |

## Deployment

### Build for Production

```bash
npm run build
```

This creates a `dist` folder with static files ready for deployment.

### Deploy to Vercel

1. Push to GitHub
2. Connect repository to Vercel
3. Deploy with default settings (Vite is auto-detected)

### Deploy to Netlify

1. Push to GitHub
2. Connect repository to Netlify
3. Build command: `npm run build`
4. Publish directory: `dist`

## Project Structure

```
asap-playbook/
├── src/
│   ├── components/      # Reusable UI components
│   │   └── Layout.jsx   # Main app layout with sidebar
│   ├── context/
│   │   └── AppContext.jsx  # Global state management
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── MyPlaybook.jsx
│   │   ├── TeamView.jsx
│   │   ├── Updates.jsx
│   │   ├── AdminTasks.jsx
│   │   ├── AdminUsers.jsx
│   │   └── AdminUpdates.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── public/
├── package.json
└── README.md
```

## Time Slots

Tasks are organized into 6 time slots that auto-sort in the playbook:

1. **Morning** - No specific time, start-of-day tasks
2. **AM (Timed)** - Tasks with times before 12:00 PM
3. **Afternoon** - No specific time, midday tasks
4. **PM (12:01-4:00)** - Afternoon timed tasks
5. **End of Day** - Wrap-up tasks
6. **Evening (4:01-7:00)** - Late day timed tasks

## Data Storage

Currently uses localStorage for data persistence. Data structure:

- `asap_currentUser` - Logged in user
- `asap_users` - All users
- `asap_taskTemplates` - Task definitions
- `asap_dailyTasks` - Today's completions and personal tasks
- `asap_updates` - Announcements and acknowledgements

### Daily Reset

At midnight, all task completions reset except:
- Personal recurring tasks (marked as "daily" by the employee)

## Customization

### Adding Departments

Edit `DEPARTMENTS` array in `src/context/AppContext.jsx`:

```javascript
const DEPARTMENTS = [
  { id: 'leadership', name: 'Leadership' },
  { id: 'admin', name: 'Admin' },
  // Add more here
];
```

### Adding Time Slots

Edit `TIME_SLOTS` object in `src/context/AppContext.jsx`:

```javascript
const TIME_SLOTS = {
  MORNING: { id: 'morning', label: 'Morning', order: 1, color: 'amber' },
  // Add more here
};
```

### Branding

Edit colors in `tailwind.config.js`:

```javascript
colors: {
  'asap-navy': '#1a2744',
  'asap-blue': '#2563eb',
  'asap-gold': '#f59e0b',
}
```

## Future Enhancements

- [ ] Database integration (Supabase/Firebase)
- [ ] Email notifications
- [ ] Push notifications
- [ ] Trainual import
- [ ] API for Pipedrive integration
- [ ] Mobile app (React Native)

## Support

For questions or issues, contact the development team.

---

Built for ASAP Credit Repair © 2025
