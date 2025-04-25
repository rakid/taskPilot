/**
 * Represents a subtask that belongs to a parent task
 */
export interface SubTask {
  id: number;
  parentId: number;
  title: string;
  status: "pending" | "in-progress" | "done" | "deferred";
}

/**
 * Represents a main task with its properties and subtasks
 */
export interface Task {
  id: number;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "done" | "deferred";
  dependencies: number[];
  priority: "low" | "medium" | "high";
  details?: string;
  testStrategy?: string;
  subtasks: SubTask[];
  complexity?: ComplexityScore;
}

/**
 * Numerical weights for different priority levels
 */
export enum PriorityWeight {
  low = 1,
  medium = 2,
  high = 3
}

/**
 * Complexity levels with their associated numerical scores
 */
export enum ComplexityLevel {
  simple = 1,
  moderate = 2,
  complex = 3,
  veryComplex = 5
}

/**
 * Represents the complexity assessment for a task
 */
export interface ComplexityScore {
  level: keyof typeof ComplexityLevel;
  score: number;
  factors: ComplexityFactor[];
}

/**
 * A contributing factor to a task's complexity score
 */
export interface ComplexityFactor {
  name: string;
  weight: number;
  description: string;
}

/**
 * Type definition for a collection of tasks stored in tasks.json
 */
export type TasksFile = Task[]; 