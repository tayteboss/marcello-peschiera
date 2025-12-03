import { NextSeo } from "next-seo";
import styled from "styled-components";
import LayoutWrapper from "../components/layout/LayoutWrapper";
import pxToRem from "../utils/pxToRem";

const PageWrapper = styled.div``;

const Inner = styled.div`
  padding: ${pxToRem(100)} 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
`;

const Title = styled.h2``;

const Page = () => {
  return (
    <PageWrapper>
      <NextSeo title="404 | Sorry we couldn't find that page" />
      <LayoutWrapper>
        <Inner>
          <Title className="type-header">
            Sorry, we couldn't find that page
          </Title>
        </Inner>
      </LayoutWrapper>
    </PageWrapper>
  );
};

export default Page;
