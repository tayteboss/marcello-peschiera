import { useState, useRef } from "react";
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

const FiltersTrigger = () => {
  const { activeCategories, setActiveCategories } = useGalleryFilter();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null!);

  useClickOutside(wrapperRef, () => {
    setIsOpen(false);
  });

  const selectedCategory: FilterCategory =
    activeCategories.length > 0 && activeCategories[0] !== "All"
      ? activeCategories[0]
      : "All";

  const handleCategoryClick = (category: FilterCategory) => {
    setActiveCategories([category]);
    setIsOpen(false);
  };

  return (
    <FiltersTriggerWrapper ref={wrapperRef}>
      {!isOpen && (
        <TriggerButton type="button" onClick={() => setIsOpen(!isOpen)}>
          {selectedCategory} ▼
        </TriggerButton>
      )}
      {isOpen && (
        <DropdownContainer>
          {categories.map((category) => {
            const isActive = activeCategories.includes(category);

            return (
              <FilterButton
                key={category}
                type="button"
                $isActive={isActive}
                onClick={() => handleCategoryClick(category)}
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
