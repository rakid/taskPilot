import * as vscode from "vscode";
import { Task } from "../models/task"; // Removed unused SubTask import
import { TaskService } from "../utils/taskService";
import { TaskTreeProvider } from "../views/taskTreeProvider";

/**
 * Register task management commands.
 * @param context The extension context.
 * @param treeProvider The task tree data provider.
 */
export function registerTaskCommands(
  context: vscode.ExtensionContext,
  treeProvider: TaskTreeProvider,
): void {
  const taskService = new TaskService();

  /**
   * Command handler to show the context menu for a task when clicked
   * This allows the same context menu to appear whether clicking on text or the icon
   */
  const showTaskContextMenuCommand = vscode.commands.registerCommand(
    "task-pilot.showTaskContextMenu",
    async (taskItem) => {
      if (!taskItem) {
        return;
      }

      // Create a selection of commands to show
      const items = [
        {
          label: "$(pencil) Set Status",
          description: "Change the status of this task",
          command: "task-pilot.setTaskStatus",
        },
        {
          label: "$(list-unordered) Expand Task",
          description: "Break down into subtasks",
          command: "task-pilot.expandTask",
        },
        {
          label: "$(references) Manage Dependencies",
          description: "Set task dependencies",
          command: "task-pilot.manageDependencies",
        },
        {
          label: "$(graph) Assess Complexity",
          description: "Evaluate task complexity",
          command: "task-pilot.assessTaskComplexity",
        },
        {
          label: "$(info) Show Details",
          description: "View detailed information",
          command: "task-pilot.showTaskDetails",
        },
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `Task ${taskItem.task.id}: ${taskItem.task.title}`,
      });

      if (selected) {
        vscode.commands.executeCommand(selected.command, taskItem);
      }
    },
  );

  /**
   * Command handler to initialize the tasks.json file.
   * Prompts the user if the file already exists.
   */
  const initCommand = vscode.commands.registerCommand(
    "task-pilot.init",
    async () => {
      vscode.window.showInformationMessage("Initializing TaskPilot...");

      // Check if tasks.json already exists
      if (taskService.tasksFileExists()) {
        const overwrite = await vscode.window.showWarningMessage(
          "tasks.json already exists. Overwrite it?",
          { modal: true },
          "Yes",
          "No",
        );

        if (overwrite !== "Yes") {
          return;
        }
      }

      // Create empty tasks.json
      const success = taskService.initTasksFile();

      if (success) {
        vscode.window.showInformationMessage(
          "Successfully initialized tasks.json",
        );
        treeProvider.refresh();
      } else {
        vscode.window.showErrorMessage("Failed to initialize tasks.json");
      }
    },
  );

  /**
   * Command handler to manually add a new task.
   * Prompts the user for title, description, priority, and dependencies.
   */
  const addTaskCommand = vscode.commands.registerCommand(
    "task-pilot.addTask",
    async () => {
      // Get task title
      const title = await vscode.window.showInputBox({
        prompt: "Enter task title",
        placeHolder: "Task title",
        validateInput: (value) => {
          if (!value.trim()) {
            return "Title is required";
          }
          return null;
        },
      });

      if (!title) {
        return;
      }

      // Get task description
      const description = await vscode.window.showInputBox({
        prompt: "Enter task description",
        placeHolder: "Task description",
        validateInput: (value) => {
          if (!value.trim()) {
            return "Description is required";
          }
          return null;
        },
      });

      if (!description) {
        return;
      }

      // Get task priority
      const priority = (await vscode.window.showQuickPick(
        ["low", "medium", "high"],
        {
          placeHolder: "Select task priority",
          canPickMany: false,
        },
      )) as "low" | "medium" | "high" | undefined;

      if (!priority) {
        return;
      }

      // Get existing tasks for dependencies
      const tasks = taskService.readTasks() || [];

      // Get dependencies
      const dependencyItems = tasks.map((task) => ({
        label: `Task ${task.id}: ${task.title}`,
        description: task.status,
        task,
      }));

      const selectedDependencies = await vscode.window.showQuickPick(
        dependencyItems,
        {
          placeHolder: "Select dependencies (optional)",
          canPickMany: true,
        },
      );

      const dependencies = selectedDependencies
        ? selectedDependencies.map((item) => item.task.id)
        : [];

      // Create new task
      const newTask: Omit<Task, "id" | "complexity"> = {
        title,
        description,
        status: "pending",
        priority,
        dependencies,
        subtasks: [],
      };

      // Check if tasks.json exists before adding
      if (!taskService.tasksFileExists()) {
        vscode.window.showErrorMessage(
          "Please run the TaskPilot: Initialize command first",
        );
        return;
      }

      const addedTask = taskService.addTask(newTask);

      if (addedTask) {
        vscode.window.showInformationMessage(
          `Successfully added task: ${title}`,
        );
        treeProvider.refresh();
      } else {
        // Keep the original error for other potential save failures
        vscode.window.showErrorMessage(`Failed to add task: ${title}`);
      }
    },
  );

  /**
   * Command handler to set the status of a task.
   * If invoked from the tree view context menu, uses the selected task.
   * Otherwise, prompts the user to select a task.
   * @param taskItem The TaskTreeItem from the context menu (optional).
   */
  const setTaskStatusCommand = vscode.commands.registerCommand(
    "task-pilot.setTaskStatus",
    async (taskItem) => {
      // Get task from tree item or prompt user to select one
      let task: Task | undefined;

      if (taskItem && taskItem.task && !taskItem.isSubtask) {
        task = taskItem.task as Task;
      } else {
        const tasks = taskService.readTasks() || [];

        if (tasks.length === 0) {
          vscode.window.showErrorMessage("No tasks found");
          return;
        }

        const taskItems = tasks.map((t) => ({
          label: `Task ${t.id}: ${t.title}`,
          description: t.status,
          task: t,
        }));

        const selectedTaskItem = await vscode.window.showQuickPick(taskItems, {
          placeHolder: "Select a task to update its status",
          canPickMany: false,
        });

        if (!selectedTaskItem) {
          return;
        }

        task = selectedTaskItem.task;
      }

      // Get new status
      const statusOptions = ["pending", "in-progress", "done", "deferred"];
      const newStatus = (await vscode.window.showQuickPick(statusOptions, {
        placeHolder: `Current status: ${task.status}`,
        canPickMany: false,
      })) as Task["status"] | undefined;

      if (!newStatus || newStatus === task.status) {
        return;
      }

      // Update all subtasks as well?
      let updateSubtasks = false;

      if (newStatus === "done" && task.subtasks.length > 0) {
        const response = await vscode.window.showQuickPick(["Yes", "No"], {
          placeHolder: "Also mark all subtasks as done?",
          canPickMany: false,
        });

        updateSubtasks = response === "Yes";
      }

      // Update task status
      const updatedTask: Task = {
        ...task,
        status: newStatus,
      };

      if (updateSubtasks) {
        updatedTask.subtasks = task.subtasks.map((subtask) => ({
          ...subtask,
          status: "done",
        }));
      }

      const success = taskService.updateTask(updatedTask);

      if (success) {
        vscode.window.showInformationMessage(
          `Status updated: Task ${task.id} is now ${newStatus}`,
        );
        treeProvider.refresh();
      } else {
        vscode.window.showErrorMessage(
          `Failed to update status for task ${task.id}`,
        );
      }
    },
  );

  /**
   * Command handler to manage the dependencies of a task.
   * If invoked from the tree view context menu, uses the selected task.
   * Otherwise, prompts the user to select a task.
   * Allows selecting/deselecting other tasks as dependencies.
   * @param taskItem The TaskTreeItem from the context menu (optional).
   */
  const manageDependenciesCommand = vscode.commands.registerCommand(
    "task-pilot.manageDependencies",
    async (taskItem) => {
      // Get task from tree item or prompt user to select one
      let task: Task | undefined;

      if (taskItem && taskItem.task && !taskItem.isSubtask) {
        task = taskItem.task as Task;
      } else {
        const tasks = taskService.readTasks() || [];

        if (tasks.length === 0) {
          vscode.window.showErrorMessage("No tasks found");
          return;
        }

        const taskItems = tasks.map((t) => ({
          label: `Task ${t.id}: ${t.title}`,
          description: t.status,
          task: t,
        }));

        const selectedTaskItem = await vscode.window.showQuickPick(taskItems, {
          placeHolder: "Select a task to manage dependencies",
          canPickMany: false,
        });

        if (!selectedTaskItem) {
          return;
        }

        task = selectedTaskItem.task;
      }

      // Ensure task is defined before proceeding
      if (!task) {
        // Should theoretically not happen due to checks above, but good for type safety
        vscode.window.showErrorMessage(
          "Could not determine the task to manage dependencies for.",
        );
        return;
      }

      // Get all other tasks
      const allTasks = taskService.readTasks() || [];
      const otherTasks = allTasks.filter((t) => t.id !== task.id); // Removed !

      if (otherTasks.length === 0) {
        vscode.window.showInformationMessage(
          "No other tasks found to set as dependencies",
        );
        return;
      }

      // Create items for quick pick
      const dependencyItems = otherTasks.map((t) => {
        const isDependent = task.dependencies.includes(t.id); // Removed !
        return {
          label: `Task ${t.id}: ${t.title}`,
          description: t.status,
          picked: isDependent,
          task: t,
        };
      });

      // Show quick pick with current dependencies pre-selected
      const selectedDependencies = await vscode.window.showQuickPick(
        dependencyItems,
        {
          placeHolder: "Select dependencies for this task",
          canPickMany: true,
        },
      );

      if (!selectedDependencies) {
        return;
      }

      // Update task dependencies
      const updatedTask: Task = {
        ...task, // Removed !
        dependencies: selectedDependencies.map((item) => item.task.id),
      };

      const success = taskService.updateTask(updatedTask);

      if (success) {
        vscode.window.showInformationMessage(
          `Dependencies updated for task ${task.id}`, // Removed !
        );
        treeProvider.refresh();
      } else {
        vscode.window.showErrorMessage(
          `Failed to update dependencies for task ${task.id}`, // Removed !
        );
      }
    },
  );

  /**
   * Command handler to find and suggest the next available task.
   * Filters tasks that are 'pending' or 'in-progress' and whose dependencies are 'done'.
   * Sorts available tasks by status (in-progress first), priority, and complexity.
   * Shows the suggested task and offers actions like setting it to 'in-progress' or showing details.
   */
  const nextTaskCommand = vscode.commands.registerCommand(
    "task-pilot.nextTask",
    async () => {
      const tasks = taskService.readTasks() || [];

      if (tasks.length === 0) {
        vscode.window.showErrorMessage("No tasks found");
        return;
      }

      // Find tasks with status pending or in-progress
      const availableTasks = tasks.filter(
        (task) =>
          (task.status === "pending" || task.status === "in-progress") &&
          // Check that all dependencies are done
          task.dependencies.every((depId) => {
            const depTask = tasks.find((t) => t.id === depId);
            return depTask && depTask.status === "done";
          }),
      );

      if (availableTasks.length === 0) {
        vscode.window.showInformationMessage(
          "No available tasks found. All tasks are either completed, deferred, or blocked by dependencies.",
        );
        return;
      }

      // Sort by priority, then by complexity if available
      const sortedTasks = [...availableTasks].sort((a, b) => {
        // First compare by status (in-progress before pending)
        if (a.status !== b.status) {
          return a.status === "in-progress" ? -1 : 1;
        }

        // Then by priority (high > medium > low)
        const priorityOrder: Record<string, number> = {
          high: 3,
          medium: 2,
          low: 1,
        };
        if (a.priority !== b.priority) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }

        // Then by complexity if available (lower complexity first)
        if (a.complexity && b.complexity) {
          return a.complexity.score - b.complexity.score;
        }

        return a.id - b.id;
      });

      // Get the next task
      const nextTask = sortedTasks[0];

      // Show the next task
      const result = await vscode.window.showInformationMessage(
        `Next task: ${nextTask.id}: ${nextTask.title} (${nextTask.status}, ${nextTask.priority})`,
        "Set In Progress",
        "Show Details",
      );

      if (result === "Set In Progress" && nextTask.status !== "in-progress") {
        // Update status to in-progress
        const updatedTask: Task = {
          ...nextTask,
          status: "in-progress",
        };

        const success = taskService.updateTask(updatedTask);

        if (success) {
          vscode.window.showInformationMessage(
            `Task ${nextTask.id} set to in-progress`,
          );
          treeProvider.refresh();
        } else {
          vscode.window.showErrorMessage(
            `Failed to update status for task ${nextTask.id}`,
          );
        }
      } else if (result === "Show Details") {
        // Show task details
        const details = `
# Task ${nextTask.id}: ${nextTask.title}

**Status:** ${nextTask.status}
**Priority:** ${nextTask.priority}
${
  nextTask.complexity
    ? `**Complexity:** ${
        nextTask.complexity.level
      } (${nextTask.complexity.score.toFixed(1)})`
    : ""
}

## Description
${nextTask.description}

${nextTask.details ? `## Details\n${nextTask.details}` : ""}

${
  nextTask.dependencies.length > 0
    ? `## Dependencies\n${nextTask.dependencies.join(", ")}`
    : ""
}

${
  nextTask.subtasks.length > 0
    ? `## Subtasks\n${nextTask.subtasks
        .map((sub) => `- ${sub.id}: ${sub.title} (${sub.status})`)
        .join("\n")}`
    : ""
}
`;

        const doc = await vscode.workspace.openTextDocument({
          content: details,
          language: "markdown",
        });

        await vscode.window.showTextDocument(doc);
      }
    },
  );

  /**
   * Command handler to show the details of a task in a new editor tab.
   * If invoked from the tree view context menu, uses the selected task.
   * Otherwise, prompts the user to select a task.
   * Formats the task details into a markdown string.
   * @param taskItem The TaskTreeItem from the context menu (optional).
   */
  const showTaskDetailsCommand = vscode.commands.registerCommand(
    "task-pilot.showTaskDetails",
    async (taskItem) => {
      // Get task from tree item or prompt user to select one
      let task: Task | undefined;

      if (taskItem && taskItem.task && !taskItem.isSubtask) {
        task = taskItem.task as Task;
      } else {
        const tasks = taskService.readTasks() || [];

        if (tasks.length === 0) {
          vscode.window.showErrorMessage("No tasks found");
          return;
        }

        const taskItems = tasks.map((t) => ({
          label: `Task ${t.id}: ${t.title}`,
          description: t.status,
          task: t,
        }));

        const selectedTaskItem = await vscode.window.showQuickPick(taskItems, {
          placeHolder: "Select a task to show details",
          canPickMany: false,
        });

        if (!selectedTaskItem) {
          return;
        }

        task = selectedTaskItem.task;
      }

      // Format details string (similar to nextTask)
      const details = `
# Task ${task.id}: ${task.title}
 
**Status:** ${task.status}
**Priority:** ${task.priority}
${
  task.complexity
    ? `**Complexity:** ${
        task.complexity.level
      } (${task.complexity.score.toFixed(1)})`
    : ""
}
 
## Description
${task.description}
 
${task.details ? `## Details\n${task.details}` : ""}
 
${
  task.dependencies.length > 0
    ? `## Dependencies\n${task.dependencies.join(", ")}`
    : ""
}
 
${
  task.subtasks.length > 0
    ? `## Subtasks\n${task.subtasks
        .map((sub) => `- ${sub.id}: ${sub.title} (${sub.status})`)
        .join("\n")}`
    : ""
}
`;

      // Open details in a new markdown document
      try {
        const doc = await vscode.workspace.openTextDocument({
          content: details,
          language: "markdown",
        });
        await vscode.window.showTextDocument(doc, { preview: true }); // Open as preview
      } catch (error) {
        vscode.window.showErrorMessage("Failed to open task details document.");
        console.error("Error showing task details:", error);
      }
    },
  );

  // Register all commands
  context.subscriptions.push(
    showTaskContextMenuCommand,
    initCommand,
    addTaskCommand,
    setTaskStatusCommand,
    manageDependenciesCommand,
    nextTaskCommand,
    showTaskDetailsCommand,
  );
}
