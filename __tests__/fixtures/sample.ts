/**
 * Sample TypeScript file for testing
 */

export interface User {
    id: number;
    name: string;
    email: string;
}

export class UserService {
    private users: User[] = [];

    async getUser(id: number): Promise<User | undefined> {
        return this.users.find(u => u.id === id);
    }

    async createUser(userData: Omit<User, 'id'>): Promise<User> {
        const user: User = {
            id: this.users.length + 1,
            ...userData,
        };
        this.users.push(user);
        return user;
    }

    async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
        const index = this.users.findIndex(u => u.id === id);
        if (index === -1) return undefined;
        
        this.users[index] = { ...this.users[index], ...updates };
        return this.users[index];
    }

    async deleteUser(id: number): Promise<boolean> {
        const index = this.users.findIndex(u => u.id === id);
        if (index === -1) return false;
        
        this.users.splice(index, 1);
        return true;
    }
}

// Example usage
export async function example() {
    const service = new UserService();
    
    const user = await service.createUser({
        name: 'John Doe',
        email: 'john@example.com',
    });
    
    console.log(`Created user: ${user.name}`);
}
