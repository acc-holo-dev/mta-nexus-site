import { Search } from "lucide-react";
import * as React from "react";
import { Input, type InputProps } from "./input";

export interface SearchFieldProps extends Omit<InputProps, "type" | "leadingIcon"> {
  /** Search purpose. Visible by default and used as the input's accessible name. */
  label: string;
}

/** Consistent search input semantics and affordance for server and client forms. */
export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>((props, ref) => (
  <Input {...props} ref={ref} type="search" leadingIcon={<Search className="h-4 w-4" />} />
));

SearchField.displayName = "SearchField";
