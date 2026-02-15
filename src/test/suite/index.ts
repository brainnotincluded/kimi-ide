/**
 * Test Runner for Kimi IDE VS Code Extension
 * Configures and runs Mocha tests
 */

import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
    // Create mocha instance
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000, // 10 second timeout
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((resolve, reject) => {
        // Find all test files
        glob('**/*.test.js', { cwd: testsRoot })
            .then(files => {
                // Add files to the test suite
                files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

                try {
                    // Run the mocha test
                    mocha.run(failures => {
                        if (failures > 0) {
                            reject(new Error(`${failures} tests failed.`));
                        } else {
                            resolve();
                        }
                    });
                } catch (err) {
                    console.error(err);
                    reject(err);
                }
            })
            .catch(err => {
                console.error('Failed to find test files:', err);
                reject(err);
            });
    });
}
