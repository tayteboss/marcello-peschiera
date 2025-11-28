declare module "react-infinite-canvas" {
  import * as React from "react";

  export interface ReactInfiniteCanvasHandle {
    /**
     * Fit the current content into view. The exact behavior is defined by
     * the `react-infinite-canvas` library, but typically this will reset
     * the transform so that all children are visible.
     */
    fitContentToView: (options?: { scale?: number }) => void;
  }

  export interface ReactInfiniteCanvasProps {
    children: React.ReactNode;
    minZoom?: number;
    maxZoom?: number;
    /**
     * When true, scroll wheel pans instead of zooming the canvas.
     */
    panOnScroll?: boolean;
    scrollBarConfig?: {
      renderScrollBar?: boolean;
      startingPosition?: { x: number; y: number };
      offset?: { x: number; y: number };
      color?: string;
      thickness?: string;
      minSize?: string;
    };
    customComponents?: Array<{
      component: React.ReactNode;
      position: unknown;
      offset?: { x: number; y: number };
    }>;
    onCanvasMount?: (handle: ReactInfiniteCanvasHandle) => void;
  }

  export const ReactInfiniteCanvas: React.ForwardRefExoticComponent<
    ReactInfiniteCanvasProps &
      React.RefAttributes<ReactInfiniteCanvasHandle | null>
  >;
}


