import { Task, ComplexityScore, ComplexityFactor, ComplexityLevel, PriorityWeight } from "../models/task";

/**
 * Default complexity factors used for assessment
 */
export const defaultComplexityFactors: ComplexityFactor[] = [
  {
    name: "dependencyCount",
    weight: 0.5,
    description: "Number of dependencies the task has"
  },
  {
    name: "subtaskCount",
    weight: 0.7,
    description: "Number of subtasks the task has been broken into"
  },
  {
    name: "priority",
    weight: 1.0,
    description: "Priority level of the task"
  },
  {
    name: "descriptionLength",
    weight: 0.3,
    description: "Length and detail of the task description"
  }
];

/**
 * Calculates a complexity score for a given task
 */
export function assessTaskComplexity(task: Task): ComplexityScore {
  const factors = [...defaultComplexityFactors];
  let totalScore = 0;

  // Calculate score based on dependencies
  const dependencyScore = task.dependencies.length * factors[0].weight;
  totalScore += dependencyScore;

  // Calculate score based on subtasks
  const subtaskScore = task.subtasks.length * factors[1].weight;
  totalScore += subtaskScore;

  // Calculate score based on priority
  const priorityScore = PriorityWeight[task.priority] * factors[2].weight;
  totalScore += priorityScore;

  // Calculate score based on description length
  const descriptionScore = Math.min(5, Math.floor(task.description.length / 50)) * factors[3].weight;
  totalScore += descriptionScore;

  // Determine complexity level
  let level: keyof typeof ComplexityLevel = "simple";
  if (totalScore > 10) {
    level = "veryComplex";
  } else if (totalScore > 7) {
    level = "complex";
  } else if (totalScore > 4) {
    level = "moderate";
  }

  return {
    level,
    score: totalScore,
    factors: factors.map(factor => ({ ...factor }))
  };
}

/**
 * Updates task with complexity assessment
 */
export function updateTaskWithComplexity(task: Task): Task {
  const complexity = assessTaskComplexity(task);
  return {
    ...task,
    complexity
  };
}

/**
 * Assesses complexity for all tasks in an array
 */
export function assessAllTasksComplexity(tasks: Task[]): Task[] {
  return tasks.map(task => updateTaskWithComplexity(task));
}

/**
 * Gets tasks sorted by complexity score (descending)
 */
export function getTasksSortedByComplexity(tasks: Task[]): Task[] {
  const tasksWithComplexity = tasks.map(task => {
    if (!task.complexity) {
      return updateTaskWithComplexity(task);
    }
    return task;
  });

  return [...tasksWithComplexity].sort((a, b) => {
    const scoreA = a.complexity?.score || 0;
    const scoreB = b.complexity?.score || 0;
    return scoreB - scoreA;
  });
}

/**
 * Get the average complexity score for a set of tasks
 */
export function getAverageComplexity(tasks: Task[]): number {
  if (!tasks.length) return 0;

  const tasksWithComplexity = tasks.map(task => {
    if (!task.complexity) {
      return updateTaskWithComplexity(task);
    }
    return task;
  });

  const totalScore = tasksWithComplexity.reduce(
    (sum, task) => sum + (task.complexity?.score || 0),
    0
  );

  return totalScore / tasks.length;
} 