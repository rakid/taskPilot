import * as vscode from "vscode";
import * as path from "path";
import { Task, SubTask } from "../models/task";
import { TaskService } from "../utils/taskService";
import { TaskTreeProvider } from "../views/taskTreeProvider";

/**
 * Register AI integration commands.
 * @param context The extension context.
 * @param treeProvider The task tree data provider.
 */
export function registerAICommands(
  context: vscode.ExtensionContext,
  treeProvider: TaskTreeProvider,
): void {
  const taskService = new TaskService();

  /**
   * Command handler to parse a Product Requirements Document (PRD) file (markdown or text)
   * into tasks using AI. Prompts the user to select a file.
   */
  const parsePrdCommand = vscode.commands.registerCommand(
    "task-pilot.parsePrd",
    async () => {
      // Check if tasks.json exists
      if (!taskService.tasksFileExists()) {
        const initialize = await vscode.window.showWarningMessage(
          "tasks.json does not exist. Initialize it first?",
          "Yes",
          "No",
        );

        if (initialize !== "Yes") {
          return;
        }

        const success = taskService.initTasksFile();

        if (!success) {
          vscode.window.showErrorMessage("Failed to initialize tasks.json");
          return;
        }
      }

      // Select a file to parse
      const files = await vscode.workspace.findFiles(
        "**/*.{md,txt}",
        "**/node_modules/**",
      );

      if (files.length === 0) {
        vscode.window.showErrorMessage(
          "No markdown or text files found in the workspace",
        );
        return;
      }

      // Create quick pick items
      const fileItems = files.map((file) => ({
        label: path.basename(file.fsPath),
        description: vscode.workspace.asRelativePath(file.fsPath),
        file,
      }));

      // Show quick pick
      const selectedItem = await vscode.window.showQuickPick(fileItems, {
        placeHolder: "Select a PRD file to parse",
      });

      if (!selectedItem) {
        return;
      }

      try {
        // Show progress notification
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Parsing PRD with AI",
            cancellable: true,
          },
          async (progress, token) => {
            // Get file paths and existing tasks
            const relativePrdPath = vscode.workspace.asRelativePath(
              selectedItem.file.fsPath,
            );
            const existingTasks = taskService.readTasks() || [];

            // Generate prompt
            const prompt = generateParsePrdPrompt(
              relativePrdPath,
              existingTasks,
            );

            progress.report({ message: "Selecting language model..." });

            try {
              // Select language model
              const models = await vscode.lm.selectChatModels({
                vendor: "copilot",
                family: "gpt-4o",
              });

              if (models.length === 0) {
                throw new Error(
                  "No compatible language model found. Please ensure GitHub Copilot is installed and authorized.",
                );
              }

              const model = models[0];

              progress.report({ message: "Sending request to AI..." });

              // Create message for language model
              const messages = [vscode.LanguageModelChatMessage.User(prompt)];

              // Send request to language model
              const response = await model.sendRequest(messages, {}, token);

              progress.report({ message: "Processing response..." });

              // Collect the full response
              let fullResponse = "";
              for await (const chunk of response.text) {
                fullResponse += chunk;
              }

              // Extract JSON from response
              const newTasks = extractJsonFromMarkdown<Task[]>(fullResponse);

              if (!newTasks || !Array.isArray(newTasks)) {
                throw new Error(
                  "AI did not return a valid JSON array of tasks.",
                );
              }

              // Validate tasks (basic validation)
              if (
                newTasks.some(
                  (t) =>
                    typeof t.id !== "number" || typeof t.title !== "string",
                )
              ) {
                throw new Error(
                  "AI returned tasks with invalid structure.",
                );
              }

              // Determine output directory from settings
              const config = vscode.workspace.getConfiguration("taskPilot");
              const tasksDir = config.get<string>("generatedTasksDir", "tasks");

              // Ensure tasks directory exists
              const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
              if (workspaceFolder) {
                const tasksDirPath = path.join(workspaceFolder.uri.fsPath, tasksDir);
                await vscode.workspace.fs.createDirectory(vscode.Uri.file(tasksDirPath));
              }

              // Append new tasks using TaskService
              const success = taskService.appendTasks(newTasks);

              if (success) {
                progress.report({ message: "Parsing complete!" });
                vscode.window.showInformationMessage(
                  `PRD parsing complete. ${newTasks.length} new tasks added.`,
                );
                treeProvider.refresh();
              } else {
                throw new Error("Failed to save new tasks to tasks.json.");
              }

              return;
            } catch (err) {
              if (err instanceof vscode.LanguageModelError) {
                vscode.window.showErrorMessage(
                  `Language model error: ${err.message} (${err.code})`,
                );
              } else {
                vscode.window.showErrorMessage(
                  `Error: ${(err as Error).message}`,
                );
              }
              throw err;
            }
          },
        );
      } catch (err) {
        // Error already shown to user
        console.error("Error parsing PRD:", err);
      }
    },
  );

  /**
   * Command handler to expand a selected task into subtasks using AI.
   * If invoked from the tree view context menu, uses the selected task.
   * Otherwise, prompts the user to select a task.
   * Prompts the user for the desired number of subtasks.
   * @param taskItem The TaskTreeItem from the context menu (optional).
   */
  const expandTaskCommand = vscode.commands.registerCommand(
    "task-pilot.expandTask",
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
          placeHolder: "Select a task to expand into subtasks",
          canPickMany: false,
        });

        if (!selectedTaskItem) {
          return;
        }

        task = selectedTaskItem.task;
      }

      // Get number of subtasks
      const numSubtasksInput = await vscode.window.showInputBox({
        prompt: "Enter number of subtasks to generate",
        placeHolder: "3",
        value: "3",
        validateInput: (value) => {
          const num = parseInt(value, 10);
          if (isNaN(num) || num < 1 || num > 10) {
            return "Please enter a number between 1 and 10";
          }
          return null;
        },
      });

      if (!numSubtasksInput) {
        return;
      }

      const numSubtasks = parseInt(numSubtasksInput, 10);

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Expanding task with AI",
            cancellable: true,
          },
          async (progress, token) => {
            // Generate prompt
            const prompt = generateExpandTaskPrompt(task as Task, numSubtasks);

            progress.report({ message: "Selecting language model..." });

            try {
              // Select language model
              const models = await vscode.lm.selectChatModels({
                vendor: "copilot",
                family: "gpt-4o",
              });

              if (models.length === 0) {
                throw new Error(
                  "No compatible language model found. Please ensure GitHub Copilot is installed and authorized.",
                );
              }

              const model = models[0];

              progress.report({ message: "Sending request to AI..." });

              // Create message for language model
              const messages = [vscode.LanguageModelChatMessage.User(prompt)];

              // Send request to language model
              const response = await model.sendRequest(messages, {}, token);

              progress.report({ message: "Processing response..." });

              // Collect the full response
              let fullResponse = "";
              for await (const chunk of response.text) {
                fullResponse += chunk;
              }

              // Extract JSON from response
              const subtasks = extractJsonFromMarkdown<
                Omit<SubTask, "id">[]
              >(fullResponse);

              if (!subtasks || !Array.isArray(subtasks)) {
                throw new Error(
                  "AI did not return a valid JSON array of subtasks.",
                );
              }

              // Update task with new subtasks
              const success = taskService.addSubtasksToTask(
                (task as Task).id,
                subtasks,
              );

              if (success) {
                progress.report({ message: "Task expansion complete!" });
                vscode.window.showInformationMessage(
                  `Task expansion complete. ${subtasks.length} subtasks added.`,
                );
                treeProvider.refresh();
              } else {
                throw new Error("Failed to save subtasks to tasks.json.");
              }

              return;
            } catch (err) {
              if (err instanceof vscode.LanguageModelError) {
                vscode.window.showErrorMessage(
                  `Language model error: ${err.message} (${err.code})`,
                );
              } else {
                vscode.window.showErrorMessage(
                  `Error: ${(err as Error).message}`,
                );
              }
              throw err;
            }
          },
        );
      } catch (err) {
        // Error already shown to user
        console.error("Error expanding task:", err);
      }
    },
  );

  /**
   * Command handler to add a new task using AI.
   * Prompts the user for a description of the task.
   */
  const addTaskWithAiCommand = vscode.commands.registerCommand(
    "task-pilot.addTaskWithAI",
    async () => {
      // Get task description
      const taskDescription = await vscode.window.showInputBox({
        prompt: "Describe the task you want to add",
        placeHolder: "Implement a feature to...",
        validateInput: (value) => {
          if (!value.trim()) {
            return "Task description is required";
          }
          return null;
        },
      });

      if (!taskDescription) {
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Creating task with AI",
            cancellable: true,
          },
          async (progress, token) => {
            // Get existing tasks
            const existingTasks = taskService.readTasks() || [];

            // Generate prompt
            const prompt = generateAddTaskPrompt(
              taskDescription,
              existingTasks,
            );

            progress.report({ message: "Selecting language model..." });

            try {
              // Select language model
              const models = await vscode.lm.selectChatModels({
                vendor: "copilot",
                family: "gpt-4o",
              });

              if (models.length === 0) {
                throw new Error(
                  "No compatible language model found. Please ensure GitHub Copilot is installed and authorized.",
                );
              }

              const model = models[0];

              progress.report({ message: "Sending request to AI..." });

              // Create message for language model
              const messages = [vscode.LanguageModelChatMessage.User(prompt)];

              // Send request to language model
              const response = await model.sendRequest(messages, {}, token);

              progress.report({ message: "Processing response..." });

              // Collect the full response
              let fullResponse = "";
              for await (const chunk of response.text) {
                fullResponse += chunk;
              }

              // Extract JSON from response
              const newTask = extractJsonFromMarkdown<
                Omit<Task, "id" | "complexity" | "subtasks">
              >(fullResponse);

              if (!newTask || typeof newTask !== "object") {
                throw new Error("AI did not return a valid task object.");
              }

              // Add task
              const addedTask = taskService.addTask({
                ...newTask,
                subtasks: [],
              });

              if (addedTask) {
                progress.report({ message: "Task creation complete!" });
                vscode.window.showInformationMessage(
                  `Successfully added task: ${newTask.title}`,
                );
                treeProvider.refresh();
              } else {
                throw new Error("Failed to save task to tasks.json.");
              }

              return;
            } catch (err) {
              if (err instanceof vscode.LanguageModelError) {
                vscode.window.showErrorMessage(
                  `Language model error: ${err.message} (${err.code})`,
                );
              } else {
                vscode.window.showErrorMessage(
                  `Error: ${(err as Error).message}`,
                );
              }
              throw err;
            }
          },
        );
      } catch (err) {
        // Error already shown to user
        console.error("Error adding task:", err);
      }
    },
  );

  /**
   * Command handler to assess the complexity of a task using AI.
   * If invoked from the tree view context menu, uses the selected task.
   * Otherwise, prompts the user to select a task.
   * @param taskItem The TaskTreeItem from the context menu (optional).
   */
  const assessTaskComplexityCommand = vscode.commands.registerCommand(
    "task-pilot.assessTaskComplexity",
    async (taskItem) => {
      // Forward to the complexity commands implementation
      vscode.commands.executeCommand("task-pilot.assessTaskComplexity.impl", taskItem);
    }
  );

  // Register all commands
  context.subscriptions.push(
    parsePrdCommand,
    expandTaskCommand,
    addTaskWithAiCommand,
    assessTaskComplexityCommand
  );
}

/**
 * Generate a prompt for parsing a PRD file into tasks.
 * @param prdPath Path to the PRD file.
 * @param existingTasks Array of existing tasks.
 * @returns Generated prompt string.
 */
function generateParsePrdPrompt(
  prdPath: string,
  existingTasks: Task[],
): string {
  return `Analyze the PRD (Product Requirements Document) at ${prdPath} in my workspace. 
Extract the key tasks that need to be implemented according to the PRD.

For each task, create a JSON object with the following structure:
- id: A unique numeric ID (start from ${existingTasks.length > 0 ? Math.max(...existingTasks.map(t => t.id)) + 1 : 1})
- title: A concise, descriptive title
- description: A detailed description of what needs to be done
- status: "pending" (for all new tasks)
- priority: "low", "medium", or "high" based on your assessment
- dependencies: An array of task IDs this task depends on (empty array for now)
- subtasks: An empty array (will be populated later)
- details: Additional information or context for the task (optional)

Return a JSON array of task objects and nothing else.

Example response format:
\`\`\`json
[
  {
    "id": 1,
    "title": "Implement user authentication",
    "description": "Set up user authentication with registration, login, and password reset",
    "status": "pending",
    "priority": "high",
    "dependencies": [],
    "subtasks": [],
    "details": "Will use JWT for authentication tokens"
  }
]
\`\`\``;
}

/**
 * Generate a prompt for expanding a task into subtasks.
 * @param task The task to expand.
 * @param numSubtasks The desired number of subtasks to generate.
 * @returns Generated prompt string.
 */
function generateExpandTaskPrompt(task: Task, numSubtasks: number): string {
  return `Break down the following task into ${numSubtasks} subtasks:

Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
${task.details ? `Details: ${task.details}` : ""}

For each subtask, specify:
- title: A concise title
- status: "pending" (for all new subtasks)

Return a JSON array of subtask objects, without IDs (they'll be assigned automatically):

Example response format:
\`\`\`json
[
  {
    "title": "Design database schema",
    "status": "pending"
  },
  {
    "title": "Implement API endpoints",
    "status": "pending"
  }
]
\`\`\``;
}

/**
 * Generate a prompt for adding a new task using AI.
 * @param taskDescription User description of the task.
 * @param existingTasks Array of existing tasks.
 * @returns Generated prompt string.
 */
function generateAddTaskPrompt(
  taskDescription: string,
  existingTasks: Task[],
): string {
  return `Create a new task based on this description: "${taskDescription}"

Use the following fields:
- title: A concise, descriptive title
- description: A detailed description of what needs to be done
- status: "pending"
- priority: "low", "medium", or "high" based on your assessment
- dependencies: An array of IDs of tasks this depends on
- details: Additional information or context (optional)

Existing tasks you can reference for dependencies:
${existingTasks
      .map((t) => `- ID ${t.id}: ${t.title} (${t.status})`)
      .join("\n")}

Return a single JSON object and nothing else:

Example response format:
\`\`\`json
{
  "title": "Implement user profile page",
  "description": "Create a user profile page with editable fields and avatar upload",
  "status": "pending",
  "priority": "medium",
  "dependencies": [1, 2],
  "details": "Should include form validation"
}
\`\`\``;
}

/**
 * Extract JSON data from a markdown-formatted string.
 * @param markdownString The markdown string potentially containing JSON.
 * @returns Parsed JSON data or null if no valid JSON was found.
 */
export function extractJsonFromMarkdown<T>(markdownString: string): T | null {
  // Find content within JSON code blocks
  const jsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = jsonRegex.exec(markdownString);

  if (match && match[1]) {
    try {
      return JSON.parse(match[1]) as T;
    } catch (error) {
      console.error("Failed to parse JSON:", error);
      return null;
    }
  }

  // If no code blocks, try to find just JSON
  try {
    return JSON.parse(markdownString) as T;
  } catch (error) {
    console.error("No valid JSON found in response");
    return null;
  }
} 