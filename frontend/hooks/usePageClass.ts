import { useEffect } from "react";
import { useRouter } from "next/router";

const usePageClass = (): void => {
  const router = useRouter();

  useEffect(() => {
    // Remove any existing page classes
    document.body.classList.forEach((className) => {
      if (className.startsWith("page-")) {
        document.body.classList.remove(className);
      }
    });

    // Get the pathname and create a class name
    const pathname = router.pathname;
    const pageClass = `page-${pathname === "/" ? "home" : pathname.slice(1).replace(/\//g, "-")}`;

    // Add the new page class
    document.body.classList.add(pageClass);

    // Cleanup function to remove the class when component unmounts
    return () => {
      document.body.classList.remove(pageClass);
    };
  }, [router.pathname]);
};

export default usePageClass;
