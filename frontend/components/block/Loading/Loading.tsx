import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import styled from "styled-components";

const LoadingWrapper = styled(motion.section)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--colour-light);
  color: var(--colour-dark);
  z-index: 10000;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
`;

const wrapperVariants = {
  hidden: {
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: "easeInOut",
    },
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: "easeInOut",
    },
  },
};

const Loading = () => {
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsActive(false);
    }, 1250);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Notify other parts of the app (e.g. InfiniteCanvas) when the loading
  // overlay has fully dismissed so they can trigger intro animations.
  useEffect(() => {
    if (!isActive && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("loading-complete"));
    }
  }, [isActive]);

  return (
    <AnimatePresence>
      {isActive && (
        <LoadingWrapper
          className="type-header"
          onClick={() => setIsActive(false)}
          variants={wrapperVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          Marcello Peschiera™
        </LoadingWrapper>
      )}
    </AnimatePresence>
  );
};

export default Loading;
