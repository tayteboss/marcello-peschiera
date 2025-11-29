import styled from "styled-components";
import { NextSeo } from "next-seo";
import {
  ProjectType,
  SiteSettingsType,
  TransitionsType,
} from "../shared/types/types";
import { motion } from "framer-motion";
import client from "../client";
import {
  projectsQueryString,
  siteSettingsQueryString,
} from "../lib/sanityQueries";
import Canvas from "../components/block/Canvas";
import InfiniteCanvas from "../components/block/InfiniteCanvas";
import InfiniteCanvas2 from "../components/block/InfiniteCanvas2";
import InfiniteCanvas3 from "../components/block/InfiniteCanvas3";
import InfiniteCanvas4 from "../components/block/InfiniteCanvas4";
import Header from "@/components/common/Header";

const PageWrapper = styled(motion.div)``;

type Props = {
  projects: ProjectType[];
  siteSettings: SiteSettingsType;
  pageTransitionVariants: TransitionsType;
};

const Page = (props: Props) => {
  const { siteSettings, pageTransitionVariants } = props;

  return (
    <PageWrapper
      variants={pageTransitionVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      className="performance"
    >
      <NextSeo
        title={siteSettings?.seoTitle || ""}
        description={siteSettings?.seoDescription || ""}
      />
      <InfiniteCanvas4 />
    </PageWrapper>
  );
};

export async function getStaticProps() {
  const [siteSettingsResult, projectsResult] = await Promise.all([
    client.fetch(siteSettingsQueryString),
    client.fetch(projectsQueryString),
  ]);

  return {
    props: {
      siteSettings: (siteSettingsResult ?? {}) as SiteSettingsType,
      projects: (projectsResult ?? []) as ProjectType[],
    },
  };
}

export default Page;
