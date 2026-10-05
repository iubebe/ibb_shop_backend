import type { UserRole } from '../../database/enums.js';

export interface UserView {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
}
