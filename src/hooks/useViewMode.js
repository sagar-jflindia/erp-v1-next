import { useState, useEffect } from "react";

export function useViewMode(defaultMode = "table") {
  const storageKey = "viewMode";

  // Initialize with default mode to ensure server-client hydration match
  const [viewMode, setViewMode] = useState(defaultMode);

  // After mount, sync with localStorage if a saved value exists
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    // if (saved && saved !== defaultMode) setViewMode(saved);
    if (saved) {
      setViewMode(saved);
    } else {
      // Sirf tab screen check karo jab user ne kabhi set nahi kiya
      setViewMode(window.innerWidth < 768 ? "card" : "table");
    }
  }, []);

  // Update view mode and persist it in localStorage
  const handleViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem(storageKey, mode);
  };

  return [viewMode, handleViewMode];
}
