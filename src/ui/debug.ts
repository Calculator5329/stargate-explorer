import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import { T } from "@/core/tunables";

/**
 * lil-gui panel bound to every section of `T`. Hidden by default; backtick
 * toggles it. Ranges are derived from the default value so the panel never
 * needs hand-maintained min/max lists.
 */
export function createDebugPanel(): GUI {
  const gui = new GUI({ title: "tunables" });
  for (const [section, values] of Object.entries(T)) {
    const folder = gui.addFolder(section);
    const bag: Record<string, number> = values;
    for (const [key, v] of Object.entries(bag)) {
      const span = Math.max(1e-3, Math.abs(v) * 4);
      folder.add(bag, key, v < 0 ? -span : 0, span);
    }
    folder.close();
  }
  let visible = false;
  gui.hide();
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Backquote") return;
    visible = !visible;
    if (visible) gui.show();
    else gui.hide();
  });
  return gui;
}
