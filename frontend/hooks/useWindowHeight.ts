import { useState, useEffect } from "react";

export function useWindowHeight() {
  // Initialize state with 0 or window.innerHeight if running client-side immediately
  const [windowHeight, setWindowHeight] = useState(() => {
    // Check if window is defined (for SSR compatibility)
    return typeof window !== "undefined" ? window.innerHeight : 0;
  });

  useEffect(() => {
    // Ensure this effect runs only client-side
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };

    // Set the initial height correctly after mount (handles SSR hydration)
    handleResize();

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Cleanup function to remove listener on component unmount
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []); // Empty dependency array ensures this effect runs only once on mount and cleans up on unmount

  return windowHeight;
}
