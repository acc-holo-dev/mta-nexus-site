export interface DomainEventActor {
  id: string;
  type: "user" | "server" | "system" | "organization";
  ipAddress?: string;
  userAgent?: string;
}

export interface DomainEvent<TType extends string = string, TPayload = unknown> {
  id: string;
  type: TType;
  version: number;
  timestamp: string; // ISO 8601
  actor: DomainEventActor;
  aggregateId: string;
  aggregateType: string;
  payload: TPayload;
  correlationId?: string;
  causationId?: string;
}

// Event Type Definitions
export type ProductCreatedEvent = DomainEvent<
  "product.created",
  { productId: string; title: string; authorId: string; type: string; price: number }
>;

export type ProductPublishedEvent = DomainEvent<
  "product.published",
  { productId: string; title: string; authorId: string; version: string }
>;

export type ProductUpdatedEvent = DomainEvent<
  "product.updated",
  { productId: string; updatedFields: string[] }
>;

export type BuildSubmittedForReviewEvent = DomainEvent<
  "build.submitted_for_review",
  { buildId: string; productId: string; version: string; hash: string }
>;

export type BuildReleasedEvent = DomainEvent<
  "build.released",
  { buildId: string; productId: string; version: string; hash: string }
>;

export type ServerCreatedEvent = DomainEvent<
  "server.created",
  {
    serverId: string;
    name: string;
    ownerId?: string;
    organizationId?: string;
    ip: string;
    port: number;
  }
>;

export type ServerUpdatedEvent = DomainEvent<
  "server.updated",
  { serverId: string; updatedFields: string[] }
>;

export type ServerObservedEvent = DomainEvent<
  "server.observed",
  { serverId: string; source: "mta_master" | "mta_query"; observedAt: string }
>;

export type OrderCreatedEvent = DomainEvent<
  "order.created",
  { orderId: string; buyerId: string; totalAmount: number; currency: string; items: { productId: string; price: number }[] }
>;

export type PaymentCompletedEvent = DomainEvent<
  "payment.completed",
  { paymentId: string; orderId: string; amount: number; transactionId: string }
>;

export type LicenseIssuedEvent = DomainEvent<
  "license.issued",
  { licenseId: string; productId: string; buyerId: string; serverId?: string; key: string }
>;

export type LicenseRevokedEvent = DomainEvent<
  "license.revoked",
  { licenseId: string; reason: string }
>;

export type ArticlePublishedEvent = DomainEvent<
  "article.published",
  { articleId: string; title: string; authorId: string; slug: string }
>;

export type UserFollowedEvent = DomainEvent<
  "user.followed",
  { followerId: string; targetId: string; targetType: "user" | "server" | "product" }
>;

export type NexusDomainEvent =
  | ProductCreatedEvent
  | ProductPublishedEvent
  | ProductUpdatedEvent
  | BuildSubmittedForReviewEvent
  | BuildReleasedEvent
  | ServerCreatedEvent
  | ServerUpdatedEvent
  | ServerObservedEvent
  | OrderCreatedEvent
  | PaymentCompletedEvent
  | LicenseIssuedEvent
  | LicenseRevokedEvent
  | ArticlePublishedEvent
  | UserFollowedEvent;

export interface EventBus {
  publish<E extends NexusDomainEvent>(event: E): Promise<void>;
  subscribe<TType extends NexusDomainEvent["type"]>(
    type: TType,
    handler: (event: Extract<NexusDomainEvent, { type: TType }>) => Promise<void>
  ): () => void;
}

type EventHandler = (event: NexusDomainEvent) => Promise<void>;

export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, EventHandler[]>();

  async publish<E extends NexusDomainEvent>(event: E): Promise<void> {
    const list = this.handlers.get(event.type) || [];
    const wildcard = this.handlers.get("*") || [];
    await Promise.allSettled([...list, ...wildcard].map((handler) => handler(event)));
  }

  subscribe<TType extends NexusDomainEvent["type"]>(
    type: TType,
    handler: (event: Extract<NexusDomainEvent, { type: TType }>) => Promise<void>
  ): () => void {
    const wrapped: EventHandler = (event) =>
      handler(event as Extract<NexusDomainEvent, { type: TType }>);
    const existing = this.handlers.get(type) || [];
    this.handlers.set(type, [...existing, wrapped]);

    return () => {
      const current = this.handlers.get(type) || [];
      this.handlers.set(
        type,
        current.filter((h) => h !== wrapped),
      );
    };
  }
}

export const eventBus = new InMemoryEventBus();
