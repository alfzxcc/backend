export const Role = {
  Admin: 'Admin',
  User: 'User'
} as const;

export type RoleType = typeof Role[keyof typeof Role];
