import { useEffect } from "react";

// Pregunta al servidor cada cierto tiempo, solo con la pestaña a la vista, y al volver a ella.
export default function usePolling(task, intervalMs) {
  useEffect(() => {
    let timer;
    let stopped = false;

    const schedule = () => {
      clearTimeout(timer);
      if (!stopped && !document.hidden) timer = setTimeout(run, intervalMs);
    };
    const run = async () => {
      clearTimeout(timer);
      await task();
      schedule();
    };
    const onVisibility = () => {
      if (document.hidden) clearTimeout(timer);
      else run();
    };

    run();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [task, intervalMs]);
}
