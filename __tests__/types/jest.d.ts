/**
 * Jest type extensions
 */

declare namespace jest {
    interface Matchers<R> {
        toBeWithinRange(floor: number, ceiling: number): R;
    }
}

declare module 'jest-extended/all' {
    // jest-extended types
}
