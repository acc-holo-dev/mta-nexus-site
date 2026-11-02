import type { ReactElement, ReactNode } from "react";

export type FlattenedElement = ReactElement<Record<string, unknown>>;

type ElementType =
  | string
  | { displayName?: string }
  | (((props: unknown) => ReactNode) & { displayName?: string; name?: string });

function unwrapComponent(type: ElementType, props: Record<string, unknown>): ReactNode | null {
  if (typeof type === "function" && type.displayName === "ActionConfirmCheckbox") {
    return type(props);
  }
  if (
    typeof type === "function" &&
    (type.displayName === "GuestAuthLinks" || type.name === "GuestAuthLinks")
  ) {
    return type(props);
  }
  return null;
}

export function flattenReactTestTree(node: ReactNode): FlattenedElement[] {
  if (Array.isArray(node)) return node.flatMap(flattenReactTestTree);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as FlattenedElement;
  const type = element.type as ElementType;
  if (typeof type === "object" && type?.displayName === "Button") {
    return [
      { ...element, type: "button" } as FlattenedElement,
      ...flattenReactTestTree(element.props.children as ReactNode),
    ];
  }
  const unwrapped = unwrapComponent(type, element.props);
  if (unwrapped != null) {
    return flattenReactTestTree(unwrapped);
  }
  return [element, ...flattenReactTestTree(element.props.children as ReactNode)];
}
