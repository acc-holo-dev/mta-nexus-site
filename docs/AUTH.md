# MTA NEXUS — Authentication & Authorization

## 1. Identity Model
A user in MTA Nexus is an individual identity rather than a specialized account type. A single user can simultaneously purchase resources, develop and publish scripts, operate game servers, and participate in studio organizations.

## 2. Organization Memberships
Products and servers can be owned either by individual users or by Organizations (`Organization`). Memberships are governed by roles:
- `owner`: Full control over organization, finances, and members.
- `admin`: Manages servers, products, and configurations.
- `developer`: Publishes builds and modifies resources.
- `member`: Read access and team collaboration.

## 3. Policy Execution
Permissions are resolved via server-side policies:
`can(user, action, resource, context)`
Eliminating brittle client-side role checks.
