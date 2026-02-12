import { useState, useEffect } from "react";
import styled from "styled-components";
import Logo from "../../svg/Logo";
import pxToRem from "../../../utils/pxToRem";
import DuoToneSwitchTrigger from "../../elements/DuoToneSwitchTrigger";
import FiltersTrigger from "../../elements/FiltersTrigger";
import { motion, useAnimationControls } from "framer-motion";
import useViewportWidth from "@/hooks/useViewportWidth";
import { theme } from "../../../styles/theme";

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
  color: var(--colour-dark);

  body.remove-duotone & {
    color: var(--colour-light);
  }

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

  body.remove-duotone & {
    color: var(--colour-light);
  }

  @media ${(props) => props.theme.mediaBreakpoints.tabletPortrait} {
    display: none;
  }
`;

const InfoTrigger = styled.button<{ $isHidden: boolean }>`
  color: var(--colour-dark);
  display: ${(props) => (props.$isHidden ? "none" : "block")};

  body.remove-duotone & {
    color: var(--colour-light);
  }

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
  const [isDuoToneActive, setIsDuoToneActive] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const viewport = useViewportWidth();
  const isMobile = viewport === "mobile" || viewport === "tabletPortrait";

  const logoControls = useAnimationControls();

  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const body = document.body;

    // Logic:
    // DuoTone OFF -> Always Light Mode
    // DuoTone ON -> Follow isDarkMode
    const effectiveDarkMode = isDuoToneActive && isDarkMode;

    if (effectiveDarkMode) {
      // Set to Dark Mode
      // --colour-light becomes Dark Color
      // --colour-dark becomes Light Color
      root.style.setProperty("--colour-light", theme.colours.dark);
      root.style.setProperty("--colour-dark", theme.colours.light);

      body.classList.remove("light-mode");
      body.classList.add("dark-mode");
    } else {
      // Set to Light Mode
      // --colour-light becomes Light Color
      // --colour-dark becomes Dark Color
      root.style.setProperty("--colour-light", theme.colours.light);
      root.style.setProperty("--colour-dark", theme.colours.dark);

      body.classList.remove("dark-mode");
      body.classList.add("light-mode");
    }

    // Handle DuoTone class (for image filtering)
    // isDuoToneActive (true) -> remove "remove-duotone" (Filter Active)
    // !isDuoToneActive (false) -> add "remove-duotone" (Filter Inactive)
    if (isDuoToneActive) {
      body.classList.remove("remove-duotone");
    } else {
      body.classList.add("remove-duotone");
    }

    // Dispatch event (Copied from DuoToneSwitchTrigger logic)
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("duotone-toggle", {
          detail: { isDuotoneOff: !isDuoToneActive },
        })
      );
    }
  }, [isDuoToneActive, isDarkMode]);

  const handleLightSwitch = () => {
    if (isMobile) {
      logoControls.start({
        rotate: [0, 360],
        transition: { duration: 1, ease: "easeInOut" },
      });
    }

    if (!isDuoToneActive) {
      setIsDuoToneActive(true);
      setIsDarkMode(true);
    } else {
      setIsDarkMode((prev) => !prev);
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
        <DuoToneSwitchTrigger
          isHidden={filtersIsOpen}
          isActive={isDuoToneActive}
          onToggle={() => setIsDuoToneActive((prev) => !prev)}
        />
      </Nav>
    </HeaderWrapper>
  );
};

export default Header;
