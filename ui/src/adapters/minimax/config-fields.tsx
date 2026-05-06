import { useState } from "react";
import type { AdapterConfigFieldsProps } from "../types";
import type { CreateConfigValues } from "@gitmesh/adapter-sdk";
import {
  Field,
  ToggleField,
  DraftInput,
  DraftNumberInput,
  help,
} from "../../components/agent-config-primitives";
import { ChoosePathButton } from "../../features/PathInstructionsModal";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

const instructionsFileHint =
  "Absolute path to a markdown file (e.g. AGENTS.md) that defines this agent's behavior. Injected into the system prompt at runtime.";

function getStr(values: unknown, key: string, fallback: string): string {
  const v = values as Record<string, unknown>;
  return typeof v?.[key] === "string" ? (v[key] as string) : fallback;
}

export function MinimaxConfigFields(props: AdapterConfigFieldsProps) {
  const { isCreate, values, set, config, eff, mark } = props;
  const cfg = config as Record<string, unknown>;

  return (
    <>
      <Field label="Agent instructions file" hint={instructionsFileHint}>
        <div className="flex items-center gap-2">
          <DraftInput
            value={
              isCreate
                ? getStr(values, "instructionsFilePath", "")
                : eff("adapterConfig", "instructionsFilePath", String(cfg.instructionsFilePath ?? ""))
            }
            onCommit={(v) =>
              isCreate
                ? set!({ instructionsFilePath: v })
                : mark("adapterConfig", "instructionsFilePath", v || undefined)
            }
            immediate
            className={inputClass}
            placeholder="/absolute/path/to/AGENTS.md"
          />
          <ChoosePathButton />
        </div>
      </Field>

      <Field
        label="Base URL"
        hint="API endpoint the claude CLI routes to. Defaults to Anthropic if empty."
      >
        <DraftInput
          value={
            isCreate
              ? getStr(values, "baseUrl", "https://api.minimax.io/anthropic")
              : eff("adapterConfig", "baseUrl", String(cfg.baseUrl ?? "https://api.minimax.io/anthropic"))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ baseUrl: v } as Partial<CreateConfigValues>)
              : mark("adapterConfig", "baseUrl", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="https://api.minimax.io/anthropic"
        />
      </Field>

      <AuthTokenField {...props} />

      <Field
        label="Model"
        hint="Model ID passed to the API. Defaults to MiniMax-M2.7 if empty."
      >
        <DraftInput
          value={
            isCreate
              ? getStr(values, "model", "MiniMax-M2.7")
              : eff("adapterConfig", "model", String(cfg.model ?? "MiniMax-M2.7"))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ model: v } as Partial<CreateConfigValues>)
              : mark("adapterConfig", "model", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="MiniMax-M2.7"
        />
      </Field>
    </>
  );
}

function AuthTokenField(props: AdapterConfigFieldsProps) {
  const { isCreate, values, set, config, eff, mark } = props;
  const cfg = config as Record<string, unknown>;
  const [show, setShow] = useState(false);

  const rawValue = isCreate
    ? getStr(values, "authToken", "")
    : eff("adapterConfig", "authToken", String(cfg.authToken ?? ""));

  return (
    <Field
      label="Auth Token"
      hint="API key for the backend provider. Passed as ANTHROPIC_AUTH_TOKEN env var to the claude CLI."
    >
      <div className="flex items-center gap-2">
        <input
          type={show ? "text" : "password"}
          value={rawValue}
          onChange={(e) => {
            if (isCreate) {
              set!({ authToken: e.target.value } as Partial<CreateConfigValues>);
            } else {
              mark("adapterConfig", "authToken", e.target.value);
            }
          }}
          className={inputClass}
          placeholder="sk-..."
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="shrink-0 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </Field>
  );
}

export function MinimaxAdvancedFields(props: AdapterConfigFieldsProps) {
  const { isCreate, values, set, config, eff, mark } = props;

  return (
    <>
      <ToggleField
        label="Enable Chrome"
        hint={help.chrome}
        checked={
          isCreate
            ? values!.chrome
            : eff("adapterConfig", "chrome", config.chrome === true)
        }
        onChange={(v) =>
          isCreate
            ? set!({ chrome: v })
            : mark("adapterConfig", "chrome", v)
        }
      />
      <ToggleField
        label="Skip permissions"
        hint={help.dangerouslySkipPermissions}
        checked={
          isCreate
            ? values!.dangerouslySkipPermissions
            : eff(
                "adapterConfig",
                "dangerouslySkipPermissions",
                config.dangerouslySkipPermissions !== false,
              )
        }
        onChange={(v) =>
          isCreate
            ? set!({ dangerouslySkipPermissions: v })
            : mark("adapterConfig", "dangerouslySkipPermissions", v)
        }
      />
      <Field label="Max turns per run" hint={help.maxTurnsPerRun}>
        {isCreate ? (
          <input
            type="number"
            className={inputClass}
            value={values!.maxTurnsPerRun}
            onChange={(e) => set!({ maxTurnsPerRun: Number(e.target.value) })}
          />
        ) : (
          <DraftNumberInput
            value={eff(
              "adapterConfig",
              "maxTurnsPerRun",
              Number(config.maxTurnsPerRun ?? 80),
            )}
            onCommit={(v) => mark("adapterConfig", "maxTurnsPerRun", v || 80)}
            immediate
            className={inputClass}
          />
        )}
      </Field>
    </>
  );
}
