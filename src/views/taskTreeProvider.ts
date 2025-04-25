import * as vscode from "vscode";
import * as path from "path";
import { Task, SubTask } from "../models/task";
import { TaskService } from "../utils/taskService";

/**
 * Tree item representing a task or subtask in the tree view
 * Includes UI properties like labels, icons, and tooltips
 */
export class TaskTreeItem extends vscode.TreeItem {
  /**
   * Creates an instance of TaskTreeItem.
   * @param label The text to display for the tree item.
   * @param collapsibleState Whether the item is collapsed, expanded, or none.
   * @param task The underlying Task or SubTask data.
   * @param isSubtask Flag indicating if this item represents a subtask.
   * @param parentTask The parent Task if this is a subtask.
   */
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly task: Task | SubTask,
    public readonly isSubtask: boolean = false,
    public readonly parentTask?: Task,
  ) {
    super(label, collapsibleState);

    // Set context value for context menu contributions
    this.contextValue = isSubtask ? "subtask" : "task";

    // Set description (shown next to label)
    this.description = isSubtask
      ? (task as SubTask).status
      : `${(task as Task).status} | Priority: ${(task as Task).priority}`;

    // Set tooltip (shown on hover)
    if (!isSubtask) {
      const taskObj = task as Task;
      let tooltip = `ID: ${taskObj.id}\nTitle: ${taskObj.title}\nDescription: ${taskObj.description}\nStatus: ${taskObj.status}\nPriority: ${taskObj.priority}`;

      if (taskObj.complexity) {
        tooltip += `\nComplexity: ${taskObj.complexity.level
          } (${taskObj.complexity.score.toFixed(1)})`;
      }

      if (taskObj.dependencies.length > 0) {
        tooltip += `\nDependencies: ${taskObj.dependencies.join(", ")}`;
      }

      if (taskObj.details) {
        tooltip += `\n\nDetails: ${taskObj.details}`;
      }

      this.tooltip = new vscode.MarkdownString(tooltip);
    } else {
      this.tooltip = `ID: ${(task as SubTask).id}\nTitle: ${(task as SubTask).title
        }\nStatus: ${(task as SubTask).status}`;
    }

    // Add click handler to make both text and icon clickable with same context menu
    this.command = {
      command: "task-pilot.showTaskContextMenu",
      title: "Show Context Menu",
      arguments: [this]
    };

    // Set icon based on status
    const status = task.status;
    let iconName: string;

    switch (status) {
      case "pending":
        iconName = "circle-outline";
        break;
      case "in-progress":
        iconName = "play";
        break;
      case "done":
        iconName = "check";
        break;
      case "deferred":
        iconName = "clock";
        break;
      default:
        iconName = "circle-outline";
    }

    // Use ThemeIcon instead of file paths
    this.iconPath = new vscode.ThemeIcon(iconName);

    // Add complexity badge if available and not a subtask
    const taskObj = task as Task; // Use the existing taskObj if not subtask
    if (!isSubtask && taskObj.complexity) {
      // Check complexity on taskObj
      const complexity = taskObj.complexity; // Assign from taskObj
      let color: vscode.ThemeColor;

      switch (complexity.level) {
        case "simple":
          color = new vscode.ThemeColor("charts.green");
          break;
        case "moderate":
          color = new vscode.ThemeColor("charts.blue");
          break;
        case "complex":
          color = new vscode.ThemeColor("charts.orange");
          break;
        case "veryComplex":
          color = new vscode.ThemeColor("charts.red");
          break;
        default:
          color = new vscode.ThemeColor("charts.foreground");
      }

      this.iconPath = new vscode.ThemeIcon(iconName, color);
    }
  }
}

/**
 * Tree data provider for tasks
 * Manages the data for the tree view and handles updates when task data changes
 */
export class TaskTreeProvider implements vscode.TreeDataProvider<TaskTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TaskTreeItem | undefined | null | void
  > = new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TaskTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private taskService: TaskService;
  private fileSystemWatcher: vscode.FileSystemWatcher | undefined;

  /**
   * Creates an instance of TaskTreeProvider.
   * @param context The extension context used for registering disposables.
   */
  constructor(private context: vscode.ExtensionContext) {
    this.taskService = new TaskService();
    this.setupFileWatcher();
  }

  /**
   * Sets up a file watcher for tasks.json to automatically refresh the
   * tree view when the file is modified externally
   */
  private setupFileWatcher(): void {
    const tasksFilePath = this.taskService.getTasksFilePath();
    const workspaceFolder =
      vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0]
        : undefined;

    if (tasksFilePath && workspaceFolder) {
      // Check both path and folder exist
      try {
        // Create a file system watcher for tasks.json
        this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher(
          new vscode.RelativePattern(
            workspaceFolder, // Use checked workspaceFolder
            path.basename(tasksFilePath), // Use checked tasksFilePath, removed !
          ),
        );

        // Watch for changes and refresh the tree view
        this.fileSystemWatcher.onDidChange(() => this.refresh());
        this.fileSystemWatcher.onDidCreate(() => this.refresh());
        this.fileSystemWatcher.onDidDelete(() => this.refresh());

        // Dispose the watcher when the extension is deactivated
        this.context.subscriptions.push(this.fileSystemWatcher);
      } catch (error) {
        console.error("Failed to set up file watcher:", error);
      }
    }
  }

  /**
   * Refreshes the tree view by firing an event to signal data has changed
   * Called when tasks.json is modified or when tasks are added/updated
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Gets the tree item for a given element
   * Required by the TreeDataProvider interface
   * @param element The tree item to return
   * @returns The tree item provided
   */
  getTreeItem(element: TaskTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Gets the children for a given element
   * If no element is provided, returns the root tasks grouped by status
   * If an element is provided, returns its subtasks
   * @param element The parent element to get children for
   * @returns A promise resolving to an array of child tree items
   */
  getChildren(element?: TaskTreeItem): Thenable<TaskTreeItem[]> {
    if (!this.taskService.tasksFileExists()) {
      vscode.window.showInformationMessage(
        "No tasks found. Please initialize the task manager first.",
      );
      return Promise.resolve([]);
    }

    // If no element is provided, return root-level tasks grouped by status
    if (!element) {
      return this.getRootTasks();
    }

    // If element is a task with subtasks, return its subtasks
    if (!element.isSubtask && (element.task as Task).subtasks.length > 0) {
      return this.getSubtasks(element.task as Task);
    }

    return Promise.resolve([]);
  }

  /**
   * Gets the root-level tasks grouped by status categories
   * Creates header items for each status group and populates them with task items
   * @returns A promise resolving to an array of tree items representing status groups and tasks
   */
  private async getRootTasks(): Promise<TaskTreeItem[]> {
    const tasks = this.taskService.readTasks();
    if (!tasks || tasks.length === 0) {
      return [];
    }

    // Group tasks by status
    const groups: Record<string, Task[]> = {
      "in-progress": [],
      pending: [],
      done: [],
      deferred: [],
    };

    tasks.forEach((task) => {
      if (groups[task.status]) {
        groups[task.status].push(task);
      }
    });

    // Create status group headers and tasks
    const treeItems: TaskTreeItem[] = [];

    // In-progress tasks
    if (groups["in-progress"].length > 0) {
      const inProgressHeader = new TaskTreeItem(
        "In Progress",
        vscode.TreeItemCollapsibleState.Expanded,
        {
          id: -1,
          title: "In Progress",
          description: "",
          status: "in-progress",
          dependencies: [],
          priority: "high",
          subtasks: [],
        },
      );
      inProgressHeader.contextValue = "statusGroup";
      treeItems.push(inProgressHeader);

      groups["in-progress"].forEach((task) => {
        const hasSubtasks = task.subtasks.length > 0;
        treeItems.push(
          new TaskTreeItem(
            `${task.id}: ${task.title}`,
            hasSubtasks
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None,
            task,
          ),
        );
      });
    }

    // Pending tasks
    if (groups["pending"].length > 0) {
      const pendingHeader = new TaskTreeItem(
        "Pending",
        vscode.TreeItemCollapsibleState.Expanded,
        {
          id: -2,
          title: "Pending",
          description: "",
          status: "pending",
          dependencies: [],
          priority: "medium",
          subtasks: [],
        },
      );
      pendingHeader.contextValue = "statusGroup";
      treeItems.push(pendingHeader);

      groups["pending"].forEach((task) => {
        const hasSubtasks = task.subtasks.length > 0;
        treeItems.push(
          new TaskTreeItem(
            `${task.id}: ${task.title}`,
            hasSubtasks
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None,
            task,
          ),
        );
      });
    }

    // Done tasks
    if (groups["done"].length > 0) {
      const doneHeader = new TaskTreeItem(
        "Done",
        vscode.TreeItemCollapsibleState.Collapsed,
        {
          id: -3,
          title: "Done",
          description: "",
          status: "done",
          dependencies: [],
          priority: "low",
          subtasks: [],
        },
      );
      doneHeader.contextValue = "statusGroup";
      treeItems.push(doneHeader);

      groups["done"].forEach((task) => {
        const hasSubtasks = task.subtasks.length > 0;
        treeItems.push(
          new TaskTreeItem(
            `${task.id}: ${task.title}`,
            hasSubtasks
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None,
            task,
          ),
        );
      });
    }

    // Deferred tasks
    if (groups["deferred"].length > 0) {
      const deferredHeader = new TaskTreeItem(
        "Deferred",
        vscode.TreeItemCollapsibleState.Collapsed,
        {
          id: -4,
          title: "Deferred",
          description: "",
          status: "deferred",
          dependencies: [],
          priority: "low",
          subtasks: [],
        },
      );
      deferredHeader.contextValue = "statusGroup";
      treeItems.push(deferredHeader);

      groups["deferred"].forEach((task) => {
        const hasSubtasks = task.subtasks.length > 0;
        treeItems.push(
          new TaskTreeItem(
            `${task.id}: ${task.title}`,
            hasSubtasks
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None,
            task,
          ),
        );
      });
    }

    return treeItems;
  }

  /**
   * Gets the subtasks for a given parent task
   * @param task The parent task whose subtasks should be retrieved
   * @returns A promise resolving to an array of tree items representing subtasks
   */
  private async getSubtasks(task: Task): Promise<TaskTreeItem[]> {
    return task.subtasks.map(
      (subtask) =>
        new TaskTreeItem(
          `${subtask.id}: ${subtask.title}`,
          vscode.TreeItemCollapsibleState.None,
          subtask,
          true,
          task,
        ),
    );
  }
}
