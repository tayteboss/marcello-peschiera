import styled from "styled-components";
import Header from "../common/Header";
import { ReactNode } from "react";
import { GalleryFilterProvider } from "../../shared/context/context";
// import { ReactLenis, useLenis } from "@studio-freight/react-lenis";
// import { SiteSettingsType } from "../../shared/types/types";

// const siteSettings: SiteSettingsType = require("../../json/siteSettings.json");

const Main = styled.main``;

type Props = {
  children: ReactNode;
};

const Layout = (props: Props) => {
  const { children } = props;

  // useLenis();

  return (
    <GalleryFilterProvider>
      <Header />
      {/* <ReactLenis root> */}
      <Main>{children}</Main>
      {/* </ReactLenis> */}
    </GalleryFilterProvider>
  );
};

export default Layout;
