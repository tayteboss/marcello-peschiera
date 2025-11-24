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

const PageWrapper = styled(motion.div)``;

type Props = {
  projects: ProjectType[];
  siteSettings: SiteSettingsType;
  pageTransitionVariants: TransitionsType;
};

const Page = (props: Props) => {
  const { projects, siteSettings, pageTransitionVariants } = props;

  return (
    <PageWrapper
      variants={pageTransitionVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
    >
      <NextSeo
        title={siteSettings?.seoTitle || ""}
        description={siteSettings?.seoDescription || ""}
      />
      Home
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
