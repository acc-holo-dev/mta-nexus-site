import type { ReactElement, ReactNode } from "react";

export type FlatTestElement = ReactElement<Record<string, unknown>>;
/** @deprecated Use FlatTestElement */
export type FlattenedElement = FlatTestElement;

function componentName(type: FlatTestElement["type"]): string | undefined {
  if (typeof type === "string") return type;
  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName ?? fn.name;
  }
  if (typeof type === "object" && type !== null) {
    return (type as { displayName?: string }).displayName;
  }
  return undefined;
}

/** Flattens a static React element tree for interaction tests (Button + ActionConfirmCheckbox). */
export function flattenReactTestTree(node: ReactNode): FlatTestElement[] {
  if (Array.isArray(node)) return node.flatMap(flattenReactTestTree);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as FlatTestElement;
  const name = componentName(element.type);
  if (name === "Button") {
    return [
      { ...element, type: "button" } as FlatTestElement,
      ...flattenReactTestTree(element.props.children as ReactNode),
    ];
  }
  if (name === "ActionConfirmCheckbox") {
    const props = element.props as {
      id: string;
      checked: boolean;
      disabled?: boolean;
      onCheckedChange: (checked: boolean) => void;
      children: ReactNode;
    };
    return [
      {
        type: "input",
        props: {
          type: "checkbox",
          id: props.id,
          checked: props.checked,
          disabled: props.disabled,
          onChange: (event: { target: { checked: boolean } }) =>
            props.onCheckedChange(event.target.checked),
        },
      } as unknown as FlatTestElement,
      ...flattenReactTestTree(props.children),
    ];
  }
  if (name === "GuestAuthLinks") {
    const type = element.type as (props: Record<string, unknown>) => ReactNode;
    return flattenReactTestTree(type(element.props));
  }
  if (name === "ErrorState") {
    const type = element.type as (props: Record<string, unknown>) => ReactNode;
    return [element, ...flattenReactTestTree(type(element.props))];
  }
  return [element, ...flattenReactTestTree(element.props.children as ReactNode)];
}

export function findTestButton(nodes: FlatTestElement[], label: string): FlatTestElement {
  const found = nodes.find((node) => node.type === "button" && node.props.children === label);
  if (!found) throw Error(`Missing ${label}`);
  return found;
}

/** True when a flattened tree surfaces `message` via ErrorState title/description or string children. */
export function flatTreeHasErrorText(nodes: FlatTestElement[], message: string): boolean {
  return nodes.some((node) => {
    const title = node.props.title;
    const description = node.props.description;
    if (typeof title === "string" && title.includes(message)) return true;
    if (typeof description === "string" && description.includes(message)) return true;
    const children = node.props.children;
    return typeof children === "string" && children.includes(message);
  });
}

export function clickTestButton(nodes: FlatTestElement[], label: string) {
  return (findTestButton(nodes, label).props.onClick as () => void)();
}
