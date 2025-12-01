import styled from "styled-components";
import Header from "../common/Header";
import { ReactNode, useState, useRef } from "react";
import { GalleryFilterProvider } from "../../shared/context/context";
import InfoModal from "../block/InfoModal";
import { SiteSettingsType } from "@/shared/types/types";
import Loading from "../block/Loading";

const siteSettings: SiteSettingsType = require("../../json/siteSettings.json");

const Main = styled.main``;

type Props = {
  children: ReactNode;
};

const Layout = (props: Props) => {
  const { children } = props;

  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const infoTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <GalleryFilterProvider>
      <Loading />
      <Header
        onInfoClick={() => setIsInfoModalOpen(!isInfoModalOpen)}
        infoIsOpen={isInfoModalOpen}
        infoTriggerRef={infoTriggerRef}
      />
      <InfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        siteSettings={siteSettings}
        infoTriggerRef={infoTriggerRef}
      />
      {/* <ReactLenis root> */}
      <Main>{children}</Main>
      {/* </ReactLenis> */}
    </GalleryFilterProvider>
  );
};

export default Layout;
