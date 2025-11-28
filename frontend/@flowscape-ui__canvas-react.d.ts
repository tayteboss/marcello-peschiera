declare module "@flowscape-ui/canvas-react" {
  import * as React from "react";

  export interface CanvasNode {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    data?: unknown;
  }

  export interface CanvasProps {
    nodes: CanvasNode[];
    children?: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
    tabIndex?: number;
  }

  export const Canvas: React.ForwardRefExoticComponent<
    CanvasProps & React.RefAttributes<HTMLDivElement | null>
  >;

  export interface NodeViewProps {
    node: CanvasNode;
    children?: React.ReactNode;
    className?: string;
    /**
     * When true, disables the default visuals so you can fully control styling.
     */
    unstyled?: boolean;
  }

  export const NodeView: React.FC<NodeViewProps>;

  export interface CanvasNavigationOptions {
    wheelBehavior?: "auto" | "zoom" | "pan";
    wheelZoom?: boolean;
    wheelModifier?: "none" | "alt" | "ctrl";
    touchpadZoomSensitivityIn?: number;
    touchpadZoomSensitivityOut?: number;
    mouseZoomSensitivityIn?: number;
    mouseZoomSensitivityOut?: number;
    mousePanScale?: number;
    touchpadPanScale?: number;
    doubleClickZoom?: boolean;
    doubleClickZoomFactor?: number;
    doubleClickZoomOut?: boolean;
    doubleClickZoomOutModifier?: "alt" | "ctrl";
    doubleClickZoomOutFactor?: number;
    keyboardPan?: boolean;
    keyboardPanStep?: number;
    keyboardPanSlowStep?: number;
    panButton?: 0 | 1 | 2;
    panModifier?: "none" | "alt" | "ctrl";
  }

  export function useCanvasNavigation(
    ref: React.RefObject<HTMLDivElement | null>,
    options?: CanvasNavigationOptions
  ): void;
}


