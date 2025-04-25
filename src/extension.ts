import * as vscode from "vscode";
import { registerComplexityCommands } from "./commands/complexityCommands";
import { registerTaskCommands } from "./commands/taskCommands";
import { registerAICommands } from "./commands/aiCommands";
import { TaskService } from "./utils/taskService";
import { TaskTreeProvider } from "./views/taskTreeProvider";

export function activate(context: vscode.ExtensionContext) {
  console.log("TaskPilot is now active!");

  // Create tree data provider
  const taskTreeProvider = new TaskTreeProvider(context);

  // Register tree view
  const treeView = vscode.window.createTreeView("taskPilotTasks", {
    treeDataProvider: taskTreeProvider,
    showCollapseAll: true,
  });

  // Register commands
  registerComplexityCommands(context, taskTreeProvider);
  registerTaskCommands(context, taskTreeProvider);
  registerAICommands(context, taskTreeProvider);

  // Add refresh command
  const refreshCommand = vscode.commands.registerCommand(
    "task-pilot.refreshTree",
    () => {
      taskTreeProvider.refresh();
    },
  );

  // Register our custom command to initialize tasks.json
  const initCommand = vscode.commands.registerCommand(
    "task-pilot.init",
    async () => {
      const taskService = new TaskService();

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
        taskTreeProvider.refresh();
      } else {
        vscode.window.showErrorMessage("Failed to initialize tasks.json");
      }
    },
  );

  // Add view to context
  context.subscriptions.push(treeView, refreshCommand, initCommand);
}

export function deactivate() {
  console.log("TaskPilot is now deactivated!");
}
