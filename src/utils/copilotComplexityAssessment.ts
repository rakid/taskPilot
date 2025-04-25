import * as vscode from "vscode";
import { Task, ComplexityScore } from "../models/task";
import { extractJsonFromMarkdown } from "../commands/copilotCommands"; // Import the helper function

/**
 * Service for handling Copilot agent interactions for complexity assessment
 */
export class CopilotComplexityService {
  /**
   * Generate a prompt for Copilot to assess task complexity
   */
  public static generateComplexityAssessmentPrompt(task: Task): string {
    return `I need to assess the complexity of the following task:
    
Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
${task.details ? `Details: ${task.details}` : ""}
Priority: ${task.priority}
Dependencies: ${
      task.dependencies.length > 0 ? task.dependencies.join(", ") : "None"
    }
Subtasks: ${task.subtasks.length}

On a scale from 1-5, how complex is this task? Please consider:
1. Technical complexity
2. Time estimation
3. Dependencies
4. Required knowledge/expertise
5. Potential risks

Format your response as a JSON object with the following structure:
{
  "complexity": {
    "level": "simple|moderate|complex|veryComplex",
    "score": <number between 1-5>,
    "factors": [
      {
        "name": "<factor name>",
        "weight": <number between 0-1>,
        "description": "<why this factor contributes to complexity>"
      }
    ]
  }
}`;
  }

  /**
   * Use Language Model API to request complexity assessment
   */
  public static async requestCopilotComplexityAssessment(
    task: Task,
  ): Promise<ComplexityScore | undefined> {
    try {
      // Show progress notification
      return await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Assessing complexity for task ${task.id}`,
          cancellable: true,
        },
        async (progress, token) => {
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

            progress.report({ message: "Sending request to Copilot..." });

            // Generate prompt
            const prompt = this.generateComplexityAssessmentPrompt(task);

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

            progress.report({ message: "Parsing complexity assessment..." });

            // Parse the JSON response
            try {
              // Use the robust JSON extraction helper
              const jsonResponse = extractJsonFromMarkdown<{
                complexity: ComplexityScore;
              }>(fullResponse);

              if (!jsonResponse) {
                // Error already shown by extractJsonFromMarkdown
                throw new Error(
                  "Failed to extract valid JSON from Copilot response.",
                );
              }

              if (!jsonResponse.complexity) {
                throw new Error(
                  "Invalid response format: missing complexity object",
                );
              }

              // Add more validation
              const complexityData = jsonResponse.complexity;
              if (typeof complexityData.level !== "string") {
                throw new Error(
                  "Invalid response format: complexity.level is not a string",
                );
              }
              if (typeof complexityData.score !== "number") {
                throw new Error(
                  "Invalid response format: complexity.score is not a number",
                );
              }
              if (!Array.isArray(complexityData.factors)) {
                throw new Error(
                  "Invalid response format: complexity.factors is not an array",
                );
              }
              // Optional: Add validation for factor structure if needed

              const complexityScore: ComplexityScore = {
                level:
                  complexityData.level as keyof typeof import("../models/task").ComplexityLevel, // Cast for type safety
                score: complexityData.score,
                factors: complexityData.factors,
              };

              progress.report({ message: "Complexity assessment complete!" });

              return complexityScore;
            } catch (parseError) {
              console.error(
                "Error parsing complexity assessment response:",
                parseError,
              );
              throw new Error(
                `Failed to parse complexity assessment: ${
                  (parseError as Error).message
                }`,
              );
            }
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
      console.error("Error assessing complexity:", err);
      return undefined;
    }
  }

  /**
   * Helper method to guide the user through the complexity assessment process
   */
  public static async assessTaskComplexity(
    task: Task,
  ): Promise<ComplexityScore | undefined> {
    return await this.requestCopilotComplexityAssessment(task);
  }
}
