import { v4 as uuid } from "uuid";
import { ModelTier, Subtask, Task } from "../types";
import { logger } from "../utils/logger";

export interface DecomposeOptions {
  maxSubtasks?: number;
  defaultTier?: ModelTier;
}

export class TaskDecomposer {
  private defaultTier: ModelTier;
  private maxSubtasks: number;

  constructor(options?: DecomposeOptions) {
    this.defaultTier = options?.defaultTier ?? "standard";
    this.maxSubtasks = options?.maxSubtasks ?? 10;
  }

  createTask(description: string, subtaskDefs: SubtaskDef[]): Task {
    const taskId = uuid();
    const defs = subtaskDefs.slice(0, this.maxSubtasks);

    const subtasks: Subtask[] = defs.map((def) => ({
      id: uuid(),
      parentId: taskId,
      description: def.description,
      prompt: def.prompt,
      dependencies: [],
      status: "pending",
      tier: def.tier ?? this.defaultTier,
    }));

    // Resolve named dependencies to IDs
    for (const subtask of subtasks) {
      const def = defs.find((d) => d.description === subtask.description);
      if (def?.dependsOn) {
        subtask.dependencies = def.dependsOn
          .map((depName) => subtasks.find((s) => s.description === depName)?.id)
          .filter((id): id is string => !!id);
      }
    }

    logger.info("Task created", {
      taskId,
      description,
      subtaskCount: subtasks.length,
    });

    return {
      id: taskId,
      description,
      subtasks,
      status: "pending",
      createdAt: new Date(),
    };
  }

  getReadySubtasks(task: Task): Subtask[] {
    return task.subtasks.filter((sub) => {
      if (sub.status !== "pending") return false;
      return sub.dependencies.every((depId) => {
        const dep = task.subtasks.find((s) => s.id === depId);
        return dep?.status === "completed";
      });
    });
  }

  markCompleted(task: Task, subtaskId: string, result: string): void {
    const subtask = task.subtasks.find((s) => s.id === subtaskId);
    if (!subtask) return;

    subtask.status = "completed";
    subtask.result = result;

    if (task.subtasks.every((s) => s.status === "completed")) {
      task.status = "completed";
      task.completedAt = new Date();
      task.result = task.subtasks
        .map((s) => s.result)
        .filter(Boolean)
        .join("\n\n");
    }
  }

  markFailed(task: Task, subtaskId: string, error: string): void {
    const subtask = task.subtasks.find((s) => s.id === subtaskId);
    if (!subtask) return;

    subtask.status = "failed";
    subtask.result = `Error: ${error}`;
    task.status = "failed";
  }
}

export interface SubtaskDef {
  description: string;
  prompt: string;
  tier?: ModelTier;
  dependsOn?: string[];
}
