# Free resource acquisition

RESOURCE-007 tightens the closed-beta J5 free-resource acquisition path.

## User journey

The public resource page sends a user to the free acquisition page.

For a free published resource, that page calls:

```text
POST /api/resources/claim
```

It does not call the disabled paid checkout endpoint.

After a successful or idempotent claim, the UI now links directly to:

- the claimed resource page;
- the workspace resource library.

The previous **Go to My Licenses** label pointed at a legacy route that immediately redirected to the workspace. Free claims create direct download entitlements, not paid licenses, so the new wording matches the actual data model.

## Idempotency

`EntitlementRepository.claimFreeResource` serializes a claim by user + product with a PostgreSQL advisory transaction lock.

Inside the same transaction it:

1. re-reads the product;
2. requires the resource to exist and be published;
3. requires price = 0;
4. checks for an existing `product.download` entitlement;
5. returns the existing entitlement when already claimed;
6. otherwise inserts one entitlement;
7. increments `products.salesCount` once.

The RESOURCE-007 integration test issues 10 concurrent claim attempts for the same user/resource and requires:

- exactly one new claim;
- nine idempotent existing-claim responses;
- exactly one direct entitlement;
- `salesCount = 1`;
- entitlement access for the claiming user;
- no entitlement access for another user.

## Scope boundary

This is DB/service-level idempotency plus the current acquisition UI contract.

It does not yet prove the full browser/HTTP J5 acceptance matrix. That still needs executable evidence for:

- anonymous claim denial;
- claim HTTP 201 followed by retry HTTP 200;
- download HTTP response and bytes;
- another user's download denial;
- unpublished/suspended resource denial;
- retired/unpublished build denial;
- narrow-screen/keyboard/RU acceptance.

Those remain open until the Actions runner blocker is resolved and browser acceptance can execute.
