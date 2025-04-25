import * as vscode from "vscode";
import { TaskService } from "../utils/taskService";
import { CopilotComplexityService } from "../utils/copilotComplexityAssessment";
import { TaskTreeProvider } from "../views/taskTreeProvider";

/**
 * Register complexity assessment related commands.
 * @param context The extension context.
 * @param treeProvider Optional TaskTreeProvider instance to refresh the view after updates.
 */
export function registerComplexityCommands(
  context: vscode.ExtensionContext,
  treeProvider?: TaskTreeProvider,
): void {
  const taskService = new TaskService();

  /**
   * Command handler to assess the complexity of a specific task using Copilot.
   * If no task is provided via the tree view, prompts the user to select one.
   */
  const assessTaskComplexityCommand = vscode.commands.registerCommand(
    "task-pilot.assessTaskComplexity",
    async (taskItem) => {
      // Get task from tree item or prompt user to select one
      let task;

      if (taskItem && taskItem.task && !taskItem.isSubtask) {
        task = taskItem.task;
      } else {
        // Get all tasks
        const tasks = taskService.readTasks();
        if (!tasks || tasks.length === 0) {
          vscode.window.showErrorMessage(
            "No tasks found. Create some tasks first.",
          );
          return;
        }

        // Show quick pick with task list
        const taskItems = tasks.map((task) => ({
          label: `Task ${task.id}: ${task.title}`,
          description: task.status,
          detail: task.description,
          task,
        }));

        const selectedTaskItem = await vscode.window.showQuickPick(taskItems, {
          placeHolder: "Select a task to assess its complexity",
        });

        if (!selectedTaskItem) {
          return;
        }

        task = selectedTaskItem.task;
      }

      // Request Copilot complexity assessment using the Language Model API
      const complexityScore =
        await CopilotComplexityService.assessTaskComplexity(task);

      if (complexityScore) {
        // Update the task with the complexity score
        const updatedTask = {
          ...task,
          complexity: complexityScore,
        };

        const success = taskService.updateTask(updatedTask);

        if (success) {
          vscode.window.showInformationMessage(
            `Successfully updated complexity for task ${updatedTask.id}: ${complexityScore.level} (${complexityScore.score})`,
          );
          if (treeProvider) {
            treeProvider.refresh();
          }
        } else {
          vscode.window.showErrorMessage(
            `Failed to update complexity for task ${updatedTask.id}`,
          );
        }
      }
    },
  );

  /**
   * Command handler to assess the complexity of all tasks using the local assessment logic.
   * Note: This currently uses the local `taskService.updateAllTasksComplexity`
   * which does *not* call the Copilot API for each task due to potential cost/rate limits.
   * It uses the simpler rule-based assessment from `complexityAssessment.ts`.
   */
  const assessAllTasksComplexityCommand = vscode.commands.registerCommand(
    "task-pilot.assessAllTasksComplexity",
    async () => {
      const success = taskService.updateAllTasksComplexity();

      if (success) {
        vscode.window.showInformationMessage(
          "Successfully updated complexity for all tasks.",
        );
        if (treeProvider) {
          treeProvider.refresh();
        }
      } else {
        vscode.window.showErrorMessage(
          "Failed to update complexity for all tasks.",
        );
      }
    },
  );

  /**
   * Command handler to manually update the complexity level and score for a specific task.
   * If no task is provided via the tree view, prompts the user to select one.
   * Prompts the user for the new complexity level and score.
   */
  const updateTaskComplexityCommand = vscode.commands.registerCommand(
    "task-pilot.updateTaskComplexity",
    async (taskItem) => {
      // Get task from tree item or prompt user to select one
      let task;

      if (taskItem && taskItem.task && !taskItem.isSubtask) {
        task = taskItem.task;
      } else {
        // Get all tasks
        const tasks = taskService.readTasks();
        if (!tasks || tasks.length === 0) {
          vscode.window.showErrorMessage(
            "No tasks found. Create some tasks first.",
          );
          return;
        }

        // Show quick pick with task list
        const taskItems = tasks.map((task) => ({
          label: `Task ${task.id}: ${task.title}`,
          description: task.status,
          detail: `Complexity: ${task.complexity?.level || "Not assessed"}`,
          task,
        }));

        const selectedTaskItem = await vscode.window.showQuickPick(taskItems, {
          placeHolder: "Select a task to update its complexity",
        });

        if (!selectedTaskItem) {
          return;
        }

        task = selectedTaskItem.task;
      }

      // Get complexity level
      const complexityLevels = ["simple", "moderate", "complex", "veryComplex"];
      const selectedLevel = await vscode.window.showQuickPick(
        complexityLevels,
        {
          placeHolder: "Select complexity level",
        },
      );

      if (!selectedLevel) {
        return;
      }

      // Get complexity score
      const scoreInput = await vscode.window.showInputBox({
        prompt: "Enter complexity score (1-5)",
        validateInput: (value) => {
          const num = Number(value);
          if (isNaN(num) || num < 1 || num > 5) {
            return "Please enter a number between 1 and 5";
          }
          return null;
        },
      });

      if (!scoreInput) {
        return;
      }

      // Update task
      const updatedTask = {
        ...task,
        complexity: {
          level:
            selectedLevel as keyof typeof import("../models/task").ComplexityLevel, // Use specific type assertion
          score: Number(scoreInput),
          factors: task.complexity?.factors || [],
        },
      };

      const success = taskService.updateTask(updatedTask);

      if (success) {
        vscode.window.showInformationMessage(
          `Successfully updated complexity for task ${updatedTask.id}.`,
        );
        if (treeProvider) {
          treeProvider.refresh();
        }
      } else {
        vscode.window.showErrorMessage(
          `Failed to update complexity for task ${updatedTask.id}.`,
        );
      }
    },
  );

  // Add commands to subscription
  context.subscriptions.push(
    assessTaskComplexityCommand,
    assessAllTasksComplexityCommand,
    updateTaskComplexityCommand,
  );
}
