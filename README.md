# TaskPilot

A VSCode extension providing intelligent task management with AI assistance (Github copilot).

## Overview

TaskPilot provides a seamless way to manage development tasks directly within VSCode, with AI integration. It enables developers to:

- Parse requirements documents into structured tasks using AI
- Break down complex tasks into manageable subtasks
- Track task dependencies, status, and complexity
- Identify the next most important task to work on
- Assess task complexity with AI assistance

## Features

### Task Management

- **Task Tree View**: View all tasks in the sidebar, grouped by status
- **Task Creation**: Create tasks manually or have AI generate them from descriptions
- **Dependency Tracking**: Define and visualize task dependencies
- **Status Updates**: Mark tasks as pending, in-progress, done, or deferred
- **Next Task Suggestion**: Get intelligent suggestions for what to work on next

### AI Integration

- **Parse PRD**: Convert requirements documents into structured tasks
- **Task Expansion**: Break down tasks into subtasks with AI assistance
- **AI-assisted Task Creation**: Generate tasks from simple descriptions
- **Complexity Assessment**: Get AI assessment of task complexity

### Task Complexity Assessment

TaskPilot includes a robust complexity assessment system that helps developers understand the relative difficulty and effort required for each task. This feature can be used in two ways:

1. **Automatic Complexity Assessment**: The extension automatically calculates complexity scores based on several factors:

   - Number of dependencies
   - Number of subtasks
   - Task priority
   - Description length and detail

2. **AI-assisted Complexity Assessment**: For more nuanced evaluation, the extension provides AI-assisted complexity analysis:
   - Select a task and request AI to assess its complexity
   - AI analyzes technical complexity, time estimation, dependencies, required expertise, and potential risks
   - Results are captured in a structured format and stored with the task

Tasks are evaluated on a scale from "simple" to "veryComplex" with corresponding numerical scores:

- **Simple** (1): Straightforward tasks with minimal dependencies and low technical complexity
- **Moderate** (2-3): Tasks with some dependencies or moderate technical challenges
- **Complex** (4): Challenging tasks requiring significant expertise or coordination
- **Very Complex** (5): Highly challenging tasks with many dependencies and technical hurdles

## Installation

### From VSIX File

1. Download the `task-pilot-0.1.0.vsix` file
2. Open VSCode
3. Go to Extensions view (Ctrl+Shift+X)
4. Click the "..." menu in the top-right of the Extensions view
5. Select "Install from VSIX..."
6. Navigate to and select the downloaded VSIX file

### Building from Source

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to compile the TypeScript code
4. Run `npm run package` to create a VSIX file
5. Install the generated VSIX file as described above

## Getting Started

1. Run the "TaskPilot: Initialize" command to set up the tasks.json file
2. Create tasks or import them from a requirements document
3. Use the complexity assessment features to prioritize and plan your work

For detailed workflow instructions, see the [WORKFLOW.md](WORKFLOW.md) file.

## Commands

- **TaskPilot: Initialize** - Set up the task management system in your workspace
- **TaskPilot: Parse PRD into Tasks** - Generate tasks from a requirements document
- **TaskPilot: Add Task Manually** - Create a new task with manual input
- **TaskPilot: Add Task using AI** - Create a task using AI from a description
- **TaskPilot: Set Task Status** - Update the status of a task
- **TaskPilot: Manage Task Dependencies** - Define dependencies between tasks
- **TaskPilot: Find Next Available Task** - Identify the next task to work on
- **TaskPilot: Expand Task into Subtasks** - Break down a task with AI
- **TaskPilot: Assess Task Complexity** - Use AI to evaluate task complexity
- **TaskPilot: Assess Complexity for All Tasks** - Calculate complexity scores for all tasks
- **TaskPilot: Update Task Complexity Manually** - Manually set complexity scores

## Requirements

- Visual Studio Code 1.80.0 or higher

## Extension Settings

This extension contributes the following settings:

- `taskPilot.complexityThreshold`: Sets the threshold for highlighting high-complexity tasks (default: 4)
- `taskPilot.tasksFilePath`: Custom path to the tasks.json file
- `taskPilot.generatedTasksDir`: Directory to store generated tasks (default: "tasks")

## Known Issues

- None currently known.

## Release Notes

### 0.1.0

- Initial release with task management functionality
- Task creation, status updates, dependency management
- Complexity assessment
- AI integration for parsing, expansion, and assessment
