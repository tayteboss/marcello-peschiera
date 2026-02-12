import { motion } from "framer-motion";
import styled from "styled-components";

const DuoToneSwitchTriggerWrapper = styled.button<{ $isHidden: boolean }>`
  /* Basic reset */
  border: none;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  @media ${(props) => props.theme.mediaBreakpoints.tabletPortrait} {
    display: ${(props) => (props.$isHidden ? "none" : "flex")};
    order: 2;
    align-items: center;
    flex: 1;
  }
`;

const ToggleTrack = styled.div`
  position: relative;
  width: 24px;
  /* Height is dot size (10px) + 2px padding top + 2px padding bottom = 14px */
  height: 14px;
  border-radius: 999px;
  background: var(--colour-dark);
`;

const ToggleKnob = styled(motion.div)`
  position: absolute;
  /* Track height is 14px, knob is 10px -> 2px padding top + 2px padding bottom */
  top: 2px;
  left: 2px; /* horizontal padding on the left */
  width: 10px;
  height: 10px;
  border-radius: 50%;

  /* Add your own knob colour/shadow here */
  background-color: var(--colour-light);
`;

const knobTransition = {
  type: "spring",
  stiffness: 500,
  damping: 20,
};

type Props = {
  isHidden: boolean;
  isActive: boolean;
  onToggle: () => void;
};

const DuoToneSwitchTrigger = (props: Props) => {
  const { isHidden, isActive, onToggle } = props;

  return (
    <DuoToneSwitchTriggerWrapper
      type="button"
      aria-pressed={isActive}
      onClick={onToggle}
      $isHidden={isHidden}
    >
      <ToggleTrack>
        <ToggleKnob
          animate={{
            x: isActive ? 0 : 24 - 2 - 2 - 10, // track width - left padding - right padding - knob size
          }}
          transition={knobTransition}
        />
      </ToggleTrack>
    </DuoToneSwitchTriggerWrapper>
  );
};

export default DuoToneSwitchTrigger;
