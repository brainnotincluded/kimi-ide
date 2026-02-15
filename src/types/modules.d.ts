// Mock type declarations for missing modules

declare module 'marked' {
    export function marked(text: string, options?: any): string;
    export default marked;
}

declare module 'jsdom' {
    export class JSDOM {
        constructor(html?: string, options?: any);
        window: any;
        document: any;
    }
}

declare module 'turndown' {
    class TurndownService {
        constructor(options?: any);
        turndown(html: string): string;
        addRule(name: string, rule: any): void;
        keep(filter: string | string[] | ((node: any) => boolean)): void;
        remove(filter: string | string[] | ((node: any) => boolean)): void;
        use(plugins: any | any[]): void;
    }
    export = TurndownService;
}

declare module 'sharp' {
    function sharp(input?: any, options?: any): Sharp;
    interface Sharp {
        resize(width?: number, height?: number, options?: any): Sharp;
        toFormat(format: string, options?: any): Sharp;
        toBuffer(): Promise<Buffer>;
        metadata(): Promise<Metadata>;
    }
    interface Metadata {
        width?: number;
        height?: number;
        format?: string;
    }
    export = sharp;
}

declare module 'clean-css' {
    class CleanCSS {
        constructor(options?: any);
        minify(source: string | string[] | { [key: string]: string }): Promise<MinifyOutput>;
    }
    interface MinifyOutput {
        styles: string;
        errors: string[];
        warnings: string[];
        stats?: any;
    }
    export = CleanCSS;
}

declare module 'playwright' {
    export interface Page {
        goto(url: string, options?: any): Promise<any>;
        evaluate(fn: Function, arg?: any): Promise<any>;
        content(): Promise<string>;
        close(): Promise<void>;
        url(): string;
        screenshot(options?: any): Promise<Buffer>;
        setViewportSize(size: { width: number; height: number }): Promise<void>;
    }
    export interface Browser {
        newPage(): Promise<Page>;
        close(): Promise<void>;
        contexts(): BrowserContext[];
    }
    export interface BrowserContext {
        pages(): Page[];
        close(): Promise<void>;
    }
    export interface BrowserType {
        launch(options?: any): Promise<Browser>;
    }
    export const chromium: BrowserType;
    export const firefox: BrowserType;
    export const webkit: BrowserType;
}

declare module 'express' {
    import { Request, Response, NextFunction } from 'express';
    
    export interface Request {
        params: { [key: string]: string };
        query: { [key: string]: string | string[] };
        body: any;
        headers: { [key: string]: string | string[] };
        path: string;
    }
    export interface Response {
        status(code: number): Response;
        json(data: any): Response;
        send(data: any): Response;
        setHeader(name: string, value: string): Response;
        end(): void;
    }
    export interface NextFunction {
        (err?: any): void;
    }
    export interface Application {
        use(path: string, handler: (req: Request, res: Response, next: NextFunction) => void): Application;
        use(handler: (req: Request, res: Response, next: NextFunction) => void): Application;
        get(path: string, handler: (req: Request, res: Response) => void): Application;
        post(path: string, handler: (req: Request, res: Response) => void): Application;
        listen(port: number, callback?: () => void): any;
    }
    export function express(): Application;
    export { Request, Response, NextFunction };
}

declare module 'tar' {
    export function create(options: { gzip?: boolean; file?: string; cwd?: string }, files: string[]): Promise<void>;
    export function extract(options: { file: string; cwd?: string }): Promise<void>;
}

declare module 'sanitize-filename' {
    function sanitizeFilename(input: string, options?: any): string;
    export = sanitizeFilename;
}

declare module '@modelcontextprotocol/sdk/server/index.js' {
    export class Server {
        constructor(info: any, config: any);
        setRequestHandler(method: string, handler: (request: any) => Promise<any>): void;
        setNotificationHandler(method: string, handler: (notification: any) => Promise<void>): void;
        connect(transport: any): Promise<void>;
        close(): Promise<void>;
    }
}

declare module '@modelcontextprotocol/sdk/server/stdio.js' {
    export class StdioServerTransport {
        constructor();
    }
}

declare module '@modelcontextprotocol/sdk/types.js' {
    export const CallToolRequestSchema: any;
    export const ListToolsRequestSchema: any;
    export const ErrorCode: {
        InvalidRequest: string;
        MethodNotFound: string;
        InternalError: string;
    };
    export class McpError extends Error {
        constructor(code: string, message: string);
        code: string;
    }
}

declare module 'zod' {
    export class ZodType<T = any> {
        parse(data: unknown): T;
        safeParse(data: unknown): { success: boolean; data?: T; error?: any };
        optional(): ZodType<T | undefined>;
        nullable(): ZodType<T | null>;
        default(value: T): ZodType<T>;
    }
    export class ZodString extends ZodType<string> {}
    export class ZodNumber extends ZodType<number> {}
    export class ZodBoolean extends ZodType<boolean> {}
    export class ZodObject<T = any> extends ZodType<T> {}
    export class ZodArray<T = any> extends ZodType<T[]> {}
    export class ZodEnum<T extends [string, ...string[]]> extends ZodType<T[number]> {}
    export class ZodUnion<T extends [ZodType, ...ZodType[]]> extends ZodType<any> {}
    export class ZodOptional<T extends ZodType> extends ZodType<T | undefined> {}
    
    export function string(): ZodString;
    export function number(): ZodNumber;
    export function boolean(): ZodBoolean;
    export function object<T extends { [key: string]: ZodType }>(shape: T): ZodObject<{ [K in keyof T]: T[K] extends ZodType<infer V> ? V : never }>;
    export function array<T extends ZodType>(schema: T): ZodArray<T>;
    export function enum_<T extends [string, ...string[]]>(values: T): ZodEnum<T>;
    export function union<T extends [ZodType, ...ZodType[]]>(schemas: T): ZodUnion<T>;
    export function optional<T extends ZodType>(schema: T): ZodOptional<T>;
    export function literal<T extends string | number | boolean>(value: T): ZodType<T>;
}

// DOM types for remix and browser-mcp modules
declare global {
    interface Document {
        querySelector(selectors: string): Element | null;
        querySelectorAll(selectors: string): NodeListOf<Element>;
        createElement(tagName: string): Element;
        documentElement: Element;
        body: Element;
        title: string;
        head: Element;
        getElementById(id: string): Element | null;
        getElementsByTagName(name: string): HTMLCollectionOf<Element>;
        getElementsByClassName(className: string): HTMLCollectionOf<Element>;
        characterSet: string;
    }
    
    interface Element {
        tagName: string;
        className: string;
        id: string;
        textContent: string | null;
        innerHTML: string;
        outerHTML: string;
        style: CSSStyleDeclaration;
        getAttribute(name: string): string | null;
        setAttribute(name: string, value: string): void;
        hasAttribute(name: string): boolean;
        querySelector(selectors: string): Element | null;
        querySelectorAll(selectors: string): NodeListOf<Element>;
        children: HTMLCollectionOf<Element>;
        parentElement: Element | null;
        appendChild<T extends Node>(child: T): T;
        removeChild<T extends Node>(child: T): T;
        getBoundingClientRect(): DOMRect;
        scrollHeight: number;
        scrollBy(x: number, y: number): void;
        width: number;
        height: number;
        lang: string;
        rel: string;
        href: string;
        type: string;
        src: string;
        srcset: string;
        media: string;
        alt: string;
        naturalWidth: number;
        naturalHeight: number;
        poster: string;
        getContext(contextId: string): any;
        dataset: { [key: string]: string };
    }
    
    interface HTMLElement extends Element {
        innerText: string;
        outerText: string;
        click(): void;
    }
    
    interface HTMLAnchorElement extends HTMLElement {
        href: string;
        download: string;
    }
    
    interface HTMLCanvasElement extends HTMLElement {
        width: number;
        height: number;
        getContext(contextId: string): any;
        toDataURL(type?: string): string;
    }
    
    interface HTMLTableElement extends HTMLElement {
        rows: HTMLCollectionOf<HTMLTableRowElement>;
        insertRow(index?: number): HTMLTableRowElement;
    }
    
    interface HTMLTableRowElement extends HTMLElement {
        cells: HTMLCollectionOf<HTMLTableCellElement>;
        insertCell(index?: number): HTMLTableCellElement;
    }
    
    interface HTMLTableCellElement extends HTMLElement {
        colSpan: number;
        rowSpan: number;
    }
    
    interface HTMLImageElement extends HTMLElement {
        src: string;
        alt: string;
        width: number;
        height: number;
        naturalWidth: number;
        naturalHeight: number;
        complete: boolean;
    }
    
    interface HTMLVideoElement extends HTMLElement {
        src: string;
        poster: string;
        width: number;
        height: number;
    }
    
    interface HTMLAudioElement extends HTMLElement {
        src: string;
    }
    
    interface HTMLSourceElement extends HTMLElement {
        src: string;
        type: string;
    }
    
    interface HTMLScriptElement extends HTMLElement {
        src: string;
        type: string;
    }
    
    interface HTMLLinkElement extends HTMLElement {
        href: string;
        rel: string;
        type: string;
        as: string;
        media: string;
    }
    
    interface HTMLLIElement extends HTMLElement {}
    
    interface CSSStyleDeclaration {
        [key: string]: string;
        getPropertyValue(property: string): string;
        setProperty(property: string, value: string): void;
    }
    
    interface DOMRect {
        x: number;
        y: number;
        width: number;
        height: number;
        top: number;
        right: number;
        bottom: number;
        left: number;
    }
    
    interface NodeListOf<T> extends Array<T> {}
    interface HTMLCollectionOf<T> extends Array<T> {}
    
    interface Window {
        location: { href: string };
        getComputedStyle(element: Element): CSSStyleDeclaration;
        scrollTo(x: number, y: number): void;
        scrollBy(x: number, y: number): void;
    }
    
    function getComputedStyle(element: Element): CSSStyleDeclaration;
    const document: Document;
    const window: Window;
    const HTMLCanvasElement: { prototype: HTMLCanvasElement; new(): HTMLCanvasElement };
    const HTMLAnchorElement: { prototype: HTMLAnchorElement; new(): HTMLAnchorElement };
    const HTMLElement: { prototype: HTMLElement; new(): HTMLElement };
}

export {};
