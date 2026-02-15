import * as vscode from 'vscode';
import * as path from 'path';
import { CppLanguageProvider, CMakeInfo, CMakeTarget } from './CppLanguageProvider';

/**
 * Tree item types for CMake panel
 */
type CMakeTreeItemType = 
    | 'root'
    | 'project'
    | 'targets-header'
    | 'target'
    | 'source-header'
    | 'source-file'
    | 'build-header'
    | 'action';

/**
 * Tree item for CMake explorer
 */
class CMakeTreeItem extends vscode.TreeItem {
    constructor(
        public readonly type: CMakeTreeItemType,
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly data?: any
    ) {
        super(label, collapsibleState);
        this.setIconAndCommand();
    }

    private setIconAndCommand(): void {
        switch (this.type) {
            case 'root':
                this.iconPath = new vscode.ThemeIcon('folder');
                break;
            case 'project':
                this.iconPath = new vscode.ThemeIcon('project');
                this.tooltip = `CMake Project: ${this.label}`;
                break;
            case 'targets-header':
                this.iconPath = new vscode.ThemeIcon('list-unordered');
                break;
            case 'target':
                this.setTargetIcon();
                this.contextValue = 'cmakeTarget';
                this.command = {
                    command: 'cpp.selectTarget',
                    title: 'Select Target',
                    arguments: [this.data as CMakeTarget]
                };
                break;
            case 'source-header':
                this.iconPath = new vscode.ThemeIcon('file-code');
                break;
            case 'source-file':
                this.iconPath = new vscode.ThemeIcon('file');
                this.resourceUri = vscode.Uri.file(this.data as string);
                this.command = {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [this.resourceUri]
                };
                break;
            case 'build-header':
                this.iconPath = new vscode.ThemeIcon('tools');
                break;
            case 'action':
                this.setActionIcon();
                break;
        }
    }

    private setTargetIcon(): void {
        const target = this.data as CMakeTarget;
        switch (target.type) {
            case 'EXECUTABLE':
                this.iconPath = new vscode.ThemeIcon('run');
                break;
            case 'STATIC_LIBRARY':
                this.iconPath = new vscode.ThemeIcon('library');
                break;
            case 'SHARED_LIBRARY':
                this.iconPath = new vscode.ThemeIcon('package');
                break;
            case 'OBJECT_LIBRARY':
                this.iconPath = new vscode.ThemeIcon('archive');
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('symbol-misc');
        }
        this.description = target.type.toLowerCase().replace('_', ' ');
    }

    private setActionIcon(): void {
        const actionType = this.data?.action;
        switch (actionType) {
            case 'configure':
                this.iconPath = new vscode.ThemeIcon('gear');
                this.command = { command: 'cpp.configureCMake', title: 'Configure' };
                break;
            case 'build':
                this.iconPath = new vscode.ThemeIcon('play');
                this.command = { command: 'cpp.build', title: 'Build' };
                break;
            case 'clean':
                this.iconPath = new vscode.ThemeIcon('trash');
                this.command = { command: 'cpp.clean', title: 'Clean' };
                break;
            case 'clean-reconfigure':
                this.iconPath = new vscode.ThemeIcon('refresh');
                this.command = { command: 'cpp.cleanReconfigure', title: 'Clean Reconfigure' };
                break;
        }
    }
}

/**
 * CMake Panel Tree Data Provider
 */
export class CMakePanel implements vscode.TreeDataProvider<CMakeTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CMakeTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<CMakeTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CMakeTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private provider: CppLanguageProvider;
    private cmakeInfo: CMakeInfo | null = null;
    private selectedTarget: CMakeTarget | null = null;
    private isConfiguring: boolean = false;
    private isBuilding: boolean = false;

    constructor(provider: CppLanguageProvider) {
        this.provider = provider;
        this.refresh();
    }

    /**
     * Refresh the CMake panel
     */
    async refresh(): Promise<void> {
        this.cmakeInfo = await this.provider.getCMakeInfo();
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get tree item
     */
    getTreeItem(element: CMakeTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children of a tree item
     */
    async getChildren(element?: CMakeTreeItem): Promise<CMakeTreeItem[]> {
        if (!element) {
            return this.getRootItems();
        }

        switch (element.type) {
            case 'root':
                return this.getProjectItems();
            case 'project':
                return this.getProjectDetailItems();
            case 'targets-header':
                return this.getTargetItems();
            case 'target':
                return this.getSourceItems(element.data as CMakeTarget);
            case 'build-header':
                return this.getBuildActionItems();
            default:
                return [];
        }
    }

    private getRootItems(): CMakeTreeItem[] {
        if (!this.cmakeInfo?.hasCMake) {
            return [
                new CMakeTreeItem(
                    'action',
                    'No CMakeLists.txt found',
                    vscode.TreeItemCollapsibleState.None,
                    { action: 'create' }
                ),
                new CMakeTreeItem(
                    'action',
                    'Refresh',
                    vscode.TreeItemCollapsibleState.None,
                    { action: 'refresh' }
                )
            ];
        }

        return [
            new CMakeTreeItem(
                'project',
                this.cmakeInfo.projectName || 'CMake Project',
                vscode.TreeItemCollapsibleState.Expanded,
                this.cmakeInfo
            )
        ];
    }

    private getProjectItems(): CMakeTreeItem[] {
        if (!this.cmakeInfo) return [];

        const items: CMakeTreeItem[] = [];

        // Version info
        if (this.cmakeInfo.version) {
            items.push(new CMakeTreeItem(
                'project',
                `Version: ${this.cmakeInfo.version}`,
                vscode.TreeItemCollapsibleState.None
            ));
        }

        // Build directory
        items.push(new CMakeTreeItem(
            'project',
            `Build: ${this.cmakeInfo.buildDirectory}`,
            vscode.TreeItemCollapsibleState.None
        ));

        return items;
    }

    private getProjectDetailItems(): CMakeTreeItem[] {
        if (!this.cmakeInfo) return [];

        const items: CMakeTreeItem[] = [];

        // Targets section
        if (this.cmakeInfo.targets.length > 0) {
            items.push(new CMakeTreeItem(
                'targets-header',
                `Targets (${this.cmakeInfo.targets.length})`,
                vscode.TreeItemCollapsibleState.Expanded
            ));
        }

        // Build actions section
        items.push(new CMakeTreeItem(
            'build-header',
            'Build Actions',
            vscode.TreeItemCollapsibleState.Expanded
        ));

        return items;
    }

    private getTargetItems(): CMakeTreeItem[] {
        if (!this.cmakeInfo?.targets) return [];

        return this.cmakeInfo.targets.map(target => {
            const isSelected = this.selectedTarget?.name === target.name;
            const item = new CMakeTreeItem(
                'target',
                target.name + (isSelected ? ' ✓' : ''),
                vscode.TreeItemCollapsibleState.Collapsed,
                target
            );
            if (isSelected) {
                item.description = `${item.description} (selected)`;
            }
            return item;
        });
    }

    private getSourceItems(target: CMakeTarget): CMakeTreeItem[] {
        if (!target.sourceFiles || target.sourceFiles.length === 0) {
            return [
                new CMakeTreeItem(
                    'source-file',
                    'No sources (glob or variable used)',
                    vscode.TreeItemCollapsibleState.None
                )
            ];
        }

        return target.sourceFiles.map(file => 
            new CMakeTreeItem(
                'source-file',
                path.basename(file),
                vscode.TreeItemCollapsibleState.None,
                file
            )
        );
    }

    private getBuildActionItems(): CMakeTreeItem[] {
        const items: CMakeTreeItem[] = [];

        // Configure
        items.push(new CMakeTreeItem(
            'action',
            this.isConfiguring ? 'Configure (in progress...)' : 'Configure',
            vscode.TreeItemCollapsibleState.None,
            { action: 'configure' }
        ));

        // Build
        const buildLabel = this.isBuilding 
            ? `Build${this.selectedTarget ? ` ${this.selectedTarget.name}` : ''} (in progress...)`
            : `Build${this.selectedTarget ? ` ${this.selectedTarget.name}` : ' All'}`;
        
        items.push(new CMakeTreeItem(
            'action',
            buildLabel,
            vscode.TreeItemCollapsibleState.None,
            { action: 'build' }
        ));

        // Clean
        items.push(new CMakeTreeItem(
            'action',
            'Clean',
            vscode.TreeItemCollapsibleState.None,
            { action: 'clean' }
        ));

        // Clean Reconfigure
        items.push(new CMakeTreeItem(
            'action',
            'Clean Reconfigure',
            vscode.TreeItemCollapsibleState.None,
            { action: 'clean-reconfigure' }
        ));

        return items;
    }

    /**
     * Select a target for building
     */
    selectTarget(target: CMakeTarget): void {
        this.selectedTarget = target;
        vscode.window.showInformationMessage(`Selected target: ${target.name}`);
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get the currently selected target
     */
    getSelectedTarget(): CMakeTarget | null {
        return this.selectedTarget;
    }

    /**
     * Set configuring status
     */
    setConfiguring(configuring: boolean): void {
        this.isConfiguring = configuring;
        this._onDidChangeTreeData.fire();
    }

    /**
     * Set building status
     */
    setBuilding(building: boolean): void {
        this.isBuilding = building;
        this._onDidChangeTreeData.fire();
    }

    /**
     * Configure CMake
     */
    async configure(): Promise<void> {
        this.setConfiguring(true);
        try {
            await this.provider.configureCMake();
            await this.refresh();
        } finally {
            this.setConfiguring(false);
        }
    }

    /**
     * Build selected or all targets
     */
    async build(): Promise<void> {
        this.setBuilding(true);
        try {
            await this.provider.runCMake(this.selectedTarget?.name);
        } finally {
            this.setBuilding(false);
        }
    }

    /**
     * Clean build directory
     */
    async clean(): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return;

        const buildDir = path.join(workspaceRoot, this.cmakeInfo?.buildDirectory || 'build');
        
        const terminal = vscode.window.createTerminal('CMake Clean');
        terminal.show();
        terminal.sendText(`rm -rf "${buildDir}"/*`);
        
        vscode.window.showInformationMessage('Build directory cleaned');
        await this.refresh();
    }

    /**
     * Clean and reconfigure
     */
    async cleanReconfigure(): Promise<void> {
        await this.clean();
        await this.configure();
    }
}

/**
 * CMake Panel Manager - handles UI and commands
 */
export class CMakePanelManager {
    private treeView: vscode.TreeView<CMakeTreeItem>;
    private panel: CMakePanel;
    private provider: CppLanguageProvider;
    private disposables: vscode.Disposable[] = [];

    constructor(provider: CppLanguageProvider, context: vscode.ExtensionContext) {
        this.provider = provider;
        this.panel = new CMakePanel(provider);

        // Register tree view
        this.treeView = vscode.window.createTreeView('cmakePanel', {
            treeDataProvider: this.panel,
            showCollapseAll: true
        });

        context.subscriptions.push(this.treeView);
        context.subscriptions.push(this.panel);

        this.registerCommands(context);
    }

    private registerCommands(context: vscode.ExtensionContext): void {
        // Select target
        const selectTargetCmd = vscode.commands.registerCommand(
            'cpp.selectTarget',
            (target: CMakeTarget) => {
                this.panel.selectTarget(target);
            }
        );

        // Configure CMake
        const configureCmd = vscode.commands.registerCommand(
            'cpp.configureCMake',
            () => this.panel.configure()
        );

        // Build
        const buildCmd = vscode.commands.registerCommand(
            'cpp.build',
            () => this.panel.build()
        );

        // Clean
        const cleanCmd = vscode.commands.registerCommand(
            'cpp.clean',
            () => this.panel.clean()
        );

        // Clean Reconfigure
        const cleanReconfigureCmd = vscode.commands.registerCommand(
            'cpp.cleanReconfigure',
            () => this.panel.cleanReconfigure()
        );

        // Refresh
        const refreshCmd = vscode.commands.registerCommand(
            'cpp.refreshCMakePanel',
            () => this.panel.refresh()
        );

        // Build specific target
        const buildTargetCmd = vscode.commands.registerCommand(
            'cpp.buildTarget',
            async () => {
                const cmakeInfo = await this.provider.getCMakeInfo();
                if (!cmakeInfo?.targets.length) {
                    vscode.window.showWarningMessage('No CMake targets found');
                    return;
                }

                const target = await vscode.window.showQuickPick(
                    cmakeInfo.targets.map(t => ({
                        label: t.name,
                        description: t.type,
                        target: t
                    })),
                    { placeHolder: 'Select target to build' }
                );

                if (target) {
                    this.panel.setBuilding(true);
                    try {
                        await this.provider.runCMake(target.target.name);
                    } finally {
                        this.panel.setBuilding(false);
                    }
                }
            }
        );

        context.subscriptions.push(
            selectTargetCmd,
            configureCmd,
            buildCmd,
            cleanCmd,
            cleanReconfigureCmd,
            refreshCmd,
            buildTargetCmd
        );
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.treeView.dispose();
    }
}
