import styled from "styled-components";
import { motion } from "framer-motion";
import {
  FilterCategory,
  useGalleryFilter,
} from "../../../shared/context/context";

const FiltersTriggerWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const FilterButton = styled(motion.button)<{ $isActive: boolean }>`
  cursor: pointer;
  color: var(--colour-dark);
`;

const categories: FilterCategory[] = ["photo", "video", "mixed"];

const FiltersTrigger = () => {
  const { activeCategories, toggleCategory } = useGalleryFilter();

  return (
    <FiltersTriggerWrapper>
      {categories.map((category) => {
        const isActive = activeCategories.includes(category);

        return (
          <FilterButton
            key={category}
            type="button"
            $isActive={isActive}
            onClick={() => toggleCategory(category)}
            layout
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.65, 0, 0.35, 1] }}
          >
            {category}
          </FilterButton>
        );
      })}
    </FiltersTriggerWrapper>
  );
};

export default FiltersTrigger;
