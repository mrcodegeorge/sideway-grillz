const THEME_STORAGE_KEY = "theme";

export const getTheme = () => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // ignore storage errors
  }
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
};

export const applyTheme = (theme) => {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // ignore storage errors
  }
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute("content", next === "light" ? "#f4f4f6" : "#1f1f1f");
  }
  return next;
};

export const toggleTheme = () => {
  const current = getTheme();
  return applyTheme(current === "light" ? "dark" : "light");
};

