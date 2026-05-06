/**
 * Tiny step-runner for interactive commands. Each step is a pure transition
 * on a shared `state` object; the runner handles header rendering and abort
 * propagation so step bodies stay focused on their own logic.
 */
import * as p from "@clack/prompts";
import pc from "picocolors";

export interface WizardStep<S> {
  /** Header rendered before the step runs. Skipped when omitted. */
  title?: string;
  /**
   * Optional gate. Return `false` to bypass the step entirely (no header is
   * rendered either). Useful for "advanced-only" steps inside a quickstart.
   */
  when?: (state: S) => boolean;
  /** Mutate `state` in place or return a new partial. */
  run: (state: S) => Promise<Partial<S> | void> | Partial<S> | void;
}

export interface RunWizardOpts<S> {
  steps: ReadonlyArray<WizardStep<S>>;
  initial: S;
}

export async function runWizard<S>({ steps, initial }: RunWizardOpts<S>): Promise<S> {
  let state = initial;
  for (const step of steps) {
    if (step.when && !step.when(state)) continue;
    if (step.title) p.log.step(pc.bold(step.title));
    const patch = await step.run(state);
    if (patch && typeof patch === "object") {
      state = { ...state, ...patch };
    }
  }
  return state;
}
