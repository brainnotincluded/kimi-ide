/**
 * C/C++ Language Support for Kimi IDE IDE
 * 
 * This module provides comprehensive C/C++ language support including:
 * - Compiler detection and management (gcc, clang, cl)
 * - CMake integration
 * - Code diagnostics (clang-tidy, cppcheck)
 * - Code formatting (clang-format)
 * - Code completion (clangd LSP)
 * - Debug configuration (gdb, lldb)
 */

// Main exports
export { 
    CppLanguageProvider,
    CompilerInfo,
    CMakeInfo,
    CMakeTarget,
    CppDiagnostic,
    DebugConfiguration
} from './CppLanguageProvider';

export { CppStatusBar } from './CppStatusBar';
export { CMakePanel, CMakePanelManager } from './CMakePanel';
export { CppIpcHandler } from './CppIpcHandler';

// Extension activation
export { activate, deactivate } from './extension';

// Version info
export const VERSION = '1.0.0';
export const CPP_LANGUAGE_ID = 'cpp';
export const C_LANGUAGE_ID = 'c';

// Supported features
export const SUPPORTED_FEATURES = {
    compilers: ['gcc', 'clang', 'cl'] as const,
    standards: ['c++11', 'c++14', 'c++17', 'c++20', 'c++23'] as const,
    debuggers: ['gdb', 'lldb'] as const,
    diagnostics: ['clang-tidy', 'cppcheck'] as const,
    formatters: ['clang-format'] as const,
    lsp: ['clangd'] as const
};

// File extensions
export const FILE_EXTENSIONS = {
    source: ['.cpp', '.cc', '.cxx', '.c++', '.c', '.C'],
    header: ['.h', '.hpp', '.hxx', '.h++', '.inl', '.ipp'],
    all: ['.cpp', '.cc', '.cxx', '.c++', '.c', '.C', '.h', '.hpp', '.hxx', '.h++', '.inl', '.ipp']
} as const;
