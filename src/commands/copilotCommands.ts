import * as vscode from "vscode";
// import * as fs from "fs"; // Removed unused import

/**
 * Register Copilot integration commands.
 * @param context The extension context.
 * @param treeProvider The task tree data provider.
 */

/**
 * Extracts JSON content from a markdown code block.
 * @param markdownString The string potentially containing a JSON code block.
 * @returns The parsed JSON object/array, or null if not found or invalid.
 */
export function extractJsonFromMarkdown<T>(markdownString: string): T | null {
  // Added export here
  const codeBlockRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = markdownString.match(codeBlockRegex);

  if (match && match[1]) {
    try {
      // Attempt to clean potential artifacts before parsing
      const cleanedJsonString = match[1].trim();
      return JSON.parse(cleanedJsonString) as T;
    } catch (error) {
      console.error(
        "Failed to parse JSON from markdown:",
        error,
        "Raw content:",
        match[1],
      );
      vscode.window.showErrorMessage(
        "Failed to parse JSON response from Copilot. Check Output channel for details.",
      );
      return null;
    }
  }
  console.error("No JSON code block found in the response:", markdownString);
  vscode.window.showErrorMessage(
    "Could not find JSON code block in Copilot response. Check Output channel for details.",
  );
  return null;
}
