/**
 * Outline View Module
 * IDE Kimi IDE - Structure/Outline View for Code Navigation
 * 
 * @example
 * ```typescript
 * import { OutlinePanel, OutlineProvider, GoToSymbolPicker } from './outline';
 * 
 * // Use the outline provider
 * const provider = new OutlineProvider();
 * const symbols = await provider.getDocumentSymbols(fileUri, fileContent);
 * 
 * // Render the outline panel
 * <OutlinePanel
 *   symbols={symbols}
 *   onNavigate={(target) => editor.goto(target)}
 * />
 * ```
 */

// Types
export * from './types';

// Components
export { SymbolIcon, SymbolIconGroup, SymbolBadge } from './SymbolIcon';
export { Breadcrumbs, FlatBreadcrumbs } from './Breadcrumbs';
export { SymbolTree } from './SymbolTree';
export { OutlinePanel } from './OutlinePanel';
export { GoToSymbolPicker } from './GoToSymbolPicker';

// Provider
export { OutlineProvider, outlineProvider } from './OutlineProvider';

// Parsers
export { BaseParser } from './parsers/BaseParser';
export { TypeScriptParser } from './parsers/TypeScriptParser';
export { PythonParser } from './parsers/PythonParser';
export { GoParser } from './parsers/GoParser';
export { RustParser } from './parsers/RustParser';
export { JavaParser } from './parsers/JavaParser';

// Re-export default
export { default } from './OutlineProvider';
