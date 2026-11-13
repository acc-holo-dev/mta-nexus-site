export type ResourceQaThreadStatus = "open" | "resolved" | "removed";
export type ResourceQaAnswerStatus = "published" | "removed";

export type ResourceQaBuildContext = {
  version: string;
  /** True only when the referenced build is still a safe published artifact for this product. Never implies download entitlement. */
  available: boolean;
};

export type ResourceQaAuthor = {
  username: string;
  displayName: string;
};

export type ResourceQaAnswerView = {
  id: string;
  body: string;
  status: ResourceQaAnswerStatus;
  revision: number;
  createdAt: Date;
  updatedAt: Date | null;
  author: ResourceQaAuthor | null;
  isResolved: boolean;
};

export type ResourceQaThreadSummary = {
  id: string;
  body: string;
  status: ResourceQaThreadStatus;
  revision: number;
  answerCount: number;
  buildContext: ResourceQaBuildContext | null;
  resolvedAnswerId: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  author: ResourceQaAuthor | null;
};

export type ResourceQaThreadDetail = ResourceQaThreadSummary & {
  answers: ResourceQaAnswerView[];
  following: boolean;
  followRevision: number;
};

export type ResourceQaCapabilities = {
  canAsk: boolean;
  canAnswer: boolean;
  canResolve: boolean;
  canModerate: boolean;
  askReason: "ok" | "sign_in" | "resource_unavailable" | "access_required";
};

export type ResourceQaAskCommand = {
  action: "ask";
  body: string;
  buildId?: string | null;
};

export type ResourceQaAnswerCommand = {
  action: "answer";
  body: string;
  expectedThreadRevision: number;
};

export type ResourceQaResolveCommand =
  | {
      action: "resolve";
      answerId: string;
      expectedRevision: number;
    }
  | {
      action: "reopen";
      expectedRevision: number;
    };

export type ResourceQaFollowCommand = {
  action: "follow" | "unfollow";
  expectedRevision: number;
};

export type ResourceQaRemoveThreadCommand = {
  action: "remove";
  expectedRevision: number;
};

export type ResourceQaRemoveAnswerCommand = {
  action: "remove";
  expectedRevision: number;
};

export type ResourceQaNotificationData = {
  kind: "resource_qa";
  event: "asked" | "answered" | "resolved" | "removed";
  productId: string;
  /** Public catalogue title at delivery time; used for inbox localization. */
  productTitle: string;
  threadId: string;
  answerId?: string | null;
};
