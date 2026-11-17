import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getRequestLocale } from "../../../lib/i18n-server";
import {
  collectionHref,
  collectionId,
  collectionPageParams,
} from "../../../lib/library-collections-query";
import { authService } from "../../../lib/services/auth-service";
import { LibraryCollectionsCopyView } from "./library-collections-copy-view";
import { LibraryCollectionsDetailView } from "./library-collections-detail-view";
import { LibraryCollectionsErrorPanel } from "./library-collections-error-panel";
import { LibraryCollectionsHistoryView } from "./library-collections-history-view";
import { LibraryCollectionsItemTransferView } from "./library-collections-item-transfer-view";
import { LibraryCollectionsListView } from "./library-collections-list-view";
import {
  guestCollectionsReturnPath,
  type LibraryCollectionsActor,
  type LibraryCollectionsQuery,
  type LibraryCollectionsView,
} from "./library-collections-screen-shared";
import { PlatformSignIn } from "../../shell/guest-auth";
import { PlatformSessionError } from "../../shell/session-error";
import { libraryCollectionsCopy } from "../library-collections-i18n";

export async function LibraryCollectionsScreen({
  view = "list",
  searchParams,
  params,
}: {
  view?: LibraryCollectionsView;
  searchParams: Promise<LibraryCollectionsQuery>;
  params?: Promise<{ id: string }>;
}) {
  const [locale, queryValues, path] = await Promise.all([getRequestLocale(), searchParams, params]);
  const routeCollectionId = path?.id;
  let session: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    session = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    let retryHref = "/workspace/library/collections";
    try {
      if (routeCollectionId) collectionId(routeCollectionId);
      retryHref = guestCollectionsReturnPath(view, queryValues, routeCollectionId);
    } catch {
      // Malformed routes and filters return to the collections list.
    }
    const copy = libraryCollectionsCopy(locale);
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.title}
        message={copy.loadUnavailable}
        retryHref={retryHref}
      />
    );
  }
  if (!session) {
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={guestCollectionsReturnPath(view, queryValues, routeCollectionId)}
      />
    );
  }
  const actor: LibraryCollectionsActor = session;
  try {
    if (view === "copy" && collectionPageParams(queryValues).size)
      throw new AppError("Unexpected copy query", 400, "COLLECTION_INVALID");
    if (view === "list") {
      return await LibraryCollectionsListView({ locale, actor, queryValues });
    }
    const id = collectionId(path?.id ?? "");
    if (view === "copy-items" || view === "move-items") {
      return await LibraryCollectionsItemTransferView({
        locale,
        actor,
        id,
        view,
        queryValues,
      });
    }
    if (view === "copy") {
      return await LibraryCollectionsCopyView({ locale, actor, id });
    }
    if (view === "history") {
      return await LibraryCollectionsHistoryView({ locale, actor, id, queryValues });
    }
    return await LibraryCollectionsDetailView({
      locale,
      actor,
      id,
      adding: view === "add",
      queryValues,
    });
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.statusCode === 404) notFound();
    if (error.code === "COLLECTION_ARCHIVED" && path?.id) redirect(collectionHref(path.id));
    return (
      <LibraryCollectionsErrorPanel locale={locale} code={error.code} collectionId={path?.id} />
    );
  }
}
