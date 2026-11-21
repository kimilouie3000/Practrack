
import { useEffect, useState } from "react";

export default function useTimer(startTime, enabled = true) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!enabled || !startTime) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = new Date(startTime).getTime();

    if (Number.isNaN(startedAt)) {
      setElapsedSeconds(0);
      return;
    }

    const update = () => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
      );
    };

    update();

    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, [startTime, enabled]);

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  return {
    elapsedSeconds,
    hours,
    minutes,
    seconds,
    formatted: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  };
}
