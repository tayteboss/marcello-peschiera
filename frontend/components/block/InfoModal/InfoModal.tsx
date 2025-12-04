import { useClickOutside } from "@/hooks/useClickOutside";
import { SiteSettingsType } from "@/shared/types/types";
import formatHTML from "@/utils/formatHTML";
import pxToRem from "@/utils/pxToRem";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import styled from "styled-components";

const InfoModalWrapper = styled(motion.section)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100dvh;
  z-index: 50;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  background: rgba(221, 255, 0, 0.6);
`;

const Inner = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${pxToRem(24)};
  max-width: ${pxToRem(870)};
  padding: ${pxToRem(16)};
  margin: 0 auto;
  cursor: default;
`;

const Biography = styled.div`
  * {
    text-align: center;
  }
`;

const Cell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;

  a {
    text-decoration: none;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const CellInner = styled.div`
  display: flex;
  gap: ${pxToRem(4)};
  justify-content: center;
`;

const Title = styled.h3``;

const wrapperVariants = {
  hidden: {
    opacity: 0,
    transition: {
      duration: 0.1,
      ease: "easeInOut",
    },
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.1,
      ease: "easeInOut",
    },
  },
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  siteSettings: SiteSettingsType;
  infoTriggerRef?: React.RefObject<HTMLButtonElement>;
};

const InfoModal = (props: Props) => {
  const { isOpen, onClose, siteSettings, infoTriggerRef } = props;
  const { biography, phone, email, instagramHandle, instagramLink } =
    siteSettings;

  const ref = useRef<HTMLDivElement>(null!);
  useClickOutside(
    ref,
    () => {
      onClose();
    },
    infoTriggerRef ? [infoTriggerRef] : undefined
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <InfoModalWrapper
          variants={wrapperVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="info-modal-wrapper"
        >
          <Inner ref={ref}>
            {biography && (
              <Biography
                dangerouslySetInnerHTML={{ __html: formatHTML(biography) }}
              />
            )}
            {phone && (
              <Cell>
                <Title className="type-p">Tel:</Title>
                <Link href={`tel:${phone}`} className="type-p">
                  {phone}
                </Link>
              </Cell>
            )}
            {email && (
              <Cell>
                <Title className="type-p">Email:</Title>
                <Link href={`mailto:${email}`} className="type-p">
                  {email}
                </Link>
              </Cell>
            )}
            {instagramHandle && (
              <Cell>
                <Title className="type-p">Instagram:</Title>
                {instagramLink && (
                  <Link
                    href={instagramLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="type-p"
                  >
                    {instagramHandle}
                  </Link>
                )}
              </Cell>
            )}
            <Cell>
              <Title className="type-p">Design & Development</Title>
              <CellInner>
                <Link
                  href="https://bienstudio.com.au"
                  className="type-p"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Bien Studio
                </Link>
                <span className="type-p">+</span>
                <Link
                  href="https://tayte.c0"
                  className="type-p"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Tayte.co
                </Link>
              </CellInner>
            </Cell>
          </Inner>
        </InfoModalWrapper>
      )}
    </AnimatePresence>
  );
};

export default InfoModal;
