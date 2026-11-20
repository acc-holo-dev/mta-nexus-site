import "./globals.css";
import { rootLayoutMetadata } from "../features/shell/root-layout-metadata-server";
import { RootLayout as ShellRootLayout } from "../features/shell/root-layout-server";

export const generateMetadata = rootLayoutMetadata;

export default ShellRootLayout;
