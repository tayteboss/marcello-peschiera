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
import InfiniteCanvas from "@/components/block/InfiniteCanvas";

const PageWrapper = styled(motion.div)``;

type Props = {
  projects: ProjectType[];
  siteSettings: SiteSettingsType;
  pageTransitionVariants: TransitionsType;
};

const Page = (props: Props) => {
  const { siteSettings, projects, pageTransitionVariants } = props;

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
      <InfiniteCanvas projects={projects} />
    </PageWrapper>
  );
};

export async function getStaticProps() {
  const [siteSettingsResult, projectsResult] = await Promise.all([
    client.fetch(siteSettingsQueryString),
    client.fetch(projectsQueryString),
  ]);

  const projects = (projectsResult ?? []) as ProjectType[];

  // Fisher-Yates shuffle
  for (let i = projects.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [projects[i], projects[j]] = [projects[j], projects[i]];
  }

  return {
    props: {
      siteSettings: (siteSettingsResult ?? {}) as SiteSettingsType,
      projects: projects,
    },
  };
}

export default Page;
