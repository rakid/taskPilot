import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Task, TasksFile, SubTask } from "../models/task";
import {
  assessAllTasksComplexity,
  updateTaskWithComplexity,
} from "./complexityAssessment";

/**
 * Service for handling task operations including reading, writing, and updating tasks
 */
export class TaskService {
  private workspacePath: string | undefined;
  private tasksFilePath: string | undefined;
  private tasksDirectoryPath: string | undefined;

  /**
   * Creates an instance of TaskService.
   * Initializes the workspace path and tasks file path.
   */
  constructor() {
    this.initWorkspacePath();
  }

  /**
   * Initializes the workspace path and sets the path to tasks.json and tasks directory
   * Uses the first workspace folder as the root
   */
  private initWorkspacePath(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.workspacePath = undefined;
      return;
    }

    this.workspacePath = workspaceFolders[0].uri.fsPath;

    // Get configuration
    const config = vscode.workspace.getConfiguration("taskPilot");
    const tasksFilePath = config.get<string>("tasksFilePath", "tasks.json");
    const tasksDir = config.get<string>("generatedTasksDir", "tasks");

    this.tasksFilePath = path.join(this.workspacePath, tasksFilePath);
    this.tasksDirectoryPath = path.join(this.workspacePath, tasksDir);
  }

  /**
   * Gets the absolute path to the tasks.json file
   * @returns The path to the tasks file or undefined if not set
   */
  public getTasksFilePath(): string | undefined {
    return this.tasksFilePath;
  }

  /**
   * Gets the absolute path to the tasks directory
   * @returns The path to the tasks directory or undefined if not set
   */
  public getTasksDirectoryPath(): string | undefined {
    return this.tasksDirectoryPath;
  }

  /**
   * Ensures that the tasks directory exists, creating it if necessary
   * @returns True if the directory exists or was created, false otherwise
   */
  public ensureTasksDirectoryExists(): boolean {
    if (!this.tasksDirectoryPath) {
      return false;
    }

    try {
      if (!fs.existsSync(this.tasksDirectoryPath)) {
        fs.mkdirSync(this.tasksDirectoryPath, { recursive: true });
      }
      return true;
    } catch (error) {
      console.error("Failed to create tasks directory:", error);
      return false;
    }
  }

  /**
   * Checks if the tasks.json file exists in the workspace
   * @returns True if the file exists, false otherwise
   */
  public tasksFileExists(): boolean {
    if (!this.tasksFilePath) {
      return false;
    }

    return fs.existsSync(this.tasksFilePath);
  }

  /**
   * Creates an empty tasks.json file in the workspace and ensures tasks directory exists
   * @returns True if the file was created successfully, false otherwise
   */
  public initTasksFile(): boolean {
    if (!this.workspacePath || !this.tasksFilePath) {
      return false;
    }

    try {
      // Create tasks directory
      this.ensureTasksDirectoryExists();

      // Create empty tasks file
      const emptyTasks: TasksFile = [];
      fs.writeFileSync(this.tasksFilePath, JSON.stringify(emptyTasks, null, 2));
      return true;
    } catch (error) {
      console.error("Failed to create tasks file:", error);
      return false;
    }
  }

  /**
   * Reads and parses the tasks from the tasks.json file
   * @returns An array of tasks or undefined if the file doesn't exist or can't be read
   */
  public readTasks(): TasksFile | undefined {
    if (!this.tasksFilePath || !this.tasksFileExists()) {
      return undefined;
    }

    try {
      const tasksData = fs.readFileSync(this.tasksFilePath, "utf8");
      const tasks: TasksFile = JSON.parse(tasksData);
      return tasks;
    } catch (error) {
      console.error("Failed to read tasks file:", error);
      return undefined;
    }
  }

  /**
   * Saves tasks to the tasks.json file
   * @param tasks The array of tasks to save
   * @returns True if tasks were saved successfully, false otherwise
   */
  public saveTasks(tasks: TasksFile): boolean {
    if (!this.tasksFilePath) {
      return false;
    }

    try {
      fs.writeFileSync(this.tasksFilePath, JSON.stringify(tasks, null, 2));
      return true;
    } catch (error) {
      console.error("Failed to save tasks:", error);
      return false;
    }
  }

  /**
   * Appends multiple new tasks to the tasks file and creates individual task files in tasks directory.
   * @param newTasks An array of new tasks to add (should have IDs assigned)
   * @returns True if successful, false otherwise
   */
  public appendTasks(newTasks: Task[]): boolean {
    const existingTasks = this.readTasks();
    if (!existingTasks) {
      // Handle case where tasks.json might be empty or unreadable after init
      // For simplicity, we'll just try saving the new tasks directly
      // A more robust approach might re-initialize or throw a clearer error
      console.warn(
        "Could not read existing tasks, attempting to save new tasks directly.",
      );
      const tasksWithComplexity = newTasks.map(updateTaskWithComplexity);
      // Also save individual task files
      this.saveTasksToDirectory(tasksWithComplexity);
      return this.saveTasks(tasksWithComplexity);
    }

    // Assess complexity for new tasks
    const newTasksWithComplexity = newTasks.map(updateTaskWithComplexity);

    // Save individual task files
    this.saveTasksToDirectory(newTasksWithComplexity);

    // Combine and save
    const allTasks = [...existingTasks, ...newTasksWithComplexity];
    return this.saveTasks(allTasks);
  }

  /**
   * Saves individual task files to the tasks directory
   * @param tasks The tasks to save as individual files
   */
  private saveTasksToDirectory(tasks: Task[]): void {
    if (!this.tasksDirectoryPath || !this.ensureTasksDirectoryExists()) {
      console.error("Tasks directory not available");
      return;
    }

    for (const task of tasks) {
      try {
        const taskFileName = `task-${task.id}.json`;
        const taskFilePath = path.join(this.tasksDirectoryPath, taskFileName);
        fs.writeFileSync(taskFilePath, JSON.stringify(task, null, 2));
      } catch (error) {
        console.error(`Failed to save task ${task.id} to file:`, error);
      }
    }
  }

  /**
   * Adds a new task to the tasks.json file and creates a task file in the tasks directory
   * @param task The task to add (without ID and complexity, which will be assigned automatically)
   * @returns The added task with ID and complexity or undefined if failed
   */
  public addTask(task: Omit<Task, "id" | "complexity">): Task | undefined {
    const tasks = this.readTasks();
    if (!tasks) {
      return undefined;
    }

    // Find the next available ID
    const maxId = tasks.reduce((max, t) => Math.max(max, t.id), 0);
    const newTask: Task = {
      ...task,
      id: maxId + 1,
      subtasks: task.subtasks || [],
    };

    // Assess complexity
    const taskWithComplexity = updateTaskWithComplexity(newTask);

    // Save individual task file
    this.saveTasksToDirectory([taskWithComplexity]);

    // Add to collection and save
    tasks.push(taskWithComplexity);
    const saved = this.saveTasks(tasks);

    return saved ? taskWithComplexity : undefined;
  }

  /**
   * Updates the complexity scores for all tasks in the tasks.json file
   * @returns True if all tasks were updated successfully, false otherwise
   */
  public updateAllTasksComplexity(): boolean {
    const tasks = this.readTasks();
    if (!tasks) {
      return false;
    }

    const updatedTasks = assessAllTasksComplexity(tasks);
    return this.saveTasks(updatedTasks);
  }

  /**
   * Retrieves a task by its ID
   * @param id The ID of the task to retrieve
   * @returns The task with the specified ID or undefined if not found
   */
  public getTaskById(id: number): Task | undefined {
    const tasks = this.readTasks();
    if (!tasks) {
      return undefined;
    }

    return tasks.find((task) => task.id === id);
  }

  /**
   * Updates an existing task in the tasks.json file
   * @param updatedTask The updated task object (must have same ID as existing task)
   * @returns True if the task was updated successfully, false otherwise
   */
  public updateTask(updatedTask: Task): boolean {
    const tasks = this.readTasks();
    if (!tasks) {
      return false;
    }

    const index = tasks.findIndex((task) => task.id === updatedTask.id);
    if (index === -1) {
      return false;
    }

    // Update task and reassess complexity
    tasks[index] = updateTaskWithComplexity(updatedTask);

    return this.saveTasks(tasks);
  }

  /**
   * Adds subtasks to an existing task
   * @param taskId The ID of the parent task
   * @param subtasks Array of subtasks to add (without IDs, which will be assigned)
   * @returns True if subtasks were added successfully, false otherwise
   */
  public addSubtasksToTask(
    taskId: number,
    subtasks: Omit<SubTask, "id">[]
  ): boolean {
    const tasks = this.readTasks();
    if (!tasks) {
      return false;
    }

    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) {
      return false;
    }

    const task = tasks[taskIndex];

    // Assign IDs to subtasks (using sequential numbers from current max ID)
    const maxSubtaskId = task.subtasks.length > 0
      ? Math.max(...task.subtasks.map(s => s.id))
      : 0;

    const subtasksWithIds = subtasks.map((subtask, index) => ({
      ...subtask,
      id: maxSubtaskId + index + 1,
    }));

    // Add new subtasks to the task
    task.subtasks = [...task.subtasks, ...subtasksWithIds];

    // Save individual task file with updated subtasks
    this.saveTasksToDirectory([task]);

    // Save all tasks
    return this.saveTasks(tasks);
  }
}
