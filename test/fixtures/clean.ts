/**
 * A clean, well-structured TypeScript file for testing.
 */

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<boolean>;
}

export class InMemoryUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async delete(id: string): Promise<boolean> {
    return this.users.delete(id);
  }
}

export function createUser(name: string, email: string): User {
  return {
    id: generateId(),
    name,
    email,
    createdAt: new Date(),
  };
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}
