import { createContext, ReactNode, useContext, useMemo, useState } from "react";

export type FilterCategory =
  | "All"
  | "Photography"
  | "Direction"
  | "Cinematography";

type GalleryFilterContextValue = {
  activeCategories: FilterCategory[];
  toggleCategory: (category: FilterCategory) => void;
  setActiveCategories: (categories: FilterCategory[]) => void;
};

const GalleryFilterContext = createContext<
  GalleryFilterContextValue | undefined
>(undefined);

type ProviderProps = {
  children: ReactNode;
};

export const GalleryFilterProvider = (props: ProviderProps) => {
  const { children } = props;
  const [activeCategories, setActiveCategories] = useState<FilterCategory[]>(
    []
  );

  const toggleCategory = (category: FilterCategory) => {
    setActiveCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((c) => c !== category);
      }

      return [...prev, category];
    });
  };

  const value: GalleryFilterContextValue = useMemo(
    () => ({
      activeCategories,
      toggleCategory,
      setActiveCategories,
    }),
    [activeCategories]
  );

  return (
    <GalleryFilterContext.Provider value={value}>
      {children}
    </GalleryFilterContext.Provider>
  );
};

export const useGalleryFilter = (): GalleryFilterContextValue => {
  const context = useContext(GalleryFilterContext);

  if (!context) {
    throw new Error(
      "useGalleryFilter must be used within GalleryFilterProvider"
    );
  }

  return context;
};
