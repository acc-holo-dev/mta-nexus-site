# MTA NEXUS — HTTP API Reference

## 1. Public Endpoints

### `GET /api/health`
Returns system status, active version, uptime, and database metrics.

### `GET /api/search?q=:query`
Unified search engine querying across Products, Servers, Articles, and Developers.

## 2. Commerce Endpoints

### `POST /api/checkout`
Initiates and authorizes order checkout. Validated using Zod `checkoutSchema`.
- **Payload:**
  ```json
  {
    "items": [{ "productId": "prd_inv_pro" }],
    "paymentProvider": "mock",
    "serverId": "srv_drift_01"
  }
  ```
- **Response:**
  Returns the created `order`, completed `payment`, and provisioned cryptographic `licenses`.
