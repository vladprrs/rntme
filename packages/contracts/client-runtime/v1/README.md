# @rntme/contracts-client-runtime-v1

Client runtime contract for rntme. Defines the types, hooks, and providers a vendor module's `client` block consumes when mounted into a SPA host.

Scaffold only. The contract surface lands when the symbols (`ModuleBootContext`, `useTransport`/`useStateStore`/`useOperationRegistry`/`useModuleAction`, `TransportProvider`/`StoreProvider`/`RegistryProvider`, transport/lifecycle/operation registries, visibility evaluator, router utilities) are moved out of `@rntme/ui-runtime/client`.
