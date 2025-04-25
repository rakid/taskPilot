# TaskPilot Workflow Guide

This guide provides step-by-step instructions for working with the TaskPilot extension.

## Getting Started

1. **Initialize**: Run the "task-pilot: Initialize" command to create an empty tasks.json file in your workspace root.

2. **Create Tasks**: You have three ways to create tasks:
   - Parse a PRD: Use "task-pilot: Parse PRD into Tasks" to generate tasks from a requirements document
   - Add manually: Use "task-pilot: Add Task Manually" to create individual tasks
   - Add with Copilot: Use "task-pilot: Add Task using AI" to let AI generate a structured task from a description

## Managing Tasks

1. **View Tasks**: All tasks are visible in the TaskPilot activity bar view, organized by status

2. **Update Task Status**: Right-click a task and select "Set Task Status" to change its status to:

   - Pending: Not started yet
   - In-Progress: Currently being worked on
   - Done: Completed
   - Deferred: Postponed for later

3. **Manage Dependencies**: Right-click a task and select "Manage Task Dependencies" to specify which tasks must be completed before this one can start

4. **Find Next Task**: Run "task-pilot: Find Next Available Task" to identify the next task you should work on based on dependencies and priorities

## Breaking Down Tasks

1. **Expand Tasks**: Right-click a complex task and select "Expand Task into Subtasks" to break it down into smaller, manageable pieces

2. **View Subtasks**: Click the expand arrow next to a task to see its subtasks

## Assessing Complexity

1. **Automatic Assessment**: The extension automatically calculates a complexity score for each task based on various factors (Note: This is currently implemented via the "Assess Complexity for All Tasks" command).

2. **Copilot Assessment**: For more nuanced evaluation, right-click a task and select "Assess Task Complexity"

3. **Manual Update**: Use "task-pilot: Update Task Complexity Manually" to set the complexity level and score yourself

## Using the Copilot Integration

When using commands that interact with Copilot (Parse PRD, Expand Task, Add Task with AI, Assess Complexity):

1. The extension will directly communicate with Copilot via the VSCode Language Model API
2. A progress notification will appear showing the current status of the operation
3. Copilot will process your request and automatically update your tasks.json file
4. The Task Tree View will refresh automatically when changes are complete

No need to manually copy/paste prompts or switch between views - the extension handles all communication with Copilot seamlessly!

## Example Workflow

1. Initialize a new project: "task-pilot: Initialize"
2. Parse your requirements document: "task-pilot: Parse PRD into Tasks"
3. For complex tasks, expand them: Right-click > "Expand Task into Subtasks"
4. Check complexity of tasks: Right-click > "Assess Task Complexity"
5. Find your next task: "task-pilot: Find Next Available Task"
6. Mark it as in-progress: Right-click > "Set Task Status" > "in-progress"
7. Once completed, mark it as done: Right-click > "Set Task Status" > "done"
8. Repeat steps 5-7 until all tasks are complete

This extension helps keep your development tasks organized, prioritized, and manageable, with AI assistance throughout the process.
