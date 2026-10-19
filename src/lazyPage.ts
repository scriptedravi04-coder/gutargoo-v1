// lazy() that survives a new deploy: if an old page file is gone (app was left open during an update),
// reload once to get the new version instead of showing a blank screen.
import { lazy, type ComponentType } from "react";

const FLAG = "gp-chunk-reload";

export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load()
      .then((m) => {
        try {
          sessionStorage.removeItem(FLAG);
        } catch {
          /* ignore */
        }
        return m;
      })
      .catch((err) => {
        let reloaded = false;
        try {
          reloaded = sessionStorage.getItem(FLAG) === "1";
          if (!reloaded) sessionStorage.setItem(FLAG, "1");
        } catch {
          reloaded = true; // can't remember → don't risk a reload loop
        }
        if (!reloaded) {
          window.location.reload();
          return new Promise<never>(() => {}); // wait for the reload
        }
        throw err;
      })
  );
}
