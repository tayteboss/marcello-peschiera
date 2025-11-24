import styled from "styled-components";

type Props = {
  data: any;
};

const PageBuilderWrapper = styled.div``;

const PageBuilder = (props: Props) => {
  const { data } = props;

  const sections: any = {
    // headingBlockPB: HeadingBlock,
  };

  return (
    <PageBuilderWrapper className="page-builder">
      {data &&
        data.map((section: any, i: number) => {
          {
            if (!sections[section.component]) {
              return (
                <div key={Math.random() * 10000}>
                  No section found for {section.component}
                </div>
              );
            } else {
              const Component = sections[section.component];
              return (
                <Component key={`${section.component}-${i}`} {...section} />
              );
            }
          }
        })}
    </PageBuilderWrapper>
  );
};

export default PageBuilder;
