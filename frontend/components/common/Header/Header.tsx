import { useState } from "react";
import styled from "styled-components";
import Logo from "../../svg/Logo";
import pxToRem from "../../../utils/pxToRem";
import DuoToneSwitchTrigger from "../../elements/DuoToneSwitchTrigger";
import FiltersTrigger from "../../elements/FiltersTrigger";
import { motion, useAnimationControls } from "framer-motion";
import useViewportWidth from "@/hooks/useViewportWidth";

const HeaderWrapper = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  padding: ${pxToRem(20)};
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  pointer-events: none;

  @media ${(props) => props.theme.mediaBreakpoints.tabletPortrait} {
    height: 100dvh;
    flex-direction: column-reverse;
    align-items: center;
  }
`;

const LogoWrapper = styled(motion.button)`
  cursor: pointer;
  pointer-events: auto;

  svg {
    width: ${pxToRem(87)};
    height: ${pxToRem(87)};

    @media ${(props) => props.theme.mediaBreakpoints.tabletPortrait} {
      width: ${pxToRem(64)};
      height: ${pxToRem(64)};
    }
  }
`;

const Nav = styled.div`
  display: flex;
  align-items: center;
  gap: ${pxToRem(20)};
  pointer-events: auto;

  @media ${(props) => props.theme.mediaBreakpoints.tabletPortrait} {
    width: 100%;
    justify-content: space-between;
  }
`;

const TextLogo = styled.p<{ $isHidden: boolean }>`
  color: var(--colour-dark);
  display: ${(props) => (props.$isHidden ? "none" : "block")};

  @media ${(props) => props.theme.mediaBreakpoints.tabletPortrait} {
    display: none;
  }
`;

const InfoTrigger = styled.button<{ $isHidden: boolean }>`
  color: var(--colour-dark);
  display: ${(props) => (props.$isHidden ? "none" : "block")};

  @media ${(props) => props.theme.mediaBreakpoints.tabletPortrait} {
    order: 1;
    flex: 1;
    text-align: left;
  }

  &:hover {
    text-decoration: underline;
  }
`;

type Props = {
  onInfoClick: () => void;
  infoIsOpen: boolean;
  infoTriggerRef?: React.RefObject<HTMLButtonElement>;
};

const Header = (props: Props) => {
  const { onInfoClick, infoIsOpen, infoTriggerRef } = props;

  const [filtersIsOpen, setFiltersIsOpen] = useState(false);

  const viewport = useViewportWidth();
  const isMobile = viewport === "mobile" || viewport === "tabletPortrait";

  const logoControls = useAnimationControls();

  const handleLightSwitch = () => {
    if (isMobile) {
      logoControls.start({
        rotate: [0, 360],
        transition: { duration: 1, ease: "easeInOut" },
      });
    }

    // Get the :root element and the body
    const root = document.documentElement;
    const body = document.body;

    // Get the current values of --colour-light and --colour-dark
    const currentLight =
      getComputedStyle(root).getPropertyValue("--colour-light");
    const currentDark =
      getComputedStyle(root).getPropertyValue("--colour-dark");

    // Swap them by setting the CSS variables
    root.style.setProperty("--colour-light", currentDark);
    root.style.setProperty("--colour-dark", currentLight);

    // Toggle class on body for light/dark mode
    if (body.classList.contains("dark-mode")) {
      body.classList.remove("dark-mode");
      body.classList.add("light-mode");
    } else if (body.classList.contains("light-mode")) {
      body.classList.remove("light-mode");
      body.classList.add("dark-mode");
    } else {
      // If none set, assume starting light
      body.classList.add("dark-mode");
    }
  };

  return (
    <HeaderWrapper className="header">
      <LogoWrapper
        initial={{ rotate: 0 }}
        animate={logoControls}
        onClick={() => handleLightSwitch()}
        whileHover={
          !isMobile
            ? {
                rotate: 1080 * 2,
                transition: {
                  repeat: Infinity,
                  duration: 4,
                  ease: "easeInOut",
                },
              }
            : undefined
        }
      >
        <Logo />
      </LogoWrapper>
      <Nav>
        <TextLogo className="type-header" $isHidden={filtersIsOpen}>
          Marcello Peschiera™
        </TextLogo>
        <InfoTrigger
          ref={infoTriggerRef}
          onClick={onInfoClick}
          className="type-header"
          $isHidden={filtersIsOpen}
        >
          {infoIsOpen ? "Close" : "Info"}
        </InfoTrigger>
        <FiltersTrigger onOpenChange={setFiltersIsOpen} />
        <DuoToneSwitchTrigger isHidden={filtersIsOpen} />
      </Nav>
    </HeaderWrapper>
  );
};

export default Header;
