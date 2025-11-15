import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import bcrypt from 'bcryptjs';

// Define the structure of our database
interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  companyId: string;
  role: 'Admin' | 'Owner' | 'Accountant' | 'Cashier';
  status: 'Pending' | 'Active';
  failedAttempts?: number;
  lockedUntil?: string | null;
}

interface Company {
  id: string;
  name: string;
  has_account_book: boolean;
}

interface Invitation {
  id: string;
  token: string;
  email: string;
  companyId: string;
  role: 'Admin' | 'Owner' | 'Accountant' | 'Cashier';
  isAdmin: boolean;
  invitedBy: string;
  status: 'pending' | 'activated' | 'expired';
  expiresAt: string;
  createdAt: string;
}

interface PasswordReset {
  id: string;
  token: string;
  userId: string;
  expiresAt: string;
  consumed: boolean;
  createdAt: string;
}

interface DbData {
  users: User[];
  companies: Company[];
  invitations: Invitation[];
  passwordResets: PasswordReset[];
}

// Configure the database to use a JSON file for storage
const adapter = new JSONFile<DbData>('backend/db.json');
const defaultData: DbData = { users: [], companies: [], invitations: [], passwordResets: [] };
const db = new Low(adapter, defaultData);

// Function to initialize the database
export const initDb = async () => {
  await db.read();
  // If the database file doesn't exist, write the default data
  if (db.data === null) {
    db.data = defaultData;
    await db.write();
  }

  // Pre-populate with a sample user for Scene 2 (existing employee)
  if (db.data.users.length === 0) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);
    
    const companyId = `comp_${Date.now()}`;

    db.data.companies.push({
      id: companyId,
      name: 'Existing Corp',
      has_account_book: true,
    });

    db.data.users.push({
      id: `user_${Date.now()}`,
      email: 'employee@company.com',
      name: 'John Doe',
      passwordHash: passwordHash,
      companyId: companyId,
      role: 'Accountant',
      status: 'Active',
      failedAttempts: 0,
      lockedUntil: null,
    });

    await db.write();
  }
};

export default db;
