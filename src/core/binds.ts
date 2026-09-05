/**
 * Keyboard bindings: action → `KeyboardEvent.code`. The menu rebinds them and the
 * save carries them; `Input` reads keys only through this table. Mouse buttons,
 * Esc, R/V/G on the end card and the backtick debug toggle are not rebindable.
 */
export type Action = "pullUp" | "dive" | "rollLeft" | "rollRight" | "boost" | "brake" | "scheme" | "assist";

export type Binds = Record<Action, string>;

export const DEFAULT_BINDS: Binds = {
  pullUp: "KeyW",
  dive: "KeyS",
  rollLeft: "KeyA",
  rollRight: "KeyD",
  boost: "ShiftLeft",
  brake: "Space",
  scheme: "KeyC",
  assist: "KeyX",
};

export const ACTIONS = Object.keys(DEFAULT_BINDS) as Action[];

/** what the menu prints next to each key; the arcade/classic meaning is in the second half */
export const BIND_LABELS: Record<Action, string> = {
  pullUp: "Pull up · throttle up",
  dive: "Dive · throttle down",
  rollLeft: "Roll left (double-tap: barrel)",
  rollRight: "Roll right (double-tap: barrel)",
  boost: "Boost",
  brake: "Brake · drift",
  scheme: "Switch control scheme",
  assist: "Toggle flight assist",
};

/** Merge a saved (possibly partial or stale) table onto the defaults. */
export function mergeBinds(saved: Partial<Record<string, unknown>> | undefined): Binds {
  const out: Binds = { ...DEFAULT_BINDS };
  if (!saved) return out;
  for (const a of ACTIONS) {
    const v = saved[a];
    if (typeof v === "string" && v.length > 0) out[a] = v;
  }
  return out;
}

/** Short printable name for a key code: `KeyW` → `W`, `ShiftLeft` → `L SHIFT`, `ArrowUp` → `↑`. */
export function keyName(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `NUM ${code.slice(6)}`;
  const arrows: Record<string, string> = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };
  if (arrows[code]) return arrows[code];
  if (code.endsWith("Left") && code.length > 4) return `L ${code.slice(0, -4).toUpperCase()}`;
  if (code.endsWith("Right") && code.length > 5) return `R ${code.slice(0, -5).toUpperCase()}`;
  const named: Record<string, string> = { Space: "SPACE", Tab: "TAB", CapsLock: "CAPS", Enter: "ENTER", Backspace: "BKSP", Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backslash: "\\" };
  return named[code] ?? code.toUpperCase();
}
