import { useState, useRef, useEffect } from "react";
import styled from "styled-components";
import {
  FilterCategory,
  useGalleryFilter,
} from "../../../shared/context/context";
import { useClickOutside } from "../../../hooks/useClickOutside";

const FiltersTriggerWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const TriggerButton = styled.button`
  cursor: pointer;
  color: var(--colour-dark);
  display: flex;
  align-items: center;
  gap: 0.25rem;

  &:hover {
    text-decoration: underline;
  }
`;

const DropdownContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const FilterButton = styled.button<{ $isActive: boolean }>`
  cursor: pointer;
  color: var(--colour-dark);
  text-decoration: ${(props) => (props.$isActive ? "underline" : "none")};

  &:hover {
    text-decoration: underline;
  }
`;

const categories: FilterCategory[] = [
  "All",
  "Photography",
  "Cinematography",
  "Direction",
];

type Props = {
  onOpenChange?: (isOpen: boolean) => void;
};

const FiltersTrigger = (props: Props) => {
  const { onOpenChange } = props;
  const { activeCategories, setActiveCategories } = useGalleryFilter();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null!);

  useClickOutside(wrapperRef, () => {
    setIsOpen(false);
  });

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  const selectedCategory: FilterCategory =
    activeCategories.length > 0 && activeCategories[0] !== "All"
      ? activeCategories[0]
      : "All";

  const handleCategoryClick = (category: FilterCategory) => {
    setActiveCategories([category]);
    setIsOpen(false);
  };

  const getIsActive = (category: FilterCategory): boolean => {
    if (category === "All") {
      return activeCategories.length === 0 || activeCategories.includes("All");
    }
    return activeCategories.includes(category);
  };

  return (
    <FiltersTriggerWrapper ref={wrapperRef}>
      {!isOpen && (
        <TriggerButton
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="type-header"
        >
          Filters [{selectedCategory}]
        </TriggerButton>
      )}
      {isOpen && (
        <DropdownContainer>
          {categories.map((category) => {
            const isActive = getIsActive(category);

            return (
              <FilterButton
                key={category}
                type="button"
                $isActive={isActive}
                onClick={() => handleCategoryClick(category)}
                className="type-header"
              >
                {category}
              </FilterButton>
            );
          })}
        </DropdownContainer>
      )}
    </FiltersTriggerWrapper>
  );
};

export default FiltersTrigger;
