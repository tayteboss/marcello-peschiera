import { useEffect, useState } from "react";
import throttle from "lodash.throttle"; // Ensure lodash.throttle is installed

// Modify the return type to allow null
type ReturnMousePosition = {
  x: number | null; // Allow null
  y: number | null; // Allow null
};

// State type doesn't need changing if we initialize with null directly
// type PositionState = {
//   x: number;
//   y: number;
// };

// Modify the hook's return type annotation
export const useMousePosition = (): ReturnMousePosition => {
  // Initialize state with null instead of { x: 0, y: 0 }
  const [position, setPosition] = useState<ReturnMousePosition>({
    x: null,
    y: null,
  });

  // This function now always sets a valid position object
  const setFromEvent = (e: MouseEvent) =>
    setPosition({ x: e.clientX, y: e.clientY });

  useEffect(() => {
    // Throttle the event handler
    const throttledSetFromEvent = throttle(setFromEvent, 100); // Adjust throttle time if needed

    // Add listener
    window.addEventListener("mousemove", throttledSetFromEvent);

    // Cleanup: remove listener and cancel any pending throttled calls
    return () => {
      throttledSetFromEvent.cancel(); // Important for throttle cleanup
      window.removeEventListener("mousemove", throttledSetFromEvent);
    };
  }, []); // Empty dependency array ensures this runs only on mount/unmount

  return position; // Return the state ({x: null, y: null} initially)
};
