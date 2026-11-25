/** Realistic backup files from the two old apps, exactly as they export them. */

/** Doable (To-do app) backup: Settings → Export backup. */
export const doableBackup = {
  app: 'Doable',
  format: 1,
  exportedAt: '2026-11-20T18:30:00.000Z',
  data: {
    schemaVersion: 1,
    lists: [
      { id: 'inbox', name: 'Inbox', color: '#6c5ce7', emoji: '📥', order: 0, createdAt: 1 },
      { id: 'school', name: 'School', color: '#3b82f6', emoji: '🎒', order: 1, createdAt: 1 },
    ],
    tasks: [
      {
        id: 'd1', listId: 'school', title: 'Science project', notes: 'volcano', priority: 3, dueDate: '2026-11-26', dueTime: '16:00',
        reminder: 15, snoozedUntil: null, repeat: null, subtasks: [{ id: 's1', title: 'Buy clay', done: true }], completedAt: null,
        order: 0, notifId: 1, createdAt: 10, updatedAt: 500,
      },
      {
        id: 'd2', listId: 'inbox', title: 'Walk Biscuit', notes: '', priority: 0, dueDate: '2026-11-25', dueTime: '17:30', reminder: 0,
        snoozedUntil: null, repeat: { freq: 'daily', interval: 1, basis: 'due', anchor: '2026-11-01' }, subtasks: [], completedAt: null,
        order: 1, notifId: 2, createdAt: 10, updatedAt: 400,
      },
      {
        id: 'd3', listId: 'inbox', title: 'Old done thing', notes: '', priority: 0, dueDate: null, dueTime: null, reminder: null,
        snoozedUntil: null, repeat: null, subtasks: [], completedAt: 300, order: 2, notifId: 3, createdAt: 10, updatedAt: 300,
      },
    ],
    settings: {
      theme: 'dark', accent: '#ec4899', allDayReminderTime: '08:00', defaultReminder: 30, weekStart: 0, haptics: true,
      showCompletedInLists: true, reduceMotion: false, viewPrefs: { today: { sort: 'priority', filters: { priorities: [], listIds: [], status: 'open', due: 'any' } } },
    },
    meta: { nextNotifId: 4, createdAt: 1 },
  },
};

/** Habit Tracker v1.0.7 backup (data model v2): Settings → Export. */
export const habitBackupV2 = {
  app: 'habit-tracker',
  exportedAt: '2026-11-24T08:00:00.000Z',
  version: 2,
  habits: [
    {
      id: 'h1', name: 'Drink water', emoji: '💧', color: '#3aa5f2', createdAt: '2026-11-01', unit: 'glasses', timeOfDay: 'anytime',
      rules: [{ since: '2026-11-01', target: 8, schedule: { kind: 'daily' } }], pauses: [], archivedAt: null,
    },
    {
      id: 'h2', name: 'Workout', emoji: '🏋️', color: '#3dbe7e', createdAt: '2026-11-01', unit: '', timeOfDay: 'morning',
      rules: [{ since: '2026-11-01', target: 1, schedule: { kind: 'weekly', times: 3 } }], pauses: [{ from: '2026-11-10', to: '2026-11-11' }], archivedAt: null,
    },
  ],
  completions: { h1: { '2026-11-22': 8, '2026-11-23': 5 }, h2: { '2026-11-23': 1 } },
  notes: { h1: { '2026-11-23': 'hot day' } },
  settings: { theme: 'light', weekStart: 1, accent: '#a970f0', vacations: [{ from: '2026-12-20', to: '2026-12-27' }] },
};

/** Habit Tracker v1.0.1–1.0.4 backup (data model v1: `true` per day, a reminder per habit). */
export const habitBackupV1 = {
  app: 'habit-tracker',
  exportedAt: '2026-11-19T08:00:00.000Z',
  version: 1,
  habits: [{ id: 'old', name: 'Read', emoji: '📚', color: '#8b5cf6', createdAt: '2026-11-10', reminder: { enabled: true, time: '20:30' } }],
  completions: { old: { '2026-11-10': true, '2026-11-11': true } },
  settings: { theme: 'dark', weekStart: 0 },
};
