import {
  Bell,
  BookMarked,
  Bookmark,
  BookOpen,
  Code2,
  Compass,
  Home,
  LayoutDashboard,
  Library,
  LifeBuoy,
  MessageSquare,
  Plus,
  Server,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { getUserPlatformCopy } from "../../community/user-platform-copy";
import { getOrganizationCopy } from "../../organizations/organization-workspace-copy";
import { getManagedServerCopy } from "../../servers/managed-server-copy";
import { publicationDestinations } from "./shell-publication-destinations";

/** A single source for shared destinations; layouts retain their own labels and ordering. */
export function shellNavigation(locale: Locale) {
  const dictionary = getDictionary(locale);
  const common = {
    home: { href: "/", label: dictionary.nav.home, icon: Home },
    servers: { href: "/servers", label: dictionary.nav.liveServers, icon: Server },
    discover: { href: "/discover", label: dictionary.nav.explore, icon: Compass },
    market: { href: "/market", label: dictionary.nav.freeResources, icon: Library },
    community: { href: "/community", label: dictionary.nav.community, icon: MessageSquare },
    articles: { href: "/articles", label: dictionary.nav.updates, icon: BookOpen },
    developers: { href: "/developers", label: dictionary.nav.creators, icon: Code2 },
    support: { href: "/support", label: dictionary.nav.support, icon: LifeBuoy },
    overview: { href: "/workspace", label: dictionary.nav.overview, icon: LayoutDashboard },
    library: {
      href: "/workspace/library",
      label: dictionary.workspace.libraryTitle,
      icon: BookMarked,
    },
    saved: { href: "/workspace/saved", label: dictionary.nav.saved, icon: Bookmark },
    studio: {
      href: "/workspace/content",
      label: getUserPlatformCopy(locale).studio,
      icon: BookOpen,
    },
    publish: {
      href: "/workspace/resources/new",
      label: dictionary.nav.publishResource,
      icon: Plus,
    },
    managedServers: {
      href: "/workspace/servers",
      label: getManagedServerCopy(locale).title,
      icon: Server,
    },
    registerServer: {
      href: "/workspace/servers/new",
      label: dictionary.nav.registerServer,
      icon: Server,
    },
    organizations: {
      href: "/workspace/organizations",
      label: getOrganizationCopy(locale).title,
      icon: Users,
    },
    notifications: { href: "/notifications", label: dictionary.nav.notifications, icon: Bell },
    security: { href: "/security", label: dictionary.nav.securityCenter, icon: ShieldCheck },
    settings: { href: "/settings", label: dictionary.nav.settings, icon: Settings },
  };
  const library = [common.overview, common.library, common.saved, common.studio, common.publish];
  const servers = [common.managedServers, common.registerServer, common.organizations];
  const publications = publicationDestinations(locale);
  return {
    primary: [
      common.servers,
      common.discover,
      common.market,
      common.community,
      common.articles,
      common.developers,
      common.support,
    ],
    library,
    servers,
    publications,
    account: [common.notifications, common.security, common.settings],
    mobilePrimary: [
      common.home,
      common.servers,
      { ...common.market, label: dictionary.nav.mobileMarket },
      common.community,
    ],
    mobilePublic: [common.discover, common.articles, common.developers, common.support],
    mobileWorkspace: [
      { ...common.overview, label: dictionary.nav.mobileWorkspace },
      ...library.slice(1),
      common.managedServers,
      { ...common.registerServer, icon: Plus },
      common.organizations,
      ...publications,
      common.notifications,
      common.settings,
      common.security,
    ],
  };
}
