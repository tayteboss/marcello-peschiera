import styled from "styled-components";
import Logo from "../../svg/Logo";
import pxToRem from "../../../utils/pxToRem";
import DuoToneSwitchTrigger from "../../elements/DuoToneSwitchTrigger";
import FiltersTrigger from "../../elements/FiltersTrigger";
import { motion } from "framer-motion";

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
`;

const LogoWrapper = styled(motion.button)`
  cursor: pointer;
  pointer-events: auto;

  svg {
    width: ${pxToRem(87)};
    height: ${pxToRem(87)};
  }
`;

const Nav = styled.div`
  display: flex;
  align-items: center;
  gap: ${pxToRem(20)};
  pointer-events: auto;
`;

const TextLogo = styled.p`
  color: var(--colour-dark);
`;

const InfoTrigger = styled.button`
  color: var(--colour-dark);

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

  const handleLightSwitch = () => {
    // Get the :root element
    const root = document.documentElement;

    // Get the current values of --colour-light and --colour-dark
    const currentLight =
      getComputedStyle(root).getPropertyValue("--colour-light");
    const currentDark =
      getComputedStyle(root).getPropertyValue("--colour-dark");

    // Swap them by setting the CSS variables
    root.style.setProperty("--colour-light", currentDark);
    root.style.setProperty("--colour-dark", currentLight);
  };

  return (
    <HeaderWrapper className="header">
      <LogoWrapper
        onClick={() => handleLightSwitch()}
        whileHover={{
          rotate: 360,
          transition: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
        }}
      >
        <Logo />
      </LogoWrapper>
      <Nav>
        <TextLogo className="type-header">Marcello Peschiera™</TextLogo>
        <InfoTrigger
          ref={infoTriggerRef}
          onClick={onInfoClick}
          className="type-header"
        >
          {infoIsOpen ? "Close" : "Info"}
        </InfoTrigger>
        <FiltersTrigger />
        <DuoToneSwitchTrigger />
      </Nav>
    </HeaderWrapper>
  );
};

export default Header;
