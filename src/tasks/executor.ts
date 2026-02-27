import { CompletionRequest, Task } from "../types";
import { logger } from "../utils/logger";
import { CommandCenter } from "../command-center";
import { TaskDecomposer } from "./decomposer";

export class TaskExecutor {
  constructor(
    private commandCenter: CommandCenter,
    private decomposer: TaskDecomposer
  ) {}

  async execute(task: Task): Promise<Task> {
    task.status = "running";
    logger.info("Executing task", {
      taskId: task.id,
      subtasks: task.subtasks.length,
    });

    while (task.status === "running") {
      const ready = this.decomposer.getReadySubtasks(task);

      if (ready.length === 0) {
        if (task.subtasks.some((s) => s.status === "pending")) {
          // Deadlock: pending tasks with unmet dependencies
          task.status = "failed";
          task.result = "Deadlock: unresolvable dependencies";
          break;
        }
        break;
      }

      // Execute ready subtasks in parallel
      const results = await Promise.allSettled(
        ready.map(async (subtask) => {
          subtask.status = "running";

          const request: CompletionRequest = {
            messages: [{ role: "user", content: subtask.prompt }],
            tier: subtask.tier,
          };

          // Inject dependency results into context
          const depResults = subtask.dependencies
            .map((depId) => task.subtasks.find((s) => s.id === depId))
            .filter((s) => s?.result)
            .map((s) => `[${s!.description}]: ${s!.result}`)
            .join("\n");

          if (depResults) {
            request.messages.unshift({
              role: "system",
              content: `Previous task results:\n${depResults}`,
            });
          }

          const response = await this.commandCenter.complete(request);
          return { subtaskId: subtask.id, content: response.content };
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          this.decomposer.markCompleted(
            task,
            result.value.subtaskId,
            result.value.content
          );
        } else {
          const failedSubtask = ready.find(
            (s) =>
              !results.some(
                (r) =>
                  r.status === "fulfilled" &&
                  r.value.subtaskId === s.id
              )
          );
          if (failedSubtask) {
            this.decomposer.markFailed(
              task,
              failedSubtask.id,
              result.reason?.message ?? "Unknown error"
            );
          }
        }
      }
    }

    logger.info("Task finished", {
      taskId: task.id,
      status: task.status,
    });

    return task;
  }
}
